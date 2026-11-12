/**
 * IPCA-Casa: Serviço de Persistência e Sincronização em Tempo Real no Cloud Firestore
 * Aplica validação síncrona com firebase-blueprint.json e firestore.rules.
 */
import type { User } from 'firebase/auth';
import {
  Timestamp,
  Unsubscribe,
  WriteBatch,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { extractAuthProvider } from '../lib/firebaseAuthOnly';
import { BLUEPRINT_LIMITS, sanitizeFirestoreId } from '../lib/firebaseConfig';
import type {
  AccountingType,
  BasketItem,
  CompoundingFrequency,
  ConsumptionFrequency,
  ConsumptionGroup,
  DataOrigin,
  DepositTiming,
  EfficiencyPlanB,
  ExpenseNature,
  FamilyProfile,
  IncomeRecord,
  InvestmentProductType,
  ItemClassification,
  MonthlyClosure,
  OpportunityPlanC,
  PriceRecord,
  ProfileMode,
  RecurrenceType,
  StrategyStatus,
  SubstitutePlanA,
  TaxMode,
  UserAccount,
} from '../types';
import { extractIsoDatePrefix, getMonthsAgoIsoDate, getTodayIsoDate } from '../utils/dates';
import type { LegacyLocalBundle } from './auth';

export { BLUEPRINT_LIMITS, sanitizeFirestoreId };

const MAX_FIRESTORE_NUMBER = 10000000000;
const MIN_FIRESTORE_SAVINGS = -1000000000;
const MAX_BATCH_OPERATIONS = 400;

export function clampString(value: unknown, maxLen: number, fallback = ''): string {
  const str = typeof value === 'string' ? value.trim() : String(value ?? fallback).trim();
  const resolved = str || fallback;
  return resolved.slice(0, maxLen);
}

export function nonNegativeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(MAX_FIRESTORE_NUMBER, num);
}

export function boundedNumber(
  value: unknown,
  minVal: number,
  maxVal: number,
  fallback: number
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(maxVal, Math.max(minVal, num));
}

function finiteNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function clampMembersCount(value: unknown): number {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.min(50, num);
}

export function sanitizeClassification(value: unknown): ItemClassification {
  if (value === 'Essencial' || value === 'Supérfluo' || value === 'Não classificado') {
    return value;
  }
  return 'Não classificado';
}

function sanitizeConsumptionFrequency(value: unknown): ConsumptionFrequency | undefined {
  if (
    value === 'mensal' ||
    value === 'quinzenal' ||
    value === 'semanal' ||
    value === 'diaria' ||
    value === 'anual' ||
    value === 'personalizada_dias'
  ) {
    return value;
  }
  return undefined;
}

function sanitizeExpenseNature(value: unknown): ExpenseNature | undefined {
  if (value === 'Fixa' || value === 'Variável') return value;
  return undefined;
}

function sanitizeRecurrenceType(value: unknown): RecurrenceType | undefined {
  if (value === 'Recorrente' || value === 'Eventual') return value;
  return undefined;
}

function sanitizeAccountingType(value: unknown): AccountingType | undefined {
  if (
    value === 'Consumo' ||
    value === 'Amortização de dívida' ||
    value === 'Aplicação financeira' ||
    value === 'Transferência'
  ) {
    return value;
  }
  return undefined;
}

function sanitizeDataOrigin(value: unknown): DataOrigin | undefined {
  if (
    value === 'usuario' ||
    value === 'oficial_ibge' ||
    value === 'demonstrativo' ||
    value === 'estimado' ||
    value === 'simulado' ||
    value === 'cache'
  ) {
    return value;
  }
  return undefined;
}

function sanitizeStrategyStatus(value: unknown): StrategyStatus | undefined {
  if (
    value === 'potencial' ||
    value === 'simulada' ||
    value === 'planejada' ||
    value === 'realizada'
  ) {
    return value;
  }
  return undefined;
}

function sanitizeResourceCategory(
  value: unknown
): EfficiencyPlanB['resourceCategory'] | undefined {
  if (
    value === 'energia' ||
    value === 'agua' ||
    value === 'combustivel' ||
    value === 'gas' ||
    value === 'internet' ||
    value === 'outros'
  ) {
    return value;
  }
  return undefined;
}

function sanitizeProductType(value: unknown): InvestmentProductType | undefined {
  if (
    value === 'poupanca' ||
    value === 'cdb' ||
    value === 'tesouro_selic' ||
    value === 'tesouro_prefixado' ||
    value === 'tesouro_ipca' ||
    value === 'fundos' ||
    value === 'outros'
  ) {
    return value;
  }
  return undefined;
}

function sanitizeCompoundingFrequency(value: unknown): CompoundingFrequency | undefined {
  if (value === 'mensal' || value === 'diaria' || value === 'anual') return value;
  return undefined;
}

function sanitizeDepositTiming(value: unknown): DepositTiming | undefined {
  if (value === 'fim' || value === 'inicio') return value;
  return undefined;
}

function sanitizeTaxMode(value: unknown): TaxMode | undefined {
  if (
    value === 'automatica' ||
    value === 'manual' ||
    value === 'isento' ||
    value === 'bruto'
  ) {
    return value;
  }
  return undefined;
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

function sanitizeProfileMode(value: unknown): ProfileMode | undefined {
  if (value === 'pessoal' || value === 'negocio') return value;
  return undefined;
}

export function buildProfileWritePayload(
  profile: FamilyProfile,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const id = sanitizeFirestoreId(profile.id, 'prof');
  const base: Record<string, unknown> = {
    name: clampString(profile.name, BLUEPRINT_LIMITS.PROFILE_NAME_MAX, 'Meu Orçamento Familiar'),
    membersCount: clampMembersCount(profile.membersCount),
    referenceRegion: clampString(profile.referenceRegion, BLUEPRINT_LIMITS.REGION_MAX, 'Brasil'),
    currency: clampString(profile.currency, BLUEPRINT_LIMITS.CURRENCY_MAX, 'BRL'),
    updatedAt: serverTimestamp(),
  };

  const mode = sanitizeProfileMode(profile.profileMode);
  if (mode) {
    base.profileMode = mode;
  }
  if (
    typeof profile.priceAlertThresholdPercent === 'number' &&
    Number.isFinite(profile.priceAlertThresholdPercent)
  ) {
    base.priceAlertThresholdPercent = boundedNumber(
      profile.priceAlertThresholdPercent,
      0.1,
      500,
      10
    );
  }

  if (isCreate) {
    return {
      id,
      userId,
      ...base,
      isDemo: false,
      createdAt: serverTimestamp(),
    };
  }
  return base;
}

export function buildMonthlyClosureWritePayload(
  closure: MonthlyClosure,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const closureId = sanitizeFirestoreId(
    closure.id || `cls_${closure.profileId}_${closure.monthKey}`,
    'cls'
  );
  const profileId = sanitizeFirestoreId(closure.profileId, 'prof');
  const rawMonthKey = String(closure.monthKey || '').trim().slice(0, 7);
  const monthKey = /^\d{4}-\d{2}$/.test(rawMonthKey)
    ? rawMonthKey
    : getTodayIsoDate().slice(0, 7);

  const mutable: Record<string, unknown> = {
    monthLabel: clampString(closure.monthLabel || monthKey, BLUEPRINT_LIMITS.CLOSURE_LABEL_MAX, monthKey),
    totalMonthlySpend: nonNegativeNumber(closure.totalMonthlySpend, 0),
    comparableBaseCost: nonNegativeNumber(closure.comparableBaseCost, 0),
    ipcaCasaPercent: boundedNumber(closure.ipcaCasaPercent, -100, 100000, 0),
    ipcaOficialPercent: boundedNumber(closure.ipcaOficialPercent, -100, 100000, 0),
    spreadPP: boundedNumber(closure.spreadPP, -100000, 100000, 0),
    itemsCount: Math.round(boundedNumber(closure.itemsCount, 0, 10000, 0)),
    eligibleItemsCount: Math.round(boundedNumber(closure.eligibleItemsCount, 0, 10000, 0)),
    closedAt: clampString(
      extractIsoDatePrefix(closure.closedAt) || getTodayIsoDate(),
      BLUEPRINT_LIMITS.DATE_MAX
    ),
    updatedAt: serverTimestamp(),
  };

  const mode = sanitizeProfileMode(closure.profileMode);
  if (mode) mutable.profileMode = mode;
  if (typeof closure.monthlyIncome === 'number' && Number.isFinite(closure.monthlyIncome)) {
    mutable.monthlyIncome = nonNegativeNumber(closure.monthlyIncome, 0);
  }
  if (typeof closure.monthlyBalance === 'number' && Number.isFinite(closure.monthlyBalance)) {
    mutable.monthlyBalance = boundedNumber(
      closure.monthlyBalance,
      MIN_FIRESTORE_SAVINGS,
      MAX_FIRESTORE_NUMBER,
      0
    );
  }
  if (typeof closure.topCategory === 'string') {
    mutable.topCategory = clampString(closure.topCategory, BLUEPRINT_LIMITS.GROUP_NAME_MAX);
  }
  if (typeof closure.topDriverName === 'string') {
    mutable.topDriverName = clampString(closure.topDriverName, BLUEPRINT_LIMITS.ITEM_NAME_MAX);
  }
  if (
    typeof closure.topDriverChangePercent === 'number' &&
    Number.isFinite(closure.topDriverChangePercent)
  ) {
    mutable.topDriverChangePercent = boundedNumber(closure.topDriverChangePercent, -100, 100000, 0);
  }
  if (typeof closure.priceEffectReais === 'number' && Number.isFinite(closure.priceEffectReais)) {
    mutable.priceEffectReais = boundedNumber(
      closure.priceEffectReais,
      MIN_FIRESTORE_SAVINGS,
      MAX_FIRESTORE_NUMBER,
      0
    );
  }
  if (
    typeof closure.quantityEffectReais === 'number' &&
    Number.isFinite(closure.quantityEffectReais)
  ) {
    mutable.quantityEffectReais = boundedNumber(
      closure.quantityEffectReais,
      MIN_FIRESTORE_SAVINGS,
      MAX_FIRESTORE_NUMBER,
      0
    );
  }
  if (typeof closure.mixEffectReais === 'number' && Number.isFinite(closure.mixEffectReais)) {
    mutable.mixEffectReais = boundedNumber(
      closure.mixEffectReais,
      MIN_FIRESTORE_SAVINGS,
      MAX_FIRESTORE_NUMBER,
      0
    );
  }
  if (
    closure.ibgeSourceMode === 'live' ||
    closure.ibgeSourceMode === 'cached_live' ||
    closure.ibgeSourceMode === 'contingency'
  ) {
    mutable.ibgeSourceMode = closure.ibgeSourceMode;
  }
  if (typeof closure.ibgeReferenceMonth === 'string') {
    mutable.ibgeReferenceMonth = clampString(closure.ibgeReferenceMonth, BLUEPRINT_LIMITS.DATE_MAX);
  }
  const origin = sanitizeDataOrigin(closure.dataOrigin);
  if (origin) mutable.dataOrigin = origin;
  if (typeof closure.notes === 'string') {
    mutable.notes = clampString(closure.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);
  }

  if (isCreate) {
    return {
      id: closureId,
      userId,
      profileId,
      monthKey,
      ...mutable,
      createdAt: serverTimestamp(),
    };
  }
  return mutable;
}

export function buildBasketItemWritePayload(
  item: BasketItem,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const id = sanitizeFirestoreId(item.id, 'item');
  const profileId = sanitizeFirestoreId(item.profileId, 'prof');

  const mutable: Record<string, unknown> = {
    name: clampString(item.name, BLUEPRINT_LIMITS.ITEM_NAME_MAX, 'Item sem nome'),
    group: clampString(item.group, BLUEPRINT_LIMITS.GROUP_NAME_MAX, 'Alimentação e bebidas'),
    classification: sanitizeClassification(item.classification),
    monthlySpend: nonNegativeNumber(item.monthlySpend, 0),
    oldPrice: nonNegativeNumber(item.oldPrice, 0),
    currentPrice: nonNegativeNumber(item.currentPrice, 0),
    oldPriceDate: clampString(item.oldPriceDate || '', BLUEPRINT_LIMITS.DATE_MAX),
    currentPriceDate: clampString(item.currentPriceDate || '', BLUEPRINT_LIMITS.DATE_MAX),
    unit: clampString(item.unit, BLUEPRINT_LIMITS.UNIT_MAX, 'unidade'),
    active: item.active !== false,
    isArchived: Boolean(item.isArchived),
    updatedAt: serverTimestamp(),
  };

  if (typeof item.description === 'string') {
    mutable.description = item.description.trim().slice(0, BLUEPRINT_LIMITS.ITEM_DESC_MAX);
  }
  if (typeof item.subcategory === 'string') {
    mutable.subcategory = item.subcategory.trim().slice(0, BLUEPRINT_LIMITS.SUBCATEGORY_MAX);
  }
  if (typeof item.quantity === 'number' && Number.isFinite(item.quantity)) {
    mutable.quantity = nonNegativeNumber(item.quantity, 0);
  }
  if (typeof item.baseQuantity === 'number' && Number.isFinite(item.baseQuantity)) {
    mutable.baseQuantity = nonNegativeNumber(item.baseQuantity, 0);
  }
  if (typeof item.packageSize === 'number' && Number.isFinite(item.packageSize)) {
    mutable.packageSize = nonNegativeNumber(item.packageSize, 0);
  }
  if (typeof item.packageUnit === 'string') {
    mutable.packageUnit = item.packageUnit.trim().slice(0, BLUEPRINT_LIMITS.UNIT_MAX);
  }
  const freq = sanitizeConsumptionFrequency(item.consumptionFrequency);
  if (freq) mutable.consumptionFrequency = freq;
  if (typeof item.frequencyDays === 'number' && Number.isFinite(item.frequencyDays)) {
    mutable.frequencyDays = boundedNumber(item.frequencyDays, 1, 3650, 30);
  }
  const nature = sanitizeExpenseNature(item.expenseNature);
  if (nature) mutable.expenseNature = nature;
  const recurrence = sanitizeRecurrenceType(item.recurrenceType);
  if (recurrence) mutable.recurrenceType = recurrence;
  const accType = sanitizeAccountingType(item.accountingType);
  if (accType) mutable.accountingType = accType;
  if (typeof item.comparabilityBroken === 'boolean') {
    mutable.comparabilityBroken = item.comparabilityBroken;
  }
  if (typeof item.comparabilityReason === 'string') {
    mutable.comparabilityReason = item.comparabilityReason
      .trim()
      .slice(0, BLUEPRINT_LIMITS.REASON_MAX);
  }
  const origin = sanitizeDataOrigin(item.dataOrigin);
  if (origin) mutable.dataOrigin = origin;
  if (typeof item.notes === 'string') {
    mutable.notes = item.notes.trim().slice(0, BLUEPRINT_LIMITS.NOTES_MAX);
  }

  if (isCreate) {
    return {
      id,
      userId,
      profileId,
      ...mutable,
      createdAt: serverTimestamp(),
    };
  }
  return mutable;
}

export function buildPriceRecordWritePayload(
  record: {
    id?: string;
    profileId?: string;
    itemId: string;
    price: number;
    referenceDate: string;
    unit?: string;
    source?: string;
    origin?: string;
    region?: string;
    packageSize?: number;
    packageUnit?: string;
    dataOrigin?: DataOrigin;
    comparabilityBroken?: boolean;
    notes?: string;
  },
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const priceId = sanitizeFirestoreId(record.id, 'price');
  const itemId = sanitizeFirestoreId(record.itemId, 'item');

  const mutable: Record<string, unknown> = {
    price: nonNegativeNumber(record.price, 0),
    referenceDate: clampString(
      extractIsoDatePrefix(record.referenceDate) || getTodayIsoDate(),
      BLUEPRINT_LIMITS.DATE_MAX
    ),
    updatedAt: serverTimestamp(),
  };

  if (typeof record.unit === 'string') {
    mutable.unit = clampString(record.unit, BLUEPRINT_LIMITS.UNIT_MAX);
  }
  if (typeof record.source === 'string') {
    mutable.source = clampString(record.source, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
  }
  if (typeof record.origin === 'string') {
    mutable.origin = clampString(record.origin, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
  }
  if (typeof record.region === 'string') {
    mutable.region = clampString(record.region, BLUEPRINT_LIMITS.REGION_MAX);
  }
  if (typeof record.packageSize === 'number' && Number.isFinite(record.packageSize)) {
    mutable.packageSize = nonNegativeNumber(record.packageSize, 0);
  }
  if (typeof record.packageUnit === 'string') {
    mutable.packageUnit = clampString(record.packageUnit, BLUEPRINT_LIMITS.UNIT_MAX);
  }
  const dataOrigin = sanitizeDataOrigin(record.dataOrigin);
  if (dataOrigin) mutable.dataOrigin = dataOrigin;
  if (typeof record.comparabilityBroken === 'boolean') {
    mutable.comparabilityBroken = record.comparabilityBroken;
  }
  if (typeof record.notes === 'string') {
    mutable.notes = clampString(record.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);
  }

  if (isCreate) {
    const createDoc: Record<string, unknown> = {
      id: priceId,
      userId,
      itemId,
      ...mutable,
      createdAt: serverTimestamp(),
    };
    if (typeof record.profileId === 'string' && record.profileId.trim()) {
      createDoc.profileId = sanitizeFirestoreId(record.profileId, 'prof');
    }
    return createDoc;
  }
  return mutable;
}

export function buildIncomeRecordWritePayload(
  record: {
    id?: string;
    profileId: string;
    referenceDate: string;
    nominalIncome: number;
    source?: string;
    notes?: string;
    grossIncome?: number;
    netIncome?: number;
    incomeType?: string;
    debtObligations?: number;
    financialApplications?: number;
    transfers?: number;
    availableReserve?: number;
    workingDaysPerMonth?: number;
  },
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const incomeId = sanitizeFirestoreId(record.id, 'inc');
  const profileId = sanitizeFirestoreId(record.profileId, 'prof');

  const mutable: Record<string, unknown> = {
    referenceDate: clampString(
      extractIsoDatePrefix(record.referenceDate) || getTodayIsoDate(),
      BLUEPRINT_LIMITS.DATE_MAX
    ),
    nominalIncome: nonNegativeNumber(record.nominalIncome, 0),
    updatedAt: serverTimestamp(),
  };

  if (typeof record.source === 'string') {
    mutable.source = clampString(record.source, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
  }
  if (typeof record.notes === 'string') {
    mutable.notes = clampString(record.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);
  }
  if (typeof record.grossIncome === 'number' && Number.isFinite(record.grossIncome)) {
    mutable.grossIncome = nonNegativeNumber(record.grossIncome, 0);
  }
  if (typeof record.netIncome === 'number' && Number.isFinite(record.netIncome)) {
    mutable.netIncome = nonNegativeNumber(record.netIncome, 0);
  }
  if (typeof record.incomeType === 'string') {
    mutable.incomeType = clampString(record.incomeType, BLUEPRINT_LIMITS.INCOME_TYPE_MAX);
  }
  if (typeof record.debtObligations === 'number' && Number.isFinite(record.debtObligations)) {
    mutable.debtObligations = nonNegativeNumber(record.debtObligations, 0);
  }
  if (
    typeof record.financialApplications === 'number' &&
    Number.isFinite(record.financialApplications)
  ) {
    mutable.financialApplications = nonNegativeNumber(record.financialApplications, 0);
  }
  if (typeof record.transfers === 'number' && Number.isFinite(record.transfers)) {
    mutable.transfers = nonNegativeNumber(record.transfers, 0);
  }
  if (typeof record.availableReserve === 'number' && Number.isFinite(record.availableReserve)) {
    mutable.availableReserve = nonNegativeNumber(record.availableReserve, 0);
  }
  if (
    typeof record.workingDaysPerMonth === 'number' &&
    Number.isFinite(record.workingDaysPerMonth)
  ) {
    mutable.workingDaysPerMonth = boundedNumber(record.workingDaysPerMonth, 1, 31, 22);
  }

  if (isCreate) {
    return {
      id: incomeId,
      userId,
      profileId,
      ...mutable,
      createdAt: serverTimestamp(),
    };
  }
  return mutable;
}

export function buildPlanAWritePayload(
  plan: SubstitutePlanA,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const strategyId = sanitizeFirestoreId(plan.id, 'sub');
  const profileId = sanitizeFirestoreId(plan.profileId, 'prof');

  const mutable: Record<string, unknown> = {
    title: clampString(plan.originalItemName, BLUEPRINT_LIMITS.STRATEGY_TITLE_MAX, 'Substituição'),
    description: clampString(plan.qualitativeTradeoff || '', BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX),
    applied: Boolean(plan.applied),
    monthlySavings: boundedNumber(plan.monthlySavings, MIN_FIRESTORE_SAVINGS, MAX_FIRESTORE_NUMBER, 0),
    originalItemId: clampString(plan.originalItemId || '', BLUEPRINT_LIMITS.ID_MAX),
    originalItemName: clampString(plan.originalItemName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
    originalPrice: nonNegativeNumber(plan.originalPrice, 0),
    substituteName: clampString(plan.substituteName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
    substitutePrice: nonNegativeNumber(plan.substitutePrice, 0),
    qualitativeTradeoff: clampString(
      plan.qualitativeTradeoff || '',
      BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX
    ),
    updatedAt: serverTimestamp(),
  };

  if (typeof plan.originalPackageSize === 'number' && Number.isFinite(plan.originalPackageSize)) {
    mutable.originalPackageSize = nonNegativeNumber(plan.originalPackageSize, 0);
  }
  if (typeof plan.originalPackageUnit === 'string') {
    mutable.originalPackageUnit = clampString(plan.originalPackageUnit, BLUEPRINT_LIMITS.UNIT_MAX);
  }
  if (
    typeof plan.substitutePackageSize === 'number' &&
    Number.isFinite(plan.substitutePackageSize)
  ) {
    mutable.substitutePackageSize = nonNegativeNumber(plan.substitutePackageSize, 0);
  }
  if (typeof plan.substitutePackageUnit === 'string') {
    mutable.substitutePackageUnit = clampString(
      plan.substitutePackageUnit,
      BLUEPRINT_LIMITS.UNIT_MAX
    );
  }
  if (typeof plan.monthlyQuantity === 'number' && Number.isFinite(plan.monthlyQuantity)) {
    mutable.monthlyQuantity = nonNegativeNumber(plan.monthlyQuantity, 0);
  }
  if (typeof plan.unit === 'string') {
    mutable.unit = clampString(plan.unit, BLUEPRINT_LIMITS.UNIT_MAX);
  }
  if (typeof plan.notes === 'string') {
    mutable.notes = clampString(plan.notes, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);
  }
  const status = sanitizeStrategyStatus(plan.status);
  if (status) mutable.status = status;

  if (isCreate) {
    return {
      id: strategyId,
      userId,
      profileId,
      planType: 'PLAN_A',
      ...mutable,
      createdAt: serverTimestamp(),
    };
  }
  return mutable;
}

export function buildPlanBWritePayload(
  plan: EfficiencyPlanB,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const strategyId = sanitizeFirestoreId(plan.id, 'eff');
  const profileId = sanitizeFirestoreId(plan.profileId, 'prof');

  const mutable: Record<string, unknown> = {
    title: clampString(plan.resourceName, BLUEPRINT_LIMITS.STRATEGY_TITLE_MAX, 'Eficiência'),
    applied: Boolean(plan.applied),
    monthlySavings: nonNegativeNumber(plan.estimatedMonthlySavings, 0),
    resourceName: clampString(plan.resourceName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
    unit: clampString(plan.unit, BLUEPRINT_LIMITS.UNIT_MAX, 'un'),
    tariffPerUnit: nonNegativeNumber(plan.tariffPerUnit, 0),
    currentConsumption: nonNegativeNumber(plan.currentConsumption, 0),
    targetConsumption: nonNegativeNumber(plan.targetConsumption, 0),
    currentSpend: nonNegativeNumber(plan.currentSpend, 0),
    progressPercent: boundedNumber(plan.progressPercent, 0, 100, 0),
    updatedAt: serverTimestamp(),
  };

  const cat = sanitizeResourceCategory(plan.resourceCategory);
  if (cat) mutable.resourceCategory = cat;
  if (typeof plan.fixedFee === 'number' && Number.isFinite(plan.fixedFee)) {
    mutable.fixedFee = nonNegativeNumber(plan.fixedFee, 0);
  }
  if (typeof plan.extraCharges === 'number' && Number.isFinite(plan.extraCharges)) {
    mutable.extraCharges = nonNegativeNumber(plan.extraCharges, 0);
  }
  if (typeof plan.tariffSource === 'string') {
    mutable.tariffSource = clampString(plan.tariffSource, BLUEPRINT_LIMITS.TARIFF_SOURCE_MAX);
  }
  if (typeof plan.tariffDate === 'string') {
    mutable.tariffDate = clampString(plan.tariffDate, BLUEPRINT_LIMITS.DATE_MAX);
  }
  if (typeof plan.tieredTariffNote === 'string') {
    mutable.tieredTariffNote = clampString(plan.tieredTariffNote, BLUEPRINT_LIMITS.REASON_MAX);
  }
  const status = sanitizeStrategyStatus(plan.status);
  if (status) mutable.status = status;
  if (typeof plan.notes === 'string') {
    mutable.notes = plan.notes.trim().slice(0, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);
  }

  if (isCreate) {
    return {
      id: strategyId,
      userId,
      profileId,
      planType: 'PLAN_B',
      ...mutable,
      createdAt: serverTimestamp(),
    };
  }
  return mutable;
}

export function buildPlanCWritePayload(
  plan: OpportunityPlanC,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const profileId = sanitizeFirestoreId(plan.profileId, 'prof');
  const strategyId = sanitizeFirestoreId(plan.id || `opp_${profileId}`, 'opp');

  const mutable: Record<string, unknown> = {
    title: 'Reserva de Oportunidade & Alocação',
    applied: true,
    monthlySavings: nonNegativeNumber(plan.monthlyInvestment, 0),
    monthlyInvestment: nonNegativeNumber(plan.monthlyInvestment, 0),
    nominalAnnualRate: boundedNumber(plan.nominalAnnualRate, 0, 10000, 0),
    expectedAnnualInflation: boundedNumber(plan.expectedAnnualInflation, 0, 10000, 0),
    realAnnualYield: boundedNumber(plan.realAnnualYield, -100, 10000, 0),
    projection12Months: nonNegativeNumber(plan.projection12Months, 0),
    projection24Months: nonNegativeNumber(plan.projection24Months, 0),
    projection36Months: nonNegativeNumber(plan.projection36Months, 0),
    useLinkedSavings: Boolean(plan.useLinkedSavings),
    updatedAt: serverTimestamp(),
  };

  if (typeof plan.initialCapital === 'number' && Number.isFinite(plan.initialCapital)) {
    mutable.initialCapital = nonNegativeNumber(plan.initialCapital, 0);
  }
  if (typeof plan.termMonths === 'number' && Number.isFinite(plan.termMonths)) {
    mutable.termMonths = boundedNumber(Math.round(plan.termMonths), 1, 600, 12);
  }
  const productType = sanitizeProductType(plan.productType);
  if (productType) mutable.productType = productType;
  const compoundingFrequency = sanitizeCompoundingFrequency(plan.compoundingFrequency);
  if (compoundingFrequency) mutable.compoundingFrequency = compoundingFrequency;
  const depositTiming = sanitizeDepositTiming(plan.depositTiming);
  if (depositTiming) mutable.depositTiming = depositTiming;
  const taxMode = sanitizeTaxMode(plan.taxMode);
  if (taxMode) mutable.taxMode = taxMode;
  if (typeof plan.manualTaxRate === 'number' && Number.isFinite(plan.manualTaxRate)) {
    mutable.manualTaxRate = boundedNumber(plan.manualTaxRate, 0, 100, 0);
  }
  if (typeof plan.adminFeeAnnual === 'number' && Number.isFinite(plan.adminFeeAnnual)) {
    mutable.adminFeeAnnual = boundedNumber(plan.adminFeeAnnual, 0, 100, 0);
  }
  if (typeof plan.custodyFeeAnnual === 'number' && Number.isFinite(plan.custodyFeeAnnual)) {
    mutable.custodyFeeAnnual = boundedNumber(plan.custodyFeeAnnual, 0, 100, 0);
  }
  const status = sanitizeStrategyStatus(plan.status);
  if (status) mutable.status = status;
  if (typeof plan.notes === 'string') {
    mutable.notes = plan.notes.trim().slice(0, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);
  }

  if (isCreate) {
    return {
      id: strategyId,
      userId,
      profileId,
      planType: 'PLAN_C',
      ...mutable,
      createdAt: serverTimestamp(),
    };
  }
  return mutable;
}

async function commitInChunks(ops: Array<(batch: WriteBatch) => void>): Promise<void> {
  if (!db || ops.length === 0) return;
  for (let i = 0; i < ops.length; i += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + MAX_BATCH_OPERATIONS);
    for (const op of slice) {
      op(batch);
    }
    await batch.commit();
  }
}

const bootstrapInFlight = new Map<string, Promise<{ user: UserAccount; isNewUser: boolean }>>();

export class FirestoreService {
  static async ensureUserBootstrapped(
    firebaseUser: User
  ): Promise<{ user: UserAccount; isNewUser: boolean }> {
    const uid = sanitizeFirestoreId(firebaseUser.uid, 'usr');
    const existingPromise = bootstrapInFlight.get(uid);
    if (existingPromise) {
      return existingPromise;
    }

    const task = this.runBootstrap(firebaseUser, uid).finally(() => {
      bootstrapInFlight.delete(uid);
    });
    bootstrapInFlight.set(uid, task);
    return task;
  }

  private static async runBootstrap(
    firebaseUser: User,
    uid: string
  ): Promise<{ user: UserAccount; isNewUser: boolean }> {
    if (!db) {
      throw new Error('Cloud Firestore não está configurado neste ambiente.');
    }

    const authProvider = extractAuthProvider(firebaseUser);
    const emailVerified = Boolean(firebaseUser.emailVerified);

    const email = clampString(
      firebaseUser.email || '',
      BLUEPRINT_LIMITS.EMAIL_MAX,
      'usuario@ipca-casa.app'
    ).toLowerCase();
    const displayName = clampString(
      firebaseUser.displayName || email.split('@')[0],
      BLUEPRINT_LIMITS.DISPLAY_NAME_MAX,
      'Usuário'
    );
    const avatarUrl =
      typeof firebaseUser.photoURL === 'string' && firebaseUser.photoURL.trim().length > 0
        ? firebaseUser.photoURL.trim().slice(0, BLUEPRINT_LIMITS.AVATAR_URL_MAX)
        : undefined;

    const userDocRef = doc(db, 'users', uid);
    const privateDocRef = doc(db, 'users', uid, 'private', 'account');

    let userSnap;
    try {
      userSnap = await getDoc(userDocRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }

    if (!userSnap.exists()) {
      const defaultProfileId = sanitizeFirestoreId(`prof_${uid}`, 'prof');
      const profileDocRef = doc(db, 'users', uid, 'profiles', defaultProfileId);

      const batch = writeBatch(db);
      const userPublicPayload: Record<string, unknown> = {
        id: uid,
        userId: uid,
        displayName,
        authProvider,
        defaultProfileId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (avatarUrl) {
        userPublicPayload.avatarUrl = avatarUrl;
      }

      batch.set(userDocRef, userPublicPayload);
      batch.set(privateDocRef, {
        id: 'account',
        userId: uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(profileDocRef, {
        id: defaultProfileId,
        userId: uid,
        name: displayName,
        membersCount: 2,
        referenceRegion: 'Brasil',
        currency: 'BRL',
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
      }

      const nowIso = new Date().toISOString();
      return {
        isNewUser: true,
        user: {
          id: uid,
          email,
          displayName,
          avatarUrl,
          authProvider,
          emailVerified,
          createdAt: nowIso,
          lastLoginAt: nowIso,
          profileId: defaultProfileId,
        },
      };
    }

    const existingData = userSnap.data();
    const defaultProfileId = sanitizeFirestoreId(
      existingData.defaultProfileId || `prof_${uid}`,
      'prof'
    );

    const updatePayload: Record<string, unknown> = {
      displayName,
      authProvider,
      defaultProfileId,
      updatedAt: serverTimestamp(),
    };
    if (avatarUrl) {
      updatePayload.avatarUrl = avatarUrl;
    }

    try {
      await updateDoc(userDocRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }

    try {
      const privSnap = await getDoc(privateDocRef);
      if (!privSnap.exists()) {
        await setDoc(privateDocRef, {
          id: 'account',
          userId: uid,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (privSnap.data().email !== email) {
        await updateDoc(privateDocRef, {
          email,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/private/account`);
    }

    try {
      const defaultProfileRef = doc(db, 'users', uid, 'profiles', defaultProfileId);
      const profSnap = await getDoc(defaultProfileRef);
      if (!profSnap.exists()) {
        await setDoc(defaultProfileRef, {
          id: defaultProfileId,
          userId: uid,
          name: displayName,
          membersCount: 2,
          referenceRegion: 'Brasil',
          currency: 'BRL',
          isDemo: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/profiles/${defaultProfileId}`);
    }

    return {
      isNewUser: false,
      user: {
        id: uid,
        email,
        displayName,
        avatarUrl: avatarUrl || existingData.avatarUrl,
        authProvider,
        emailVerified,
        createdAt: timestampToIso(existingData.createdAt),
        lastLoginAt: new Date().toISOString(),
        profileId: defaultProfileId,
      },
    };
  }

  static subscribeUserCollections(
    userId: string,
    handlers: {
      onProfiles: (profiles: FamilyProfile[]) => void;
      onBasketItems: (items: BasketItem[]) => void;
      onIncomeHistory: (records: IncomeRecord[]) => void;
      onPriceHistory: (records: PriceRecord[]) => void;
      onConsumptionGroups: (groups: ConsumptionGroup[]) => void;
      onStrategies: (strategies: {
        plansA: SubstitutePlanA[];
        plansB: EfficiencyPlanB[];
        plansC: OpportunityPlanC[];
        planC?: OpportunityPlanC;
      }) => void;
      onMonthlyClosures?: (closures: MonthlyClosure[]) => void;
    }
  ): () => void {
    if (!db) return () => {};
    const uid = sanitizeFirestoreId(userId, 'usr');
    const unsubs: Unsubscribe[] = [];

    const profilesPath = `users/${uid}/profiles`;
    unsubs.push(
      onSnapshot(
        query(collection(db, profilesPath), where('userId', '==', uid)),
        (snapshot) => {
          const profiles: FamilyProfile[] = snapshot.docs.map((d) => {
            const raw = d.data();
            return {
              id: raw.id || d.id,
              name: String(raw.name || 'Meu Orçamento Familiar'),
              profileMode: sanitizeProfileMode(raw.profileMode),
              priceAlertThresholdPercent:
                typeof raw.priceAlertThresholdPercent === 'number'
                  ? raw.priceAlertThresholdPercent
                  : undefined,
              membersCount: finiteNumber(raw.membersCount, 1),
              referenceRegion: String(raw.referenceRegion || 'Brasil'),
              currency: String(raw.currency || 'BRL'),
              isDemo: false,
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          handlers.onProfiles(profiles);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, profilesPath)
      )
    );

    const basketPath = `users/${uid}/basketItems`;
    unsubs.push(
      onSnapshot(
        query(collection(db, basketPath), where('userId', '==', uid)),
        (snapshot) => {
          const items: BasketItem[] = snapshot.docs.map((d) => {
            const raw = d.data();
            return {
              id: raw.id || d.id,
              profileId: String(raw.profileId || ''),
              name: String(raw.name || ''),
              description: typeof raw.description === 'string' ? raw.description : undefined,
              group: String(raw.group || 'Alimentação e bebidas'),
              subcategory: typeof raw.subcategory === 'string' ? raw.subcategory : undefined,
              classification: sanitizeClassification(raw.classification),
              monthlySpend: finiteNumber(raw.monthlySpend, 0),
              oldPrice: finiteNumber(raw.oldPrice, 0),
              currentPrice: finiteNumber(raw.currentPrice, 0),
              oldPriceDate: String(raw.oldPriceDate || ''),
              currentPriceDate: String(raw.currentPriceDate || ''),
              unit: String(raw.unit || 'unidade'),
              quantity: typeof raw.quantity === 'number' ? raw.quantity : undefined,
              baseQuantity: typeof raw.baseQuantity === 'number' ? raw.baseQuantity : undefined,
              packageSize: typeof raw.packageSize === 'number' ? raw.packageSize : undefined,
              packageUnit: typeof raw.packageUnit === 'string' ? raw.packageUnit : undefined,
              consumptionFrequency: sanitizeConsumptionFrequency(raw.consumptionFrequency),
              frequencyDays: typeof raw.frequencyDays === 'number' ? raw.frequencyDays : undefined,
              expenseNature: sanitizeExpenseNature(raw.expenseNature),
              recurrenceType: sanitizeRecurrenceType(raw.recurrenceType),
              accountingType: sanitizeAccountingType(raw.accountingType),
              comparabilityBroken:
                typeof raw.comparabilityBroken === 'boolean' ? raw.comparabilityBroken : undefined,
              comparabilityReason:
                typeof raw.comparabilityReason === 'string' ? raw.comparabilityReason : undefined,
              dataOrigin: sanitizeDataOrigin(raw.dataOrigin),
              notes: typeof raw.notes === 'string' ? raw.notes : undefined,
              active: raw.active !== false,
              isArchived: Boolean(raw.isArchived),
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          handlers.onBasketItems(items);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, basketPath)
      )
    );

    const incomePath = `users/${uid}/incomeHistory`;
    unsubs.push(
      onSnapshot(
        query(collection(db, incomePath), where('userId', '==', uid)),
        (snapshot) => {
          const records: IncomeRecord[] = snapshot.docs
            .map((d) => {
              const raw = d.data();
              return {
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                referenceDate: String(raw.referenceDate || ''),
                nominalIncome: finiteNumber(raw.nominalIncome, 0),
                source: typeof raw.source === 'string' ? raw.source : undefined,
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
                grossIncome: typeof raw.grossIncome === 'number' ? raw.grossIncome : undefined,
                netIncome: typeof raw.netIncome === 'number' ? raw.netIncome : undefined,
                incomeType: typeof raw.incomeType === 'string' ? raw.incomeType : undefined,
                debtObligations:
                  typeof raw.debtObligations === 'number' ? raw.debtObligations : undefined,
                financialApplications:
                  typeof raw.financialApplications === 'number'
                    ? raw.financialApplications
                    : undefined,
                transfers: typeof raw.transfers === 'number' ? raw.transfers : undefined,
                availableReserve:
                  typeof raw.availableReserve === 'number' ? raw.availableReserve : undefined,
                workingDaysPerMonth:
                  typeof raw.workingDaysPerMonth === 'number' ? raw.workingDaysPerMonth : undefined,
                createdAt: timestampToIso(raw.createdAt),
                updatedAt: raw.updatedAt ? timestampToIso(raw.updatedAt) : undefined,
              };
            })
            .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
          handlers.onIncomeHistory(records);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, incomePath)
      )
    );

    const pricePath = `users/${uid}/priceHistory`;
    unsubs.push(
      onSnapshot(
        query(collection(db, pricePath), where('userId', '==', uid)),
        (snapshot) => {
          const records: PriceRecord[] = snapshot.docs
            .map((d) => {
              const raw = d.data();
              return {
                id: raw.id || d.id,
                profileId: typeof raw.profileId === 'string' ? raw.profileId : undefined,
                itemId: String(raw.itemId || ''),
                price: finiteNumber(raw.price, 0),
                referenceDate: String(raw.referenceDate || ''),
                unit: typeof raw.unit === 'string' ? raw.unit : undefined,
                source: typeof raw.source === 'string' ? raw.source : undefined,
                origin: typeof raw.origin === 'string' ? raw.origin : undefined,
                region: typeof raw.region === 'string' ? raw.region : undefined,
                packageSize: typeof raw.packageSize === 'number' ? raw.packageSize : undefined,
                packageUnit: typeof raw.packageUnit === 'string' ? raw.packageUnit : undefined,
                dataOrigin: sanitizeDataOrigin(raw.dataOrigin),
                comparabilityBroken:
                  typeof raw.comparabilityBroken === 'boolean' ? raw.comparabilityBroken : undefined,
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
                createdAt: timestampToIso(raw.createdAt),
                updatedAt: raw.updatedAt ? timestampToIso(raw.updatedAt) : undefined,
              };
            })
            .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
          handlers.onPriceHistory(records);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, pricePath)
      )
    );

    const groupsPath = `users/${uid}/consumptionGroups`;
    unsubs.push(
      onSnapshot(
        query(collection(db, groupsPath), where('userId', '==', uid)),
        (snapshot) => {
          const groups: ConsumptionGroup[] = snapshot.docs.map((d) => {
            const raw = d.data();
            return {
              id: raw.id || d.id,
              name: String(raw.name || ''),
              description: String(raw.description || ''),
              color: String(raw.color || '#000000'),
              icon: String(raw.icon || 'category'),
              nationalWeightIBGE:
                typeof raw.nationalWeightIBGE === 'number' ? raw.nationalWeightIBGE : undefined,
              isCustom: typeof raw.isCustom === 'boolean' ? raw.isCustom : true,
              active: typeof raw.active === 'boolean' ? raw.active : true,
            };
          });
          handlers.onConsumptionGroups(groups);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, groupsPath)
      )
    );

    const strategiesPath = `users/${uid}/strategies`;
    unsubs.push(
      onSnapshot(
        query(collection(db, strategiesPath), where('userId', '==', uid)),
        (snapshot) => {
          const plansA: SubstitutePlanA[] = [];
          const plansB: EfficiencyPlanB[] = [];
          const plansC: OpportunityPlanC[] = [];

          for (const d of snapshot.docs) {
            const raw = d.data();
            if (raw.planType === 'PLAN_A') {
              plansA.push({
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                originalItemId: String(raw.originalItemId || ''),
                originalItemName: String(raw.originalItemName || raw.title || ''),
                originalPrice: finiteNumber(raw.originalPrice, 0),
                originalPackageSize:
                  typeof raw.originalPackageSize === 'number' ? raw.originalPackageSize : undefined,
                originalPackageUnit:
                  typeof raw.originalPackageUnit === 'string' ? raw.originalPackageUnit : undefined,
                substituteName: String(raw.substituteName || ''),
                substitutePrice: finiteNumber(raw.substitutePrice, 0),
                substitutePackageSize:
                  typeof raw.substitutePackageSize === 'number'
                    ? raw.substitutePackageSize
                    : undefined,
                substitutePackageUnit:
                  typeof raw.substitutePackageUnit === 'string'
                    ? raw.substitutePackageUnit
                    : undefined,
                monthlyQuantity:
                  typeof raw.monthlyQuantity === 'number' ? raw.monthlyQuantity : undefined,
                monthlySavings: finiteNumber(raw.monthlySavings, 0),
                qualitativeTradeoff: String(raw.qualitativeTradeoff || raw.description || ''),
                applied: Boolean(raw.applied),
                status: sanitizeStrategyStatus(raw.status),
                unit: typeof raw.unit === 'string' ? raw.unit : undefined,
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
              });
            } else if (raw.planType === 'PLAN_B') {
              plansB.push({
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                resourceName: String(raw.resourceName || raw.title || ''),
                resourceCategory: sanitizeResourceCategory(raw.resourceCategory),
                unit: String(raw.unit || 'un'),
                tariffPerUnit: finiteNumber(raw.tariffPerUnit, 0),
                fixedFee: typeof raw.fixedFee === 'number' ? raw.fixedFee : undefined,
                extraCharges: typeof raw.extraCharges === 'number' ? raw.extraCharges : undefined,
                tariffSource: typeof raw.tariffSource === 'string' ? raw.tariffSource : undefined,
                tariffDate: typeof raw.tariffDate === 'string' ? raw.tariffDate : undefined,
                tieredTariffNote:
                  typeof raw.tieredTariffNote === 'string' ? raw.tieredTariffNote : undefined,
                currentConsumption: finiteNumber(raw.currentConsumption, 0),
                targetConsumption: finiteNumber(raw.targetConsumption, 0),
                currentSpend: finiteNumber(raw.currentSpend, 0),
                estimatedMonthlySavings: finiteNumber(raw.monthlySavings, 0),
                progressPercent: boundedNumber(raw.progressPercent, 0, 100, 0),
                status: sanitizeStrategyStatus(raw.status),
                applied: Boolean(raw.applied),
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
              });
            } else if (raw.planType === 'PLAN_C') {
              plansC.push({
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                initialCapital:
                  typeof raw.initialCapital === 'number' ? raw.initialCapital : undefined,
                monthlyInvestment: finiteNumber(raw.monthlyInvestment, 0),
                termMonths: typeof raw.termMonths === 'number' ? raw.termMonths : undefined,
                nominalAnnualRate: finiteNumber(raw.nominalAnnualRate, 0),
                expectedAnnualInflation: finiteNumber(raw.expectedAnnualInflation, 0),
                realAnnualYield: finiteNumber(raw.realAnnualYield, 0),
                projection12Months: finiteNumber(raw.projection12Months, 0),
                projection24Months: finiteNumber(raw.projection24Months, 0),
                projection36Months: finiteNumber(raw.projection36Months, 0),
                productType: sanitizeProductType(raw.productType),
                compoundingFrequency: sanitizeCompoundingFrequency(raw.compoundingFrequency),
                depositTiming: sanitizeDepositTiming(raw.depositTiming),
                taxMode: sanitizeTaxMode(raw.taxMode),
                manualTaxRate:
                  typeof raw.manualTaxRate === 'number' ? raw.manualTaxRate : undefined,
                adminFeeAnnual:
                  typeof raw.adminFeeAnnual === 'number' ? raw.adminFeeAnnual : undefined,
                custodyFeeAnnual:
                  typeof raw.custodyFeeAnnual === 'number' ? raw.custodyFeeAnnual : undefined,
                useLinkedSavings:
                  typeof raw.useLinkedSavings === 'boolean' ? raw.useLinkedSavings : undefined,
                status: sanitizeStrategyStatus(raw.status),
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
                isSimulated: false,
                updatedAt: raw.updatedAt ? timestampToIso(raw.updatedAt) : undefined,
              });
            }
          }

          handlers.onStrategies({ plansA, plansB, plansC, planC: plansC[0] });
        },
        (error) => handleFirestoreError(error, OperationType.LIST, strategiesPath)
      )
    );

    if (handlers.onMonthlyClosures) {
      const closuresPath = `users/${uid}/monthlyClosures`;
      unsubs.push(
        onSnapshot(
          query(collection(db, closuresPath), where('userId', '==', uid)),
          (snapshot) => {
            const closures: MonthlyClosure[] = snapshot.docs
              .map((d) => {
                const raw = d.data();
                return {
                  id: raw.id || d.id,
                  profileId: String(raw.profileId || ''),
                  monthKey: String(raw.monthKey || ''),
                  monthLabel: String(raw.monthLabel || raw.monthKey || ''),
                  profileMode: sanitizeProfileMode(raw.profileMode),
                  totalMonthlySpend: finiteNumber(raw.totalMonthlySpend, 0),
                  comparableBaseCost: finiteNumber(raw.comparableBaseCost, 0),
                  ipcaCasaPercent: finiteNumber(raw.ipcaCasaPercent, 0),
                  ipcaOficialPercent: finiteNumber(raw.ipcaOficialPercent, 0),
                  spreadPP: finiteNumber(raw.spreadPP, 0),
                  itemsCount: Math.round(finiteNumber(raw.itemsCount, 0)),
                  eligibleItemsCount: Math.round(finiteNumber(raw.eligibleItemsCount, 0)),
                  monthlyIncome:
                    typeof raw.monthlyIncome === 'number' ? raw.monthlyIncome : null,
                  monthlyBalance:
                    typeof raw.monthlyBalance === 'number' ? raw.monthlyBalance : null,
                  topCategory: typeof raw.topCategory === 'string' ? raw.topCategory : undefined,
                  topDriverName:
                    typeof raw.topDriverName === 'string' ? raw.topDriverName : undefined,
                  topDriverChangePercent:
                    typeof raw.topDriverChangePercent === 'number'
                      ? raw.topDriverChangePercent
                      : null,
                  priceEffectReais:
                    typeof raw.priceEffectReais === 'number' ? raw.priceEffectReais : undefined,
                  quantityEffectReais:
                    typeof raw.quantityEffectReais === 'number'
                      ? raw.quantityEffectReais
                      : undefined,
                  mixEffectReais:
                    typeof raw.mixEffectReais === 'number' ? raw.mixEffectReais : undefined,
                  ibgeSourceMode:
                    raw.ibgeSourceMode === 'live' ||
                    raw.ibgeSourceMode === 'cached_live' ||
                    raw.ibgeSourceMode === 'contingency'
                      ? raw.ibgeSourceMode
                      : undefined,
                  ibgeReferenceMonth:
                    typeof raw.ibgeReferenceMonth === 'string'
                      ? raw.ibgeReferenceMonth
                      : undefined,
                  dataOrigin: sanitizeDataOrigin(raw.dataOrigin),
                  notes: typeof raw.notes === 'string' ? raw.notes : undefined,
                  closedAt: String(raw.closedAt || ''),
                  createdAt: raw.createdAt ? timestampToIso(raw.createdAt) : undefined,
                  updatedAt: raw.updatedAt ? timestampToIso(raw.updatedAt) : undefined,
                };
              })
              .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
            handlers.onMonthlyClosures?.(closures);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, closuresPath)
        )
      );
    }

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }

  static async saveProfile(userId: string, profile: FamilyProfile): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const profileId = sanitizeFirestoreId(profile.id, 'prof');
    const path = `users/${uid}/profiles/${profileId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const payload = buildProfileWritePayload(profile, uid, !snap.exists());
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async saveMonthlyClosure(userId: string, closure: MonthlyClosure): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const profileId = sanitizeFirestoreId(closure.profileId, 'prof');
    const closureId = sanitizeFirestoreId(
      closure.id || `cls_${profileId}_${closure.monthKey}`,
      'cls'
    );
    const path = `users/${uid}/monthlyClosures/${closureId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const payload = buildMonthlyClosureWritePayload(
        { ...closure, id: closureId, profileId },
        uid,
        !snap.exists()
      );
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async deleteMonthlyClosure(userId: string, closureId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanId = sanitizeFirestoreId(closureId, 'cls');
    const path = `users/${uid}/monthlyClosures/${cleanId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  static async deleteProfile(userId: string, profileId: string): Promise<void> {
    if (!db) return;
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanProfileId = sanitizeFirestoreId(profileId, 'prof');

    try {
      const [itemsSnap, pricesSnap, incomeSnap, strategiesSnap, closuresSnap] = await Promise.all([
        getDocs(query(collection(firestore, `users/${uid}/basketItems`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/priceHistory`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/incomeHistory`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/strategies`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/monthlyClosures`), where('userId', '==', uid))),
      ]);

      const matchingItemDocs = itemsSnap.docs.filter((d) => d.data().profileId === cleanProfileId);
      const deletedItemIds = new Set(matchingItemDocs.map((d) => d.id));
      const matchingPriceDocs = pricesSnap.docs.filter((d) =>
        deletedItemIds.has(String(d.data().itemId || ''))
      );
      const matchingIncomeDocs = incomeSnap.docs.filter(
        (d) => d.data().profileId === cleanProfileId
      );
      const matchingStrategyDocs = strategiesSnap.docs.filter(
        (d) => d.data().profileId === cleanProfileId
      );
      const matchingClosureDocs = closuresSnap.docs.filter(
        (d) => d.data().profileId === cleanProfileId
      );

      const childOps: Array<(batch: WriteBatch) => void> = [];
      for (const d of matchingPriceDocs) childOps.push((batch) => batch.delete(d.ref));
      for (const d of matchingItemDocs) childOps.push((batch) => batch.delete(d.ref));
      for (const d of matchingIncomeDocs) childOps.push((batch) => batch.delete(d.ref));
      for (const d of matchingStrategyDocs) childOps.push((batch) => batch.delete(d.ref));
      for (const d of matchingClosureDocs) childOps.push((batch) => batch.delete(d.ref));
      await commitInChunks(childOps);

      await deleteDoc(doc(firestore, `users/${uid}/profiles/${cleanProfileId}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/profiles/${cleanProfileId}`);
    }
  }

  static async deleteAllUserFinancialData(userId: string, defaultProfileName?: string): Promise<void> {
    if (!db) return;
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');

    try {
      const [
        pricesSnap,
        itemsSnap,
        incomeSnap,
        strategiesSnap,
        closuresSnap,
        groupsSnap,
        profilesSnap,
      ] = await Promise.all([
        getDocs(query(collection(firestore, `users/${uid}/priceHistory`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/basketItems`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/incomeHistory`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/strategies`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/monthlyClosures`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/consumptionGroups`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/profiles`), where('userId', '==', uid))),
      ]);

      const childDeleteOps: Array<(batch: WriteBatch) => void> = [];
      for (const d of pricesSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of itemsSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of incomeSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of strategiesSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of closuresSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of groupsSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      await commitInChunks(childDeleteOps);

      const profileDeleteOps: Array<(batch: WriteBatch) => void> = profilesSnap.docs.map(
        (d) => (batch: WriteBatch) => batch.delete(d.ref)
      );
      await commitInChunks(profileDeleteOps);

      const defaultProfileId = sanitizeFirestoreId(`prof_${uid}`, 'prof');
      const cleanName = clampString(
        defaultProfileName || 'Meu Orçamento Familiar',
        BLUEPRINT_LIMITS.PROFILE_NAME_MAX,
        'Meu Orçamento Familiar'
      );
      await setDoc(doc(firestore, `users/${uid}/profiles/${defaultProfileId}`), {
        id: defaultProfileId,
        userId: uid,
        name: cleanName,
        membersCount: 2,
        referenceRegion: 'Brasil',
        currency: 'BRL',
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  }

  static async resyncBasketItemPriceFromHistory(userId: string, itemId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanItemId = sanitizeFirestoreId(itemId, 'item');
    const itemPath = `users/${uid}/basketItems/${cleanItemId}`;
    const itemRef = doc(db, itemPath);

    try {
      const [itemSnap, pricesSnap] = await Promise.all([
        getDoc(itemRef),
        getDocs(query(collection(db, `users/${uid}/priceHistory`), where('userId', '==', uid))),
      ]);
      if (!itemSnap.exists()) return;

      const itemPrices = pricesSnap.docs
        .map((d) => d.data())
        .filter(
          (p) =>
            p.itemId === cleanItemId &&
            p.comparabilityBroken !== true &&
            typeof p.price === 'number' &&
            Number.isFinite(p.price) &&
            p.price > 0
        )
        .sort((a, b) => {
          const cmp = String(b.referenceDate || '').localeCompare(String(a.referenceDate || ''));
          if (cmp !== 0) return cmp;
          return timestampToIso(b.createdAt).localeCompare(timestampToIso(a.createdAt));
        });

      if (itemPrices.length > 0) {
        const latest = itemPrices[0];
        const latestPrice = nonNegativeNumber(latest.price, 0);
        const latestDate = clampString(
          extractIsoDatePrefix(String(latest.referenceDate || '')) || getTodayIsoDate(),
          BLUEPRINT_LIMITS.DATE_MAX
        );
        const existingItem = itemSnap.data();
        if (existingItem.currentPrice !== latestPrice || existingItem.currentPriceDate !== latestDate) {
          await updateDoc(itemRef, {
            currentPrice: latestPrice,
            currentPriceDate: latestDate,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, itemPath);
    }
  }

  static async saveBasketItem(
    userId: string,
    item: BasketItem,
    recordInitialPrice = true
  ): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const itemId = sanitizeFirestoreId(item.id, 'item');
    const path = `users/${uid}/basketItems/${itemId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const existingData = snap.exists() ? snap.data() : null;
      const payload = buildBasketItemWritePayload({ ...item, id: itemId }, uid, !snap.exists());
      const nextPrice = nonNegativeNumber(item.currentPrice, 0);
      const nextDate = extractIsoDatePrefix(item.currentPriceDate) || getTodayIsoDate();
      const shouldRecordPrice =
        recordInitialPrice &&
        nextPrice > 0 &&
        (!existingData ||
          existingData.currentPrice !== nextPrice ||
          existingData.currentPriceDate !== nextDate);

      if (shouldRecordPrice) {
        const priceId = sanitizeFirestoreId(undefined, 'price');
        const priceRef = doc(db, `users/${uid}/priceHistory/${priceId}`);
        const pricePayload = buildPriceRecordWritePayload(
          {
            id: priceId,
            profileId: item.profileId,
            itemId,
            price: item.currentPrice,
            referenceDate: nextDate,
            unit: item.unit,
            packageSize: item.packageSize,
            packageUnit: item.packageUnit,
            dataOrigin: item.dataOrigin || 'usuario',
            comparabilityBroken: item.comparabilityBroken,
            source: item.notes || 'Atualização da Cesta',
          },
          uid,
          true
        );
        const batch = writeBatch(db);
        if (snap.exists()) {
          batch.update(ref, payload);
        } else {
          batch.set(ref, payload);
        }
        batch.set(priceRef, pricePayload);
        await batch.commit();
      } else if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async archiveBasketItem(userId: string, itemId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanItemId = sanitizeFirestoreId(itemId, 'item');
    const path = `users/${uid}/basketItems/${cleanItemId}`;
    try {
      await updateDoc(doc(db, path), {
        isArchived: true,
        active: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  static async addPriceRecord(
    userId: string,
    record: {
      id?: string;
      profileId?: string;
      itemId: string;
      price: number;
      referenceDate: string;
      unit?: string;
      source?: string;
      origin?: string;
      region?: string;
      packageSize?: number;
      packageUnit?: string;
      dataOrigin?: DataOrigin;
      comparabilityBroken?: boolean;
      notes?: string;
    },
    resyncItem = true
  ): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const priceId = sanitizeFirestoreId(record.id, 'price');
    const itemId = sanitizeFirestoreId(record.itemId, 'item');
    const path = `users/${uid}/priceHistory/${priceId}`;
    const payload = buildPriceRecordWritePayload({ ...record, id: priceId, itemId }, uid, true);

    try {
      await setDoc(doc(db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    if (resyncItem) {
      await this.resyncBasketItemPriceFromHistory(uid, itemId);
    }
  }

  static async updatePriceRecord(
    userId: string,
    priceId: string,
    updated: Partial<PriceRecord>
  ): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanPriceId = sanitizeFirestoreId(priceId, 'price');
    const path = `users/${uid}/priceHistory/${cleanPriceId}`;
    let resolvedItemId = updated.itemId ? sanitizeFirestoreId(updated.itemId, 'item') : '';

    try {
      if (!resolvedItemId) {
        const snap = await getDoc(doc(db, path));
        if (snap.exists()) {
          resolvedItemId = String(snap.data().itemId || '');
        }
      }
      const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (updated.price !== undefined) {
        payload.price = nonNegativeNumber(updated.price, 0);
      }
      if (updated.referenceDate !== undefined) {
        payload.referenceDate = clampString(
          extractIsoDatePrefix(updated.referenceDate) || getTodayIsoDate(),
          BLUEPRINT_LIMITS.DATE_MAX
        );
      }
      if (updated.unit !== undefined) {
        payload.unit = clampString(updated.unit, BLUEPRINT_LIMITS.UNIT_MAX);
      }
      if (updated.source !== undefined) {
        payload.source = clampString(updated.source, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
      }
      if (updated.origin !== undefined) {
        payload.origin = clampString(updated.origin, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
      }
      if (updated.region !== undefined) {
        payload.region = clampString(updated.region, BLUEPRINT_LIMITS.REGION_MAX);
      }
      if (updated.packageSize !== undefined && Number.isFinite(updated.packageSize)) {
        payload.packageSize = nonNegativeNumber(updated.packageSize, 0);
      }
      if (updated.packageUnit !== undefined) {
        payload.packageUnit = clampString(updated.packageUnit, BLUEPRINT_LIMITS.UNIT_MAX);
      }
      const origin = sanitizeDataOrigin(updated.dataOrigin);
      if (origin) payload.dataOrigin = origin;
      if (updated.comparabilityBroken !== undefined) {
        payload.comparabilityBroken = Boolean(updated.comparabilityBroken);
      }
      if (updated.notes !== undefined) {
        payload.notes = clampString(updated.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);
      }

      await updateDoc(doc(db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    if (resolvedItemId) {
      await this.resyncBasketItemPriceFromHistory(uid, resolvedItemId);
    }
  }

  static async deletePriceRecord(userId: string, priceId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanPriceId = sanitizeFirestoreId(priceId, 'price');
    const path = `users/${uid}/priceHistory/${cleanPriceId}`;
    let itemId = '';
    try {
      const snap = await getDoc(doc(db, path));
      if (snap.exists()) {
        itemId = String(snap.data().itemId || '');
      }
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    if (itemId) {
      await this.resyncBasketItemPriceFromHistory(uid, itemId);
    }
  }

  static async addIncomeRecord(
    userId: string,
    record: Omit<IncomeRecord, 'id'> & { id?: string }
  ): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const incomeId = sanitizeFirestoreId(record.id, 'inc');
    const path = `users/${uid}/incomeHistory/${incomeId}`;
    const payload = buildIncomeRecordWritePayload({ ...record, id: incomeId }, uid, true);
    try {
      await setDoc(doc(db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  static async updateIncomeRecord(
    userId: string,
    incomeId: string,
    updated: Partial<IncomeRecord>
  ): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanId = sanitizeFirestoreId(incomeId, 'inc');
    const path = `users/${uid}/incomeHistory/${cleanId}`;
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updated.referenceDate !== undefined) {
      payload.referenceDate = clampString(
        extractIsoDatePrefix(updated.referenceDate) || getTodayIsoDate(),
        BLUEPRINT_LIMITS.DATE_MAX
      );
    }
    if (updated.nominalIncome !== undefined) {
      payload.nominalIncome = nonNegativeNumber(updated.nominalIncome, 0);
    }
    if (updated.source !== undefined) {
      payload.source = clampString(updated.source, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
    }
    if (updated.notes !== undefined) {
      payload.notes = clampString(updated.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);
    }
    if (updated.grossIncome !== undefined) {
      payload.grossIncome = nonNegativeNumber(updated.grossIncome, 0);
    }
    if (updated.netIncome !== undefined) {
      payload.netIncome = nonNegativeNumber(updated.netIncome, 0);
    }
    if (updated.incomeType !== undefined) {
      payload.incomeType = clampString(updated.incomeType, BLUEPRINT_LIMITS.INCOME_TYPE_MAX);
    }
    if (updated.debtObligations !== undefined) {
      payload.debtObligations = nonNegativeNumber(updated.debtObligations, 0);
    }
    if (updated.financialApplications !== undefined) {
      payload.financialApplications = nonNegativeNumber(updated.financialApplications, 0);
    }
    if (updated.transfers !== undefined) {
      payload.transfers = nonNegativeNumber(updated.transfers, 0);
    }
    if (updated.availableReserve !== undefined) {
      payload.availableReserve = nonNegativeNumber(updated.availableReserve, 0);
    }
    if (updated.workingDaysPerMonth !== undefined) {
      payload.workingDaysPerMonth = boundedNumber(updated.workingDaysPerMonth, 1, 31, 22);
    }

    try {
      await updateDoc(doc(db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  static async deleteIncomeRecord(userId: string, incomeId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanId = sanitizeFirestoreId(incomeId, 'inc');
    const path = `users/${uid}/incomeHistory/${cleanId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  static async saveIncomeRange(
    userId: string,
    profileId: string,
    initialIncome: number,
    finalIncome: number,
    dates?: {
      initialDate?: string;
      finalDate?: string;
      grossIncome?: number;
      netIncome?: number;
      incomeType?: string;
      debtObligations?: number;
      financialApplications?: number;
      transfers?: number;
      availableReserve?: number;
      workingDaysPerMonth?: number;
    }
  ): Promise<void> {
    if (!db) return;
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const profId = sanitizeFirestoreId(profileId, 'prof');
    const inc1Id = sanitizeFirestoreId(`inc_init_${profId}`, 'inc');
    const inc2Id = sanitizeFirestoreId(`inc_curr_${profId}`, 'inc');

    const initialDate = clampString(
      extractIsoDatePrefix(dates?.initialDate) || getMonthsAgoIsoDate(12),
      BLUEPRINT_LIMITS.DATE_MAX
    );
    const finalDate = clampString(
      extractIsoDatePrefix(dates?.finalDate) || getTodayIsoDate(),
      BLUEPRINT_LIMITS.DATE_MAX
    );

    const saveOne = async (
      incomeId: string,
      recordFields: Omit<IncomeRecord, 'id'>
    ) => {
      const path = `users/${uid}/incomeHistory/${incomeId}`;
      const ref = doc(firestore, path);
      try {
        const snap = await getDoc(ref);
        const payload = buildIncomeRecordWritePayload(
          { ...recordFields, id: incomeId },
          uid,
          !snap.exists()
        );
        if (snap.exists()) {
          await updateDoc(ref, payload);
        } else {
          await setDoc(ref, payload);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    };

    await saveOne(inc1Id, {
      profileId: profId,
      referenceDate: initialDate,
      nominalIncome: nonNegativeNumber(initialIncome, 0),
      notes: 'Salário base inicial',
    });
    await saveOne(inc2Id, {
      profileId: profId,
      referenceDate: finalDate,
      nominalIncome: nonNegativeNumber(finalIncome, 0),
      notes: 'Salário após reajustes',
      grossIncome: dates?.grossIncome,
      netIncome: dates?.netIncome,
      incomeType: dates?.incomeType,
      debtObligations: dates?.debtObligations,
      financialApplications: dates?.financialApplications,
      transfers: dates?.transfers,
      availableReserve: dates?.availableReserve,
      workingDaysPerMonth: dates?.workingDaysPerMonth,
    });
  }

  static async saveConsumptionGroup(userId: string, group: ConsumptionGroup): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const groupId = sanitizeFirestoreId(group.id, 'grp');
    const path = `users/${uid}/consumptionGroups/${groupId}`;
    const ref = doc(db, path);

    const mutable: Record<string, unknown> = {
      name: clampString(group.name, BLUEPRINT_LIMITS.GROUP_NAME_MAX, 'Nova Categoria'),
      description: clampString(group.description || '', BLUEPRINT_LIMITS.GROUP_DESC_MAX),
      color: clampString(group.color, BLUEPRINT_LIMITS.COLOR_MAX, '#000000'),
      icon: clampString(group.icon, BLUEPRINT_LIMITS.ICON_MAX, 'category'),
      isCustom: group.isCustom !== false,
      active: group.active !== false,
      updatedAt: serverTimestamp(),
    };
    if (
      typeof group.nationalWeightIBGE === 'number' &&
      Number.isFinite(group.nationalWeightIBGE)
    ) {
      mutable.nationalWeightIBGE = Math.min(100, Math.max(0, group.nationalWeightIBGE));
    }

    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, mutable);
      } else {
        await setDoc(ref, {
          id: groupId,
          userId: uid,
          ...mutable,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async deleteConsumptionGroup(userId: string, groupId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanId = sanitizeFirestoreId(groupId, 'grp');
    const path = `users/${uid}/consumptionGroups/${cleanId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  static async saveStrategyPlanA(userId: string, plan: SubstitutePlanA): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const strategyId = sanitizeFirestoreId(plan.id, 'sub');
    const path = `users/${uid}/strategies/${strategyId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const payload = buildPlanAWritePayload({ ...plan, id: strategyId }, uid, !snap.exists());
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async saveStrategyPlanB(userId: string, plan: EfficiencyPlanB): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const strategyId = sanitizeFirestoreId(plan.id, 'eff');
    const path = `users/${uid}/strategies/${strategyId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const payload = buildPlanBWritePayload({ ...plan, id: strategyId }, uid, !snap.exists());
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async saveStrategyPlanC(userId: string, plan: OpportunityPlanC): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const profileId = sanitizeFirestoreId(plan.profileId, 'prof');
    const strategyId = sanitizeFirestoreId(plan.id || `opp_${profileId}`, 'opp');
    const path = `users/${uid}/strategies/${strategyId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const payload = buildPlanCWritePayload(
        { ...plan, id: strategyId, profileId },
        uid,
        !snap.exists()
      );
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async deleteStrategy(userId: string, strategyId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanId = sanitizeFirestoreId(strategyId, 'str');
    const path = `users/${uid}/strategies/${cleanId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  static async migrateLegacyBundle(
    userId: string,
    bundle: LegacyLocalBundle,
    fallbackProfileId: string
  ): Promise<void> {
    if (!db) {
      throw new Error('Cloud Firestore não está configurado para migração.');
    }
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const defaultProfileId = sanitizeFirestoreId(fallbackProfileId || `prof_${uid}`, 'prof');

    try {
      const [
        existingProfilesSnap,
        existingGroupsSnap,
        existingItemsSnap,
        existingIncomeSnap,
        existingStrategiesSnap,
        existingPricesSnap,
      ] = await Promise.all([
        getDocs(query(collection(firestore, `users/${uid}/profiles`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/consumptionGroups`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/basketItems`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/incomeHistory`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/strategies`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/priceHistory`), where('userId', '==', uid))),
      ]);

      const existingProfileIds = new Set(existingProfilesSnap.docs.map((d) => d.id));
      const existingGroupIds = new Set(existingGroupsSnap.docs.map((d) => d.id));
      const existingItemIds = new Set(existingItemsSnap.docs.map((d) => d.id));
      const existingIncomeIds = new Set(existingIncomeSnap.docs.map((d) => d.id));
      const existingStrategyIds = new Set(existingStrategiesSnap.docs.map((d) => d.id));
      const existingPriceIds = new Set(existingPricesSnap.docs.map((d) => d.id));

      const profileIdMap = new Map<string, string>();
      const parentOps: Array<(batch: WriteBatch) => void> = [];

      for (const prof of bundle.profiles) {
        const cleanId = sanitizeFirestoreId(prof.id, 'prof');
        profileIdMap.set(prof.id, cleanId);
        const ref = doc(firestore, `users/${uid}/profiles/${cleanId}`);
        const exists = existingProfileIds.has(cleanId);
        const payload = buildProfileWritePayload({ ...prof, id: cleanId }, uid, !exists);
        parentOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
        existingProfileIds.add(cleanId);
      }

      const resolveTargetProfileId = (legacyPid: string | undefined): string => {
        if (!legacyPid) return defaultProfileId;
        if (profileIdMap.has(legacyPid)) return profileIdMap.get(legacyPid)!;
        const cleanFallback = sanitizeFirestoreId(legacyPid, 'prof');
        if (existingProfileIds.has(cleanFallback)) return cleanFallback;
        return defaultProfileId;
      };

      for (const grp of bundle.customGroups) {
        const cleanGroupId = sanitizeFirestoreId(grp.id, 'grp');
        const ref = doc(firestore, `users/${uid}/consumptionGroups/${cleanGroupId}`);
        const exists = existingGroupIds.has(cleanGroupId);
        const mutable: Record<string, unknown> = {
          name: clampString(grp.name, BLUEPRINT_LIMITS.GROUP_NAME_MAX, 'Categoria'),
          description: clampString(grp.description || '', BLUEPRINT_LIMITS.GROUP_DESC_MAX),
          color: clampString(grp.color, BLUEPRINT_LIMITS.COLOR_MAX, '#000000'),
          icon: clampString(grp.icon, BLUEPRINT_LIMITS.ICON_MAX, 'category'),
          isCustom: grp.isCustom !== false,
          active: grp.active !== false,
          updatedAt: serverTimestamp(),
        };
        if (typeof grp.nationalWeightIBGE === 'number' && Number.isFinite(grp.nationalWeightIBGE)) {
          mutable.nationalWeightIBGE = boundedNumber(grp.nationalWeightIBGE, 0, 100, 0);
        }
        parentOps.push((batch) => {
          if (exists) batch.update(ref, mutable);
          else {
            batch.set(ref, {
              id: cleanGroupId,
              userId: uid,
              ...mutable,
              createdAt: serverTimestamp(),
            });
          }
        });
      }

      await commitInChunks(parentOps);

      const itemIdMap = new Map<string, string>();
      const childOps: Array<(batch: WriteBatch) => void> = [];

      for (const item of bundle.basketItems) {
        const cleanItemId = sanitizeFirestoreId(item.id, 'item');
        const targetProfileId = resolveTargetProfileId(item.profileId);
        itemIdMap.set(item.id, cleanItemId);
        const ref = doc(firestore, `users/${uid}/basketItems/${cleanItemId}`);
        const exists = existingItemIds.has(cleanItemId);
        const payload = buildBasketItemWritePayload(
          { ...item, id: cleanItemId, profileId: targetProfileId },
          uid,
          !exists
        );
        childOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
      }

      for (const inc of bundle.incomeHistory) {
        const cleanIncId = sanitizeFirestoreId(inc.id, 'inc');
        const targetProfileId = resolveTargetProfileId(inc.profileId);
        const ref = doc(firestore, `users/${uid}/incomeHistory/${cleanIncId}`);
        const exists = existingIncomeIds.has(cleanIncId);
        const payload = buildIncomeRecordWritePayload(
          { ...inc, id: cleanIncId, profileId: targetProfileId },
          uid,
          !exists
        );
        childOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
      }

      for (const planA of bundle.plansA) {
        const cleanId = sanitizeFirestoreId(planA.id, 'sub');
        const targetProfileId = resolveTargetProfileId(planA.profileId);
        const ref = doc(firestore, `users/${uid}/strategies/${cleanId}`);
        const exists = existingStrategyIds.has(cleanId);
        const payload = buildPlanAWritePayload(
          { ...planA, id: cleanId, profileId: targetProfileId },
          uid,
          !exists
        );
        childOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
      }

      for (const planB of bundle.plansB) {
        const cleanId = sanitizeFirestoreId(planB.id, 'eff');
        const targetProfileId = resolveTargetProfileId(planB.profileId);
        const ref = doc(firestore, `users/${uid}/strategies/${cleanId}`);
        const exists = existingStrategyIds.has(cleanId);
        const payload = buildPlanBWritePayload(
          { ...planB, id: cleanId, profileId: targetProfileId },
          uid,
          !exists
        );
        childOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
      }

      for (const planC of bundle.plansC) {
        const targetProfileId = resolveTargetProfileId(planC.profileId);
        const cleanId = sanitizeFirestoreId(planC.id || `opp_${targetProfileId}`, 'opp');
        const ref = doc(firestore, `users/${uid}/strategies/${cleanId}`);
        const exists = existingStrategyIds.has(cleanId);
        const payload = buildPlanCWritePayload(
          { ...planC, id: cleanId, profileId: targetProfileId },
          uid,
          !exists
        );
        childOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
      }

      await commitInChunks(childOps);

      const priceOps: Array<(batch: WriteBatch) => void> = [];
      for (const price of bundle.priceHistory) {
        const targetItemId = itemIdMap.get(price.itemId);
        if (!targetItemId) continue;
        const cleanPriceId = sanitizeFirestoreId(price.id, 'price');
        if (existingPriceIds.has(cleanPriceId)) continue;
        const ref = doc(firestore, `users/${uid}/priceHistory/${cleanPriceId}`);
        const payload = buildPriceRecordWritePayload(
          { ...price, id: cleanPriceId, itemId: targetItemId },
          uid,
          true
        );
        priceOps.push((batch) => batch.set(ref, payload));
      }

      await commitInChunks(priceOps);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/migrateLegacyBundle`);
    }
  }

  static async saveOnboardingBundle(params: {
    userId: string;
    profile: FamilyProfile;
    initialIncome: number;
    currentIncome: number;
    items: BasketItem[];
  }): Promise<void> {
    await this.saveProfile(params.userId, params.profile);
    await this.saveIncomeRange(
      params.userId,
      params.profile.id,
      params.initialIncome,
      params.currentIncome
    );
    await Promise.all(
      params.items.map((item) =>
        this.saveBasketItem(params.userId, { ...item, profileId: params.profile.id }, false)
      )
    );
  }
}
