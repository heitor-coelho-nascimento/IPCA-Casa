/**
 * IPCA-Casa: Motor Centralizado de Cálculos Econômicos, Estatísticos e Financeiros
 * Fonte única de verdade para inflação doméstica (Laspeyres / encadeado), orçamento,
 * poder de compra, correção monetária, equivalência de trabalho, cotações, Planos A/B/C e cenários.
 */

import {
  AccountingType,
  BasketItem,
  BudgetDecomposition,
  CalculatedBasketItem,
  CalculatedItem,
  CalculationTrace,
  ChainedSeriesPoint,
  ComparablePriceAlert,
  CompoundingFrequency,
  DataCompletenessState,
  DataOrigin,
  DepositTiming,
  EconomicCalculationSummary,
  EconomicScenarioInput,
  EconomicScenarioResult,
  EfficiencyPlanB,
  FamilyProfile,
  GroupContribution,
  HouseholdIndicators,
  IncomeRecord,
  InvestmentProductType,
  LaspeyresResult,
  MonetaryCorrectionResult,
  MonthlyClosure,
  NormalizedQuoteStats,
  OpportunityPlanC,
  PlanCScheduleRow,
  PlanCSimulationResult,
  PocketImpactBreakdown,
  PriceRecord,
  ProfileMode,
  PurchasingPowerAnalysis,
  ReportExportPayload,
  SensitivityCell,
  StructuredRecommendation,
  SubstitutePlanA,
  TaxMode,
  TimeframeWindow,
  WorkingDaysEquivalenceResult,
} from '../types';
import {
  extractIsoDatePrefix,
  formatDateRangeLabel,
  getMonthsAgoIsoDate,
  getTodayIsoDate,
  getYearStartIsoDate,
} from '../utils/dates';
import { formatCurrencyBR, formatSignedPP, formatSignedPercent, normalizeZero, roundDisplay } from '../utils/formatters';
import {
  areUnitsCompatible,
  calculateNormalizedUnitPrice,
  compareNormalizedUnitPrices,
  frequencyToMonthlyMultiplier,
  resolveUnitDefinition,
} from './units';

export interface ProcessEconomicsOptions {
  customStartDate?: string;
  customEndDate?: string;
  priceHistory?: PriceRecord[];
  incomeRecords?: IncomeRecord[];
  workingDaysPerMonth?: number;
  isDemo?: boolean;
  officialGroups?: Array<{ name: string }>;
}

const OFFICIAL_GROUP_NAMES = new Set([
  'Alimentação e bebidas',
  'Habitação',
  'Artigos de residência',
  'Vestuário',
  'Transportes',
  'Saúde e cuidados pessoais',
  'Despesas pessoais',
  'Educação',
  'Comunicação',
]);

const NON_CONSUMPTION_TYPES = new Set<AccountingType>([
  'Amortização de dívida',
  'Aplicação financeira',
  'Transferência',
]);

export function isConsumptionAccountingType(type?: AccountingType): boolean {
  return !type || !NON_CONSUMPTION_TYPES.has(type);
}

/**
 * Resolve o gasto mensal efetivo de um item, aplicando conversão de periodicidade quando necessário:
 * - Mensal: 1×
 * - Quinzenal / N dias: 30 / dias (convenção explícita de 30 dias)
 * - Semanal: 30 / 7 (convenção explícita de 30 dias)
 * - Diária: 30×
 * - Anual: valor / 12 (equivalência mensal explícita)
 */
export function resolveEffectiveMonthlySpend(item: BasketItem): {
  monthlySpend: number;
  isMonthlyEquivalence: boolean;
  monthlyEquivalenceNote?: string;
} {
  const rawSpend = Number(item.monthlySpend);
  const safeStoredSpend = Number.isFinite(rawSpend) && rawSpend >= 0 ? rawSpend : 0;

  if (!item.consumptionFrequency || item.consumptionFrequency === 'mensal') {
    if (safeStoredSpend > 0) {
      return { monthlySpend: normalizeZero(safeStoredSpend), isMonthlyEquivalence: false };
    }
    const qty = Number(item.quantity);
    const p1 = Number(item.currentPrice);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(p1) && p1 >= 0) {
      return { monthlySpend: normalizeZero(qty * p1), isMonthlyEquivalence: false };
    }
    return { monthlySpend: 0, isMonthlyEquivalence: false };
  }

  const freqInfo = frequencyToMonthlyMultiplier(item.consumptionFrequency, item.frequencyDays);
  if (!freqInfo.valid) {
    return { monthlySpend: normalizeZero(safeStoredSpend), isMonthlyEquivalence: false };
  }

  // Se o usuário já informou monthlySpend explicitamente no cadastro com periodicidade convertida, preserva o valor mensal,
  // ou calcula a partir de quantity * currentPrice * fator quando quantity estiver preenchido e monthlySpend for zero.
  if (safeStoredSpend > 0) {
    return {
      monthlySpend: normalizeZero(safeStoredSpend),
      isMonthlyEquivalence: freqInfo.isEstimatedEquivalence,
      monthlyEquivalenceNote: freqInfo.isEstimatedEquivalence ? freqInfo.note : undefined,
    };
  }

  const qty = Number(item.quantity);
  const p1 = Number(item.currentPrice);
  if (Number.isFinite(qty) && qty > 0 && Number.isFinite(p1) && p1 >= 0) {
    return {
      monthlySpend: normalizeZero(qty * p1 * freqInfo.multiplierToMonthly),
      isMonthlyEquivalence: freqInfo.isEstimatedEquivalence,
      monthlyEquivalenceNote: freqInfo.isEstimatedEquivalence ? freqInfo.note : undefined,
    };
  }

  return {
    monthlySpend: 0,
    isMonthlyEquivalence: freqInfo.isEstimatedEquivalence,
    monthlyEquivalenceNote: freqInfo.isEstimatedEquivalence ? freqInfo.note : undefined,
  };
}

/**
 * 6.1 Gasto Mensal Total de Consumo (exclui amortizações de dívida, aplicações financeiras e transferências §21)
 */
export function calculateTotalMonthlySpend(items: BasketItem[]): number {
  if (!items || items.length === 0) return 0;
  return normalizeZero(
    items.reduce((acc, item) => {
      if (!item.active || item.isArchived) return acc;
      if (!isConsumptionAccountingType(item.accountingType)) return acc;
      const spend = resolveEffectiveMonthlySpend(item).monthlySpend;
      return acc + (!Number.isFinite(spend) || spend < 0 ? 0 : spend);
    }, 0)
  );
}

/**
 * Soma agregada por categoria contábil não-consumo (§21)
 */
export function calculateNonConsumptionFlows(items: BasketItem[]): {
  debtObligations: number;
  financialApplications: number;
  transfers: number;
  totalNonConsumption: number;
} {
  let debtObligations = 0;
  let financialApplications = 0;
  let transfers = 0;

  for (const item of items || []) {
    if (!item.active || item.isArchived) continue;
    const spend = resolveEffectiveMonthlySpend(item).monthlySpend;
    if (!Number.isFinite(spend) || spend <= 0) continue;
    if (item.accountingType === 'Amortização de dívida') debtObligations += spend;
    else if (item.accountingType === 'Aplicação financeira') financialApplications += spend;
    else if (item.accountingType === 'Transferência') transfers += spend;
  }

  return {
    debtObligations: normalizeZero(debtObligations),
    financialApplications: normalizeZero(financialApplications),
    transfers: normalizeZero(transfers),
    totalNonConsumption: normalizeZero(debtObligations + financialApplications + transfers),
  };
}

/**
 * 6.2 Peso Orçamentário de um Item (%)
 * w_i(%) = (G_i / G_total) * 100
 */
export function calculateItemWeight(itemSpend: number, totalSpend: number): number {
  if (!Number.isFinite(totalSpend) || totalSpend <= 0) return 0;
  if (!Number.isFinite(itemSpend) || itemSpend < 0) return 0;
  return normalizeZero((itemSpend / totalSpend) * 100);
}

/**
 * 6.3 Variação Nominal Individual de Preços
 * ΔP_i = ((P_1 / P_0) - 1) * 100
 * Retorna null se P_0 <= 0, P_1 < 0 ou não finito.
 */
export function calculatePriceVariation(
  oldPrice: number | null | undefined,
  currentPrice: number | null | undefined
): number | null {
  if (
    oldPrice === null ||
    oldPrice === undefined ||
    currentPrice === null ||
    currentPrice === undefined
  ) {
    return null;
  }
  const p0 = Number(oldPrice);
  const p1 = Number(currentPrice);
  if (!Number.isFinite(p0) || !Number.isFinite(p1) || p0 <= 0 || p1 < 0) {
    return null;
  }
  return roundDisplay(((p1 / p0) - 1) * 100, 8);
}

/**
 * Variação percentual normalizada por embalagem/unidade canônica (§8, §10)
 */
export function calculateNormalizedPriceVariation(params: {
  oldPrice: number;
  currentPrice: number;
  oldPackageSize?: number;
  oldPackageUnit?: string;
  currentPackageSize?: number;
  currentPackageUnit?: string;
  comparabilityBroken?: boolean;
}): {
  comparable: boolean;
  variationPercent: number | null;
  normalizedOldUnitPrice: number | null;
  normalizedCurrentUnitPrice: number | null;
  canonicalUnit: string;
  reason?: string;
} {
  const unit = resolveUnitDefinition(params.currentPackageUnit || params.oldPackageUnit || 'un');
  if (params.comparabilityBroken) {
    return {
      comparable: false,
      variationPercent: null,
      normalizedOldUnitPrice: null,
      normalizedCurrentUnitPrice: null,
      canonicalUnit: unit.canonicalUnit,
      reason: 'Quebra de comparabilidade sinalizada pelo usuário (alteração relevante de especificação/qualidade).',
    };
  }

  const oldPackUnit = params.oldPackageUnit || params.currentPackageUnit || 'un';
  const curPackUnit = params.currentPackageUnit || params.oldPackageUnit || 'un';
  if (!areUnitsCompatible(oldPackUnit, curPackUnit)) {
    return {
      comparable: false,
      variationPercent: null,
      normalizedOldUnitPrice: null,
      normalizedCurrentUnitPrice: null,
      canonicalUnit: `${oldPackUnit} vs ${curPackUnit}`,
      reason: `Unidades incompatíveis (${oldPackUnit} vs ${curPackUnit})`,
    };
  }

  const oldSize = params.oldPackageSize && params.oldPackageSize > 0 ? params.oldPackageSize : 1;
  const curSize = params.currentPackageSize && params.currentPackageSize > 0 ? params.currentPackageSize : oldSize;

  const normOld = calculateNormalizedUnitPrice(params.oldPrice, oldSize, oldPackUnit);
  const normCur = calculateNormalizedUnitPrice(params.currentPrice, curSize, curPackUnit);

  if (
    !normOld.valid ||
    !normCur.valid ||
    normOld.normalizedPrice === null ||
    normCur.normalizedPrice === null ||
    normOld.normalizedPrice <= 0
  ) {
    return {
      comparable: false,
      variationPercent: null,
      normalizedOldUnitPrice: normOld.normalizedPrice,
      normalizedCurrentUnitPrice: normCur.normalizedPrice,
      canonicalUnit: normCur.canonicalUnit,
      reason: 'Preços-base inválidos ou ausentes para cálculo de variação.',
    };
  }

  const pct = normalizeZero(((normCur.normalizedPrice / normOld.normalizedPrice) - 1) * 100);
  return {
    comparable: true,
    variationPercent: pct,
    normalizedOldUnitPrice: normOld.normalizedPrice,
    normalizedCurrentUnitPrice: normCur.normalizedPrice,
    canonicalUnit: normCur.canonicalUnit,
  };
}

/**
 * 6.4 Contribuição Ponderada de um Item
 * C_i = (w_i / 100) * ΔP_i  (expresso em pontos percentuais p.p.)
 */
export function calculateWeightedContribution(
  weightPercent: number,
  priceChangePercent: number | null
): number {
  if (
    priceChangePercent === null ||
    !Number.isFinite(priceChangePercent) ||
    !Number.isFinite(weightPercent)
  ) {
    return 0;
  }
  return normalizeZero((weightPercent / 100) * priceChangePercent);
}

/**
 * Determina o nível de impacto qualitativo de um item na inflação familiar
 */
export function determineImpactLevel(
  priceChangePercent: number | null,
  weightedContribution: number
): CalculatedItem['impactLevel'] {
  if (priceChangePercent === null || !Number.isFinite(priceChangePercent)) {
    return 'Incompleto';
  }
  if (priceChangePercent < 0) {
    return 'Alívio';
  }
  if (weightedContribution >= 1.0) {
    return 'Crítico';
  }
  if (weightedContribution >= 0.5) {
    return 'Alto';
  }
  if (weightedContribution >= 0.15) {
    return 'Moderado';
  }
  if (Math.abs(priceChangePercent) < 0.01) {
    return 'Estável';
  }
  return 'Baixo';
}

/**
 * 12. Índice Clássico de Laspeyres:
 * IL = [Σ(P1 × Q0) / Σ(P0 × Q0)] × 100
 * Variação percentual = IL - 100
 */
export function calculateClassicalLaspeyres(
  entries: Array<{ p0: number; p1: number; q0: number }>
): {
  valid: boolean;
  indexValue: number | null;
  variationPercent: number | null;
  baseCost: number;
  currentCostOfBase: number;
} {
  let baseCost = 0;
  let currentCostOfBase = 0;
  let validCount = 0;

  for (const row of entries || []) {
    if (
      Number.isFinite(row.p0) &&
      Number.isFinite(row.p1) &&
      Number.isFinite(row.q0) &&
      row.p0 > 0 &&
      row.p1 >= 0 &&
      row.q0 > 0
    ) {
      baseCost += row.p0 * row.q0;
      currentCostOfBase += row.p1 * row.q0;
      validCount += 1;
    }
  }

  if (validCount === 0 || baseCost <= 0) {
    return {
      valid: false,
      indexValue: null,
      variationPercent: null,
      baseCost: 0,
      currentCostOfBase: 0,
    };
  }

  const indexValue = normalizeZero((currentCostOfBase / baseCost) * 100);
  const variationPercent = normalizeZero(indexValue - 100);
  return {
    valid: true,
    indexValue,
    variationPercent,
    baseCost: normalizeZero(baseCost),
    currentCostOfBase: normalizeZero(currentCostOfBase),
  };
}

/**
 * 13. Índice Encadeado Mensal a partir do histórico de cotações
 */
export function calculateChainedMonthlyIndex(
  items: BasketItem[],
  priceHistory: PriceRecord[]
): ChainedSeriesPoint[] {
  const consumptionItems = (items || []).filter(
    (it) => it.active && !it.isArchived && isConsumptionAccountingType(it.accountingType) && !it.comparabilityBroken
  );
  if (consumptionItems.length === 0 || !priceHistory || priceHistory.length < 2) {
    return [];
  }

  const itemById = new Map<string, BasketItem>(consumptionItems.map((it) => [it.id, it]));
  // Mapa monthCode ('YYYY-MM') -> Map<itemId, { price, date }>
  const monthBuckets = new Map<string, Map<string, { price: number; date: string }>>();

  for (const rec of priceHistory) {
    if (rec.comparabilityBroken) continue;
    const item = itemById.get(rec.itemId);
    if (!item) continue;
    if (!Number.isFinite(rec.price) || rec.price <= 0) continue;
    const iso = extractIsoDatePrefix(rec.referenceDate || rec.date);
    if (!iso) continue;
    const ym = iso.slice(0, 7);
    if (!monthBuckets.has(ym)) monthBuckets.set(ym, new Map());
    const bucket = monthBuckets.get(ym)!;
    const prev = bucket.get(rec.itemId);
    if (!prev || iso >= prev.date) {
      bucket.set(rec.itemId, { price: rec.price, date: iso });
    }
  }

  const sortedMonths = Array.from(monthBuckets.keys()).sort();
  if (sortedMonths.length < 2) return [];

  const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const formatYM = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${MONTHS_PT[Math.max(0, Math.min(11, Number(m) - 1))] || m}/${y.slice(-2)}`;
  };

  const series: ChainedSeriesPoint[] = [];
  let chainedIndex = 100;
  let prevMatchedKeys = '';

  series.push({
    monthCode: sortedMonths[0].replace('-', ''),
    label: formatYM(sortedMonths[0]),
    monthlyChangePercent: 0,
    chainedIndexValue: 100,
    accumulatedPercent: 0,
    comparableItemsCount: monthBuckets.get(sortedMonths[0])!.size,
    coveragePercent:
      consumptionItems.length > 0
        ? normalizeZero((monthBuckets.get(sortedMonths[0])!.size / consumptionItems.length) * 100)
        : 0,
    compositionChanged: false,
  });

  for (let i = 1; i < sortedMonths.length; i++) {
    const prevYM = sortedMonths[i - 1];
    const currYM = sortedMonths[i];
    const prevMap = monthBuckets.get(prevYM)!;
    const currMap = monthBuckets.get(currYM)!;

    let sumBase = 0;
    let sumCurr = 0;
    const matchedIds: string[] = [];

    for (const [itemId, currEntry] of currMap.entries()) {
      const prevEntry = prevMap.get(itemId);
      if (!prevEntry || prevEntry.price <= 0) continue;
      const item = itemById.get(itemId)!;
      const effSpend = resolveEffectiveMonthlySpend(item).monthlySpend;
      const explicitQ = Number(item.baseQuantity ?? item.quantity);
      const freqMult = frequencyToMonthlyMultiplier(item.consumptionFrequency, item.frequencyDays);
      const monthlyFactorQ = freqMult.valid ? freqMult.multiplierToMonthly : 1;
      const qRef =
        Number.isFinite(explicitQ) && explicitQ > 0
          ? explicitQ * monthlyFactorQ
          : effSpend > 0
          ? effSpend / prevEntry.price
          : 1;
      sumBase += prevEntry.price * qRef;
      sumCurr += currEntry.price * qRef;
      matchedIds.push(itemId);
    }

    if (sumBase <= 0 || matchedIds.length === 0) {
      continue;
    }

    const monthlyFactor = sumCurr / sumBase;
    chainedIndex *= monthlyFactor;
    const keysStr = matchedIds.sort().join(',');
    const compositionChanged = prevMatchedKeys !== '' && prevMatchedKeys !== keysStr;
    prevMatchedKeys = keysStr;

    series.push({
      monthCode: currYM.replace('-', ''),
      label: formatYM(currYM),
      monthlyChangePercent: normalizeZero((monthlyFactor - 1) * 100),
      chainedIndexValue: normalizeZero(chainedIndex),
      accumulatedPercent: normalizeZero(((chainedIndex / 100) - 1) * 100),
      comparableItemsCount: matchedIds.length,
      coveragePercent:
        consumptionItems.length > 0
          ? normalizeZero((matchedIds.length / consumptionItems.length) * 100)
          : 0,
      compositionChanged,
    });
  }

  return series.length >= 2 ? series : [];
}

/**
 * 6.5 Cálculo Consolidado do IPCA-Casa
 * IPCA_Casa = SUM(C_i)
 */
export function calculateIpcaCasa(calculatedItems: CalculatedItem[]): number {
  if (!calculatedItems || calculatedItems.length === 0) return 0;
  const total = calculatedItems.reduce((acc, item) => {
    if (
      item.priceChangePercent === null ||
      !Number.isFinite(item.weightedContribution)
    ) {
      return acc;
    }
    return acc + item.weightedContribution;
  }, 0);
  return normalizeZero(total);
}

/**
 * 6.6 Acumulação Geométrica de Taxas Mensais
 * pi_acum = [ PRODUCT(1 + pi_t / 100) - 1 ] * 100
 */
export function calculateAccumulatedInflation(monthlyRates: number[]): number {
  if (!monthlyRates || monthlyRates.length === 0) return 0;
  const validRates = monthlyRates.filter(
    (rate) => Number.isFinite(rate) && 1 + rate / 100 > 0
  );
  if (validRates.length === 0) return 0;
  const product = validRates.reduce((acc, rate) => acc * (1 + rate / 100), 1);
  return normalizeZero((product - 1) * 100);
}

/**
 * 6.6 Diferença (Spread) em pontos percentuais
 * D = IPCA_Casa - IPCA_Oficial
 */
export function calculateSpreadPP(ipcaCasa: number, ipcaOfficial: number): number {
  if (!Number.isFinite(ipcaCasa) || !Number.isFinite(ipcaOfficial)) return 0;
  return normalizeZero(ipcaCasa - ipcaOfficial);
}

/**
 * 6.7 Variação Nominal da Renda
 * g = ((R_1 - R_0) / R_0) * 100
 */
export function calculateNominalIncomeGrowth(
  initialIncome: number | null | undefined,
  finalIncome: number | null | undefined
): number | null {
  if (
    initialIncome === null ||
    initialIncome === undefined ||
    finalIncome === null ||
    finalIncome === undefined ||
    !Number.isFinite(initialIncome) ||
    !Number.isFinite(finalIncome) ||
    initialIncome <= 0 ||
    finalIncome < 0
  ) {
    return null;
  }
  return normalizeZero(((finalIncome - initialIncome) / initialIncome) * 100);
}

/**
 * 6.7 Variação Real do Poder de Compra (Equação de Fisher)
 * r = [ (1 + g/100) / (1 + pi/100) - 1 ] * 100
 */
export function calculateRealPurchasingPowerChange(
  nominalIncomeGrowthPercent: number | null,
  inflationPercent: number
): number | null {
  if (
    nominalIncomeGrowthPercent === null ||
    !Number.isFinite(nominalIncomeGrowthPercent) ||
    !Number.isFinite(inflationPercent)
  ) {
    return null;
  }
  const denominator = 1 + inflationPercent / 100;
  if (denominator <= 0) {
    return null;
  }
  const numerator = 1 + nominalIncomeGrowthPercent / 100;
  if (numerator < 0) {
    return null;
  }
  return normalizeZero((numerator / denominator - 1) * 100);
}

/**
 * 6.7 Salário Necessário para Manutenção ou Ganho Real de Poder de Compra
 * R_necessaria = R_0 * (1 + pi/100) * (1 + targetRealGain/100)
 */
export function calculateNeededSalary(
  initialIncome: number | null | undefined,
  inflationPercent: number,
  targetRealGainPercent = 0
): number | null {
  if (
    initialIncome === null ||
    initialIncome === undefined ||
    !Number.isFinite(initialIncome) ||
    initialIncome <= 0 ||
    !Number.isFinite(inflationPercent) ||
    !Number.isFinite(targetRealGainPercent)
  ) {
    return null;
  }
  const inflationFactor = 1 + inflationPercent / 100;
  const realGainFactor = 1 + targetRealGainPercent / 100;
  if (inflationFactor <= 0 || realGainFactor < 0) {
    return null;
  }
  return normalizeZero(initialIncome * inflationFactor * realGainFactor);
}

/**
 * Plano B: Redução física do consumo (%)
 */
export function calculateConsumptionReduction(
  initialConsumption: number,
  targetConsumption: number
): number | null {
  if (
    !Number.isFinite(initialConsumption) ||
    !Number.isFinite(targetConsumption) ||
    initialConsumption <= 0 ||
    targetConsumption < 0
  ) {
    return null;
  }
  return normalizeZero(((initialConsumption - targetConsumption) / initialConsumption) * 100);
}

/**
 * Equação de Fisher para Rentabilidade Real
 * r_real = [ (1 + i_nominal / 100) / (1 + pi_inflacao / 100) - 1 ] * 100
 */
export function calculateFisherRealYield(
  nominalAnnualRate: number,
  expectedInflation: number
): number {
  if (!Number.isFinite(nominalAnnualRate) || !Number.isFinite(expectedInflation)) {
    return 0;
  }
  const nominalFactor = 1 + nominalAnnualRate / 100;
  const inflationFactor = 1 + expectedInflation / 100;
  if (inflationFactor <= 0 || nominalFactor < 0) return 0;
  return normalizeZero((nominalFactor / inflationFactor - 1) * 100);
}

/**
 * Converte taxa anual efetiva (%) para taxa mensal equivalente (§23)
 * Taxa mensal equivalente = (1 + r_anual)^(1/12) - 1
 */
export function annualToMonthlyEffectiveRate(annualRatePercent: number): number {
  if (!Number.isFinite(annualRatePercent) || annualRatePercent <= -100) return 0;
  return normalizeZero(Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1);
}

/**
 * Projeção de despesa futura sob taxa anual efetiva (§23)
 * Despesa futura = Despesa atual × (1 + i_mensal)^n
 */
export function calculateFutureProjection(
  currentAmount: number,
  annualRatePercent: number,
  months: number
): number {
  if (!Number.isFinite(currentAmount) || currentAmount < 0 || !Number.isFinite(months) || months < 0) {
    return 0;
  }
  const monthlyRate = annualToMonthlyEffectiveRate(annualRatePercent);
  return normalizeZero(currentAmount * Math.pow(1 + monthlyRate, months));
}

/**
 * Plano C legado (compatibilidade de testes existentes): aportes mensais no final do período
 */
export function calculateCompoundAnnuity(
  monthlyDeposit: number,
  nominalAnnualRatePercent: number,
  months: number
): number {
  if (
    !Number.isFinite(monthlyDeposit) ||
    !Number.isFinite(nominalAnnualRatePercent) ||
    !Number.isFinite(months) ||
    monthlyDeposit <= 0 ||
    months <= 0
  ) {
    return 0;
  }
  if (nominalAnnualRatePercent <= 0) return normalizeZero(monthlyDeposit * months);
  const monthlyRate = Math.pow(1 + nominalAnnualRatePercent / 100, 1 / 12) - 1;
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0) {
    return normalizeZero(monthlyDeposit * months);
  }
  return normalizeZero(
    monthlyDeposit * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
  );
}

/**
 * 27. Correção Monetária
 * Valor corrigido = Valor inicial × (Índice final / Índice inicial)
 */
export function calculateMonetaryCorrection(params: {
  initialAmount: number;
  initialIndex: number;
  finalIndex: number;
  indexUsedLabel: string;
  periodLabel: string;
}): MonetaryCorrectionResult {
  const { initialAmount, initialIndex, finalIndex, indexUsedLabel, periodLabel } = params;
  if (
    !Number.isFinite(initialAmount) ||
    initialAmount < 0 ||
    !Number.isFinite(initialIndex) ||
    initialIndex <= 0 ||
    !Number.isFinite(finalIndex) ||
    finalIndex < 0
  ) {
    return {
      valid: false,
      initialAmount: Number.isFinite(initialAmount) ? initialAmount : 0,
      correctedAmount: null,
      differenceReais: null,
      accumulatedFactor: null,
      accumulatedPercent: null,
      indexUsedLabel,
      periodLabel,
      reason: 'Valor inicial, índice inicial (> 0) ou índice final inválidos.',
    };
  }
  const factor = finalIndex / initialIndex;
  const correctedAmount = normalizeZero(initialAmount * factor);
  return {
    valid: true,
    initialAmount: normalizeZero(initialAmount),
    correctedAmount,
    differenceReais: normalizeZero(correctedAmount - initialAmount),
    accumulatedFactor: normalizeZero(factor),
    accumulatedPercent: normalizeZero((factor - 1) * 100),
    indexUsedLabel,
    periodLabel,
  };
}

export function calculateMonetaryCorrectionFromRates(params: {
  initialAmount: number;
  monthlyRatesPercent: number[];
  indexUsedLabel: string;
  periodLabel: string;
}): MonetaryCorrectionResult {
  const accPct = calculateAccumulatedInflation(params.monthlyRatesPercent);
  return calculateMonetaryCorrection({
    initialAmount: params.initialAmount,
    initialIndex: 100,
    finalIndex: 100 * (1 + accPct / 100),
    indexUsedLabel: params.indexUsedLabel,
    periodLabel: params.periodLabel,
  });
}

/**
 * 28. Equivalência de Consumo e Dias de Trabalho
 */
export function calculateWorkingDaysEquivalence(params: {
  expenseAmount: number;
  monthlyIncome: number | null | undefined;
  workingDaysPerMonth?: number;
  unitPrice?: number;
}): WorkingDaysEquivalenceResult {
  const days = params.workingDaysPerMonth && params.workingDaysPerMonth > 0 ? params.workingDaysPerMonth : 22;
  const income = params.monthlyIncome;
  const expense = params.expenseAmount;

  if (
    income === null ||
    income === undefined ||
    !Number.isFinite(income) ||
    income <= 0
  ) {
    return {
      valid: false,
      dailyRate: null,
      workingDaysNeeded: null,
      purchasableUnitsWithIncome: null,
      workingDaysPerMonth: days,
      premiseNote: `Premissa padrão: ${days} dias úteis/mês.`,
      reason: 'Informe uma renda líquida mensal maior que zero para calcular a equivalência em dias de trabalho.',
    };
  }

  if (!Number.isFinite(expense) || expense < 0) {
    return {
      valid: false,
      dailyRate: normalizeZero(income / days),
      workingDaysNeeded: null,
      purchasableUnitsWithIncome: null,
      workingDaysPerMonth: days,
      premiseNote: `Estimativa matemática considerando ${days} dias úteis/mês — não representa jornada efetiva.`,
      reason: 'Despesa de referência inválida ou negativa.',
    };
  }

  const dailyRate = income / days;
  const workingDaysNeeded = dailyRate > 0 ? expense / dailyRate : 0;
  const purchasableUnitsWithIncome =
    params.unitPrice && Number.isFinite(params.unitPrice) && params.unitPrice > 0
      ? normalizeZero(income / params.unitPrice)
      : null;

  return {
    valid: true,
    dailyRate: normalizeZero(dailyRate),
    workingDaysNeeded: normalizeZero(workingDaysNeeded),
    purchasableUnitsWithIncome,
    workingDaysPerMonth: days,
    premiseNote: `Estimativa matemática baseada em ${days} dias úteis/mês (${formatCurrencyBR(dailyRate)}/dia) — não representa jornada efetivamente cumprida.`,
  };
}

/**
 * 29 & 30. Estatísticas Normalizadas de Cotações de Preços
 */
export function calculateNormalizedQuoteStats(
  records: PriceRecord[],
  itemDefaultUnit = 'un'
): NormalizedQuoteStats {
  const totalCount = records?.length || 0;
  const defaultDef = resolveUnitDefinition(itemDefaultUnit);

  const normalizedList: Array<{
    record: PriceRecord;
    normPrice: number;
    isoDate: string;
  }> = [];

  for (const rec of records || []) {
    if (rec.comparabilityBroken) continue;
    if (!Number.isFinite(rec.price) || rec.price < 0) continue;
    const recUnit = rec.packageUnit || rec.unit || itemDefaultUnit;
    if (!areUnitsCompatible(itemDefaultUnit, recUnit)) continue;
    const packSize = rec.packageSize && rec.packageSize > 0 ? rec.packageSize : 1;
    const norm = calculateNormalizedUnitPrice(rec.price, packSize, recUnit);
    if (!norm.valid || norm.normalizedPrice === null) continue;
    const isoDate = extractIsoDatePrefix(rec.referenceDate || rec.date) || '0000-00-00';
    normalizedList.push({
      record: rec,
      normPrice: norm.normalizedPrice,
      isoDate,
    });
  }

  normalizedList.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  const comparableCount = normalizedList.length;
  const excludedCount = totalCount - comparableCount;

  if (comparableCount === 0) {
    return {
      totalCount,
      comparableCount: 0,
      excludedCount,
      minPrice: null,
      maxPrice: null,
      averagePrice: null,
      latestPrice: null,
      oldestPrice: null,
      absoluteChange: null,
      percentChange: null,
      canonicalUnit: defaultDef.canonicalUnit,
      isNormalized: false,
      averageMethodNote: 'Sem cotações comparáveis na mesma família de unidades.',
    };
  }

  let minEntry = normalizedList[0];
  let maxEntry = normalizedList[0];
  let sum = 0;
  for (const entry of normalizedList) {
    sum += entry.normPrice;
    if (entry.normPrice < minEntry.normPrice) minEntry = entry;
    if (entry.normPrice > maxEntry.normPrice) maxEntry = entry;
  }

  const oldestEntry = normalizedList[0];
  const latestEntry = normalizedList[normalizedList.length - 1];
  const averagePrice = sum / comparableCount;
  const absoluteChange =
    comparableCount >= 2 ? latestEntry.normPrice - oldestEntry.normPrice : null;
  const percentChange =
    comparableCount >= 2 && oldestEntry.normPrice > 0
      ? ((latestEntry.normPrice / oldestEntry.normPrice) - 1) * 100
      : null;

  const usedPackaging = normalizedList.some(
    (e) =>
      (e.record.packageSize && e.record.packageSize !== 1) ||
      (e.record.packageUnit &&
        resolveUnitDefinition(e.record.packageUnit).code !== defaultDef.code)
  );

  return {
    totalCount,
    comparableCount,
    excludedCount,
    minPrice: normalizeZero(minEntry.normPrice),
    maxPrice: normalizeZero(maxEntry.normPrice),
    averagePrice: normalizeZero(averagePrice),
    latestPrice: normalizeZero(latestEntry.normPrice),
    oldestPrice: normalizeZero(oldestEntry.normPrice),
    absoluteChange: absoluteChange !== null ? normalizeZero(absoluteChange) : null,
    percentChange: percentChange !== null ? normalizeZero(percentChange) : null,
    canonicalUnit: defaultDef.canonicalUnit,
    isNormalized: usedPackaging,
    averageMethodNote: `Média aritmética simples das ${comparableCount} cotações comparáveis normalizadas por ${defaultDef.canonicalUnit}.`,
    minRecord: minEntry.record,
    maxRecord: maxEntry.record,
    latestRecord: latestEntry.record,
  };
}

/**
 * 31. Plano A — Simulação de Substituição Normalizada por Unidade
 */
export function simulatePlanA(params: {
  originalPrice: number;
  originalPackageSize?: number;
  originalPackageUnit?: string;
  substitutePrice: number;
  substitutePackageSize?: number;
  substitutePackageUnit?: string;
  monthlyQuantity?: number;
}): {
  comparable: boolean;
  canonicalUnit: string;
  normalizedOriginalPrice: number | null;
  normalizedSubstitutePrice: number | null;
  unitSavings: number | null;
  monthlySavings: number | null;
  annualEstimatedSavings: number | null;
  isCostIncrease: boolean;
  reason?: string;
} {
  const unitA = params.originalPackageUnit || 'un';
  const unitB = params.substitutePackageUnit || unitA;
  const sizeA = params.originalPackageSize && params.originalPackageSize > 0 ? params.originalPackageSize : 1;
  const sizeB = params.substitutePackageSize && params.substitutePackageSize > 0 ? params.substitutePackageSize : sizeA;
  const qty = params.monthlyQuantity && params.monthlyQuantity > 0 ? params.monthlyQuantity : 1;

  const cmp = compareNormalizedUnitPrices(
    { price: params.originalPrice, packageSize: sizeA, packageUnit: unitA },
    { price: params.substitutePrice, packageSize: sizeB, packageUnit: unitB }
  );

  if (!cmp.comparable || cmp.unitSavingsAbsolute === null) {
    return {
      comparable: false,
      canonicalUnit: cmp.canonicalUnit,
      normalizedOriginalPrice: cmp.pricePerCanonicalA,
      normalizedSubstitutePrice: cmp.pricePerCanonicalB,
      unitSavings: null,
      monthlySavings: null,
      annualEstimatedSavings: null,
      isCostIncrease: false,
      reason: cmp.reason,
    };
  }

  const unitSavings = normalizeZero(cmp.unitSavingsAbsolute);
  const monthlySavings = normalizeZero(unitSavings * qty);
  const annualEstimatedSavings = normalizeZero(monthlySavings * 12);
  return {
    comparable: true,
    canonicalUnit: cmp.canonicalUnit,
    normalizedOriginalPrice: cmp.pricePerCanonicalA,
    normalizedSubstitutePrice: cmp.pricePerCanonicalB,
    unitSavings,
    monthlySavings,
    annualEstimatedSavings,
    isCostIncrease: monthlySavings < 0,
  };
}

/**
 * 32. Plano B — Simulação de Eficiência de Consumo
 */
export function simulatePlanB(params: {
  currentConsumption: number;
  targetConsumption: number;
  tariffPerUnit: number;
  fixedFee?: number;
  extraCharges?: number;
}): {
  valid: boolean;
  currentTotalSpend: number;
  projectedTotalSpend: number;
  estimatedMonthlySavings: number;
  estimatedAnnualSavings: number;
  reductionPercent: number | null;
  isIncrease: boolean;
  reason?: string;
} {
  const c0 = Number(params.currentConsumption);
  const c1 = Number(params.targetConsumption);
  const t = Number(params.tariffPerUnit);
  const fixed = Number(params.fixedFee || 0);
  const extras = Number(params.extraCharges || 0);

  if (
    !Number.isFinite(c0) ||
    !Number.isFinite(c1) ||
    !Number.isFinite(t) ||
    c0 < 0 ||
    c1 < 0 ||
    t < 0 ||
    fixed < 0 ||
    extras < 0
  ) {
    return {
      valid: false,
      currentTotalSpend: 0,
      projectedTotalSpend: 0,
      estimatedMonthlySavings: 0,
      estimatedAnnualSavings: 0,
      reductionPercent: null,
      isIncrease: false,
      reason: 'Consumos, tarifa e encargos não podem ser negativos.',
    };
  }

  const currentTotalSpend = normalizeZero(c0 * t + fixed + extras);
  const projectedTotalSpend = normalizeZero(c1 * t + fixed + extras);
  const variableSavings = normalizeZero((c0 - c1) * t);
  const reductionPercent = c0 > 0 ? normalizeZero(((c0 - c1) / c0) * 100) : null;

  return {
    valid: true,
    currentTotalSpend,
    projectedTotalSpend,
    estimatedMonthlySavings: variableSavings,
    estimatedAnnualSavings: normalizeZero(variableSavings * 12),
    reductionPercent,
    isIncrease: variableSavings < 0,
  };
}

/**
 * Tabela regressiva de IR RF brasileira (Lei 11.033/2004):
 * - Até 180 dias (~6m): 22,5%
 * - 181 a 360 dias (7..12m): 20,0%
 * - 361 a 720 dias (13..24m): 17,5%
 * - Acima de 720 dias (>24m): 15,0%
 */
export function resolveRegressiveIRRate(termMonths: number): number {
  const approxDays = Math.max(1, Math.round(termMonths * 30));
  if (approxDays <= 180) return 22.5;
  if (approxDays <= 360) return 20.0;
  if (approxDays <= 720) return 17.5;
  return 15.0;
}

const PRODUCT_METADATA: Record<
  InvestmentProductType,
  { label: string; fgcNote: string; liquidityNote: string; taxable: boolean }
> = {
  poupanca: {
    label: 'Caderneta de Poupança',
    fgcNote: 'Conta com garantia do FGC até R$ 250 mil por CPF e instituição financeira (respeitado teto global de R$ 1 milhão a cada 4 anos).',
    liquidityNote: 'Liquidez diária, porém rendimento creditado somente na data de aniversário mensal.',
    taxable: false,
  },
  cdb: {
    label: 'CDB (Certificado de Depósito Bancário)',
    fgcNote: 'Conta com garantia do FGC até R$ 250 mil por CPF e conglomerado emissor. Risco de crédito do banco emissor.',
    liquidityNote: 'Depende do título: apenas CDBs com liquidez diária contratual permitem resgate antecipado sem marcação a mercado.',
    taxable: true,
  },
  tesouro_selic: {
    label: 'Tesouro Selic (LFT — Título Público Federal)',
    fgcNote: 'NÃO utiliza FGC — possui risco soberano do Tesouro Nacional. Taxa de custódia B3 (0,20% a.a.) isenta para estoque até R$ 10 mil por CPF no Selic.',
    liquidityNote: 'Liquidez em dias úteis (D+1/D+0 conforme horário da B3), baixa volatilidade na marcação a mercado.',
    taxable: true,
  },
  tesouro_prefixado: {
    label: 'Tesouro Prefixado (LTN — Título Público Federal)',
    fgcNote: 'NÃO utiliza FGC — risco soberano do Tesouro Nacional. Sujeito à marcação a mercado antes do vencimento.',
    liquidityNote: 'Sem liquidez garantida sem perda antes do vencimento: resgate antecipado ocorre pelo preço de mercado (pode haver ágio ou deságio).',
    taxable: true,
  },
  tesouro_ipca: {
    label: 'Tesouro IPCA+ (NTN-B Principal)',
    fgcNote: 'NÃO utiliza FGC — risco soberano do Tesouro Nacional. Alta sensibilidade à marcação a mercado em prazos longos.',
    liquidityNote: 'Poder de compra contratado apenas no vencimento; vendas antecipadas sofrem oscilação do juro real de mercado.',
    taxable: true,
  },
  fundos: {
    label: 'Fundo de Investimento',
    fgcNote: 'Fundos de investimento NÃO possuem garantia do FGC. Avalie taxa de administração e regulamento da gestora.',
    liquidityNote: 'Prazo de cotização e liquidação variável (ex.: D+0 a D+30+). Fundos abertos sofrem come-cotas semestral (15% LP / 20% CP).',
    taxable: true,
  },
  outros: {
    label: 'Outro Produto Financeiro',
    fgcNote: 'Verifique prospecto e regulação específica: nem todo produto financeiro possui garantia do FGC ou cobertura soberana.',
    liquidityNote: 'Prazo de carência e liquidez sujeitos às condições contratuais específicas.',
    taxable: true,
  },
};

/**
 * 33 & 34. Plano C — Simulador Completo de Investimentos (Capital Inicial + Aportes + Tributação + Taxas + Real)
 */
export function simulatePlanC(params: {
  initialCapital?: number;
  monthlyDeposit: number;
  termMonths: number;
  nominalAnnualRatePercent: number;
  expectedAnnualInflationPercent: number;
  productType?: InvestmentProductType;
  compoundingFrequency?: CompoundingFrequency;
  depositTiming?: DepositTiming;
  taxMode?: TaxMode;
  manualTaxRatePercent?: number;
  adminFeeAnnualPercent?: number;
  custodyFeeAnnualPercent?: number;
}): PlanCSimulationResult {
  const productType = params.productType || 'cdb';
  const productInfo = PRODUCT_METADATA[productType] || PRODUCT_METADATA.outros;
  const compoundingFrequency: CompoundingFrequency = params.compoundingFrequency || 'mensal';
  const depositTiming: DepositTiming = params.depositTiming || 'fim';
  const taxMode: TaxMode = params.taxMode || 'automatica';

  const C0 = Math.max(0, Number.isFinite(params.initialCapital) ? Number(params.initialCapital) : 0);
  const PMT = Math.max(0, Number.isFinite(params.monthlyDeposit) ? Number(params.monthlyDeposit) : 0);
  const n = Math.max(1, Math.min(600, Math.round(Number(params.termMonths) || 12)));
  const grossAnnualRate = Number.isFinite(params.nominalAnnualRatePercent)
    ? Number(params.nominalAnnualRatePercent)
    : 0;
  const expectedInflation = Number.isFinite(params.expectedAnnualInflationPercent)
    ? Number(params.expectedAnnualInflationPercent)
    : 0;
  const adminFee = Math.max(0, Number(params.adminFeeAnnualPercent || 0));
  const custodyFee = Math.max(0, Number(params.custodyFeeAnnualPercent || 0));

  // Taxa líquida de custos recorrentes (admin + custódia sobre patrimônio)
  const netOfFeeAnnualRate = Math.max(-99.9, grossAnnualRate - adminFee - custodyFee);
  const zeroRate = Math.abs(grossAnnualRate) < 1e-9 && adminFee === 0 && custodyFee === 0;

  let monthlyRateGross = 0;
  let monthlyRateAfterFees = 0;

  if (!zeroRate) {
    if (compoundingFrequency === 'diaria') {
      const rDayGross = Math.pow(Math.max(0.0001, 1 + grossAnnualRate / 100), 1 / 252) - 1;
      monthlyRateGross = Math.pow(1 + rDayGross, 21) - 1;
      const rDayNetFee = Math.pow(Math.max(0.0001, 1 + netOfFeeAnnualRate / 100), 1 / 252) - 1;
      monthlyRateAfterFees = Math.pow(1 + rDayNetFee, 21) - 1;
    } else if (compoundingFrequency === 'anual') {
      // Capitalização em ciclos anuais (a cada 12 meses ou equivalente pro-rata se <12)
      monthlyRateGross = Math.pow(Math.max(0.0001, 1 + grossAnnualRate / 100), 1 / 12) - 1;
      monthlyRateAfterFees = Math.pow(Math.max(0.0001, 1 + netOfFeeAnnualRate / 100), 1 / 12) - 1;
    } else {
      monthlyRateGross = Math.pow(Math.max(0.0001, 1 + grossAnnualRate / 100), 1 / 12) - 1;
      monthlyRateAfterFees = Math.pow(Math.max(0.0001, 1 + netOfFeeAnnualRate / 100), 1 / 12) - 1;
    }
  }

  // Determinação transparente da tributação
  let appliedTaxRate = 0;
  let taxAppliedLabel = 'Resultado bruto (tributos não deduzidos)';
  let missingTaxInfoNote: string | undefined;

  if (taxMode === 'bruto') {
    appliedTaxRate = 0;
    taxAppliedLabel = 'Simulação Bruta (sem dedução de IR/IOF)';
    missingTaxInfoNote = 'Modo bruto selecionado: imposto de renda e eventual IOF não foram descontados do montante.';
  } else if (taxMode === 'isento' || productType === 'poupanca') {
    appliedTaxRate = 0;
    taxAppliedLabel =
      productType === 'poupanca' ? 'Isento de IR (Poupança PF)' : 'Isento de IR (selecionado)';
  } else if (taxMode === 'manual') {
    appliedTaxRate = Math.max(0, Math.min(100, Number(params.manualTaxRatePercent ?? 0)));
    taxAppliedLabel = `Alíquota manual de ${appliedTaxRate.toFixed(1).replace('.', ',')}% s/ rendimento`;
  } else if (productType === 'outros') {
    appliedTaxRate = 0;
    taxAppliedLabel = 'Tributação não informada (exibindo bruto após custos)';
    missingTaxInfoNote = 'Produto classificado em "Outros" sem alíquota informada; resultado apresentado antes de tributos.';
  } else {
    appliedTaxRate = resolveRegressiveIRRate(n);
    taxAppliedLabel = `IR Regressivo estimado (${appliedTaxRate.toFixed(1).replace('.', ',')}% s/ rendimentos para ${n} meses)`;
  }

  const schedule: PlanCScheduleRow[] = [];
  let balanceGrossBeforeFees = C0;
  let balanceAfterFees = C0;
  let contributedCum = C0;

  for (let m = 1; m <= n; m++) {
    let grossInterestThisMonth = 0;
    let netFeeInterestThisMonth = 0;

    if (depositTiming === 'inicio') {
      balanceGrossBeforeFees += PMT;
      balanceAfterFees += PMT;
      contributedCum += PMT;

      if (compoundingFrequency !== 'anual' || m % 12 === 0) {
        const effGross =
          compoundingFrequency === 'anual' ? grossAnnualRate / 100 : monthlyRateGross;
        const effNet =
          compoundingFrequency === 'anual' ? netOfFeeAnnualRate / 100 : monthlyRateAfterFees;
        grossInterestThisMonth = balanceGrossBeforeFees * effGross;
        netFeeInterestThisMonth = balanceAfterFees * effNet;
        balanceGrossBeforeFees += grossInterestThisMonth;
        balanceAfterFees += netFeeInterestThisMonth;
      }
    } else {
      if (compoundingFrequency !== 'anual' || m % 12 === 0) {
        const effGross =
          compoundingFrequency === 'anual' ? grossAnnualRate / 100 : monthlyRateGross;
        const effNet =
          compoundingFrequency === 'anual' ? netOfFeeAnnualRate / 100 : monthlyRateAfterFees;
        grossInterestThisMonth = balanceGrossBeforeFees * effGross;
        netFeeInterestThisMonth = balanceAfterFees * effNet;
        balanceGrossBeforeFees += grossInterestThisMonth;
        balanceAfterFees += netFeeInterestThisMonth;
      }
      balanceGrossBeforeFees += PMT;
      balanceAfterFees += PMT;
      contributedCum += PMT;
    }

    const totalNetGainSoFar = Math.max(0, balanceAfterFees - contributedCum);
    const taxSoFar = totalNetGainSoFar * (appliedTaxRate / 100);
    const netBalanceSoFar = balanceAfterFees - taxSoFar;
    const inflationFactorSoFar = Math.pow(Math.max(0.0001, 1 + expectedInflation / 100), m / 12);
    const realValueSoFar = inflationFactorSoFar > 0 ? netBalanceSoFar / inflationFactorSoFar : netBalanceSoFar;

    schedule.push({
      month: m,
      contributedCumulative: normalizeZero(contributedCum),
      grossBalance: normalizeZero(balanceGrossBeforeFees),
      interestPeriod: normalizeZero(grossInterestThisMonth),
      netEstimated: normalizeZero(netBalanceSoFar),
      realValue: normalizeZero(realValueSoFar),
    });
  }

  const finalRow = schedule[schedule.length - 1];
  const totalContributed = finalRow.contributedCumulative;
  const grossFutureValue = finalRow.grossBalance;
  const grossInterest = normalizeZero(Math.max(0, grossFutureValue - totalContributed));
  const estimatedCosts = normalizeZero(Math.max(0, grossFutureValue - balanceAfterFees));
  const taxableYield = Math.max(0, balanceAfterFees - totalContributed);
  const estimatedTaxes = normalizeZero(taxableYield * (appliedTaxRate / 100));
  const netFutureValue = normalizeZero(balanceAfterFees - estimatedTaxes);
  const totalInflationFactor = Math.pow(Math.max(0.0001, 1 + expectedInflation / 100), n / 12);
  const realFutureValue = normalizeZero(
    totalInflationFactor > 0 ? netFutureValue / totalInflationFactor : netFutureValue
  );

  // Rentabilidade anualizada efetiva líquida vs nominal
  const years = n / 12;
  const netTotalGainRatio = totalContributed > 0 ? netFutureValue / totalContributed : 1;
  const nominalReturnPercent = normalizeZero((netTotalGainRatio - 1) * 100);
  // Rentabilidade real anual equivalente pela equação de Fisher sobre taxa líquida anual estimada
  const effectiveNetAnnualRate =
    zeroRate
      ? 0
      : normalizeZero(netOfFeeAnnualRate * (1 - appliedTaxRate / 100));
  const realReturnPercent = calculateFisherRealYield(effectiveNetAnnualRate, expectedInflation);

  return {
    valid: n >= 1,
    productType,
    productLabel: productInfo.label,
    compoundingFrequency,
    depositTiming,
    termMonths: n,
    initialCapital: normalizeZero(C0),
    monthlyDeposit: normalizeZero(PMT),
    totalContributed: normalizeZero(totalContributed),
    grossFutureValue: normalizeZero(grossFutureValue),
    grossInterest,
    estimatedTaxes,
    estimatedTaxRatePercent: appliedTaxRate,
    estimatedCosts,
    netFutureValue,
    realFutureValue,
    nominalReturnPercent,
    realReturnPercent,
    taxAppliedLabel,
    fgcAndRiskDisclaimer: `${productInfo.fgcNote} Simulação matemática educativa sem garantia de rentabilidade futura.${years < 1 && productType !== 'poupanca' ? ' Atenção: resgates antes de 30 dias podem sofrer IOF regressivo.' : ''}`,
    liquidityDisclaimer: productInfo.liquidityNote,
    missingTaxInfoNote,
    schedule,
  };
}

/**
 * 6.8 Impacto Mensal Estimado no Bolso
 * Impacto = G * (pi / 100)
 */
export function calculateEstimatedMonthlyImpact(
  monthlySpend: number,
  inflationPercent: number
): number {
  if (
    !Number.isFinite(monthlySpend) ||
    !Number.isFinite(inflationPercent) ||
    monthlySpend <= 0
  ) {
    return 0;
  }
  return normalizeZero(monthlySpend * (inflationPercent / 100));
}

/**
 * 6.9 Impacto Anual Estimado no Bolso (12 meses sob premissa de manutenção de gasto, sem confundir com observação histórica)
 */
export function calculateEstimatedAnnualImpact(
  monthlySpend: number,
  inflationPercent: number
): number {
  return normalizeZero(calculateEstimatedMonthlyImpact(monthlySpend, inflationPercent) * 12);
}

/**
 * 6.10 Poder de Compra: Renda Necessária e Diferença Real em R$
 */
export function calculateRealIncomeDifference(
  initialIncome: number,
  currentIncome: number,
  inflationPercent: number
): {
  neededIncome: number;
  differenceReais: number;
  hasLoss: boolean;
} {
  const safeInitial = Number.isFinite(initialIncome) && initialIncome >= 0 ? initialIncome : 0;
  const safeCurrent = Number.isFinite(currentIncome) && currentIncome >= 0 ? currentIncome : 0;
  const safeInflation = Number.isFinite(inflationPercent) ? inflationPercent : 0;
  const factor = Math.max(0, 1 + safeInflation / 100);
  const neededIncome = normalizeZero(safeInitial * factor);
  const differenceReais = normalizeZero(safeCurrent - neededIncome);
  return {
    neededIncome,
    differenceReais,
    hasLoss: differenceReais < 0,
  };
}

/**
 * 6.11 Impacto Efetivamente Observado na Cesta
 * Diferença = SUM( (P_1,i - P_0,i) * Q_0,i )
 */
export function calculateObservedBasketDifference(items: BasketItem[]): number {
  if (!items || items.length === 0) return 0;
  const total = items.reduce((acc, item) => {
    if (!item.active || item.isArchived || !isConsumptionAccountingType(item.accountingType)) {
      return acc;
    }
    if (item.comparabilityBroken) return acc;
    const p0 = Number(item.oldPrice);
    const p1 = Number(item.currentPrice);
    const effSpend = resolveEffectiveMonthlySpend(item).monthlySpend;
    if (!Number.isFinite(p0) || p0 <= 0 || !Number.isFinite(p1) || p1 < 0) {
      return acc;
    }
    const explicitQ0 = Number(item.baseQuantity ?? item.quantity);
    if (Number.isFinite(explicitQ0) && explicitQ0 > 0) {
      const freqMult = frequencyToMonthlyMultiplier(item.consumptionFrequency, item.frequencyDays);
      const monthlyQ0 = explicitQ0 * (freqMult.valid ? freqMult.multiplierToMonthly : 1);
      return acc + (p1 - p0) * monthlyQ0;
    }
    if (effSpend > 0 && p1 > 0) {
      const q0 = effSpend / p1;
      return acc + (p1 - p0) * q0;
    }
    return acc;
  }, 0);
  return normalizeZero(total);
}

/**
 * 36. Cenários Econômicos (Conservador / Base / Otimista)
 */
export function runEconomicScenarios(
  baseline: {
    currentMonthlyExpense: number;
    currentMonthlyIncome: number | null;
    annualRateInvestmentPercent?: number;
  },
  scenarios: EconomicScenarioInput[]
): EconomicScenarioResult[] {
  const baseExpense = Math.max(0, Number(baseline.currentMonthlyExpense) || 0);
  const baseIncome = Math.max(0, Number(baseline.currentMonthlyIncome) || 0);
  const investRate = Number.isFinite(baseline.annualRateInvestmentPercent)
    ? Number(baseline.annualRateInvestmentPercent)
    : 10.5;

  return scenarios.map((sc) => {
    const inflationFactor = Math.max(0, 1 + sc.annualInflationPercent / 100);
    const shockFactor = Math.max(0, 1 + sc.priceShockPercent / 100);
    const consumptionFactor = Math.max(0, 1 + sc.consumptionAdjustmentPercent / 100);
    const incomeFactor = Math.max(0, 1 + sc.nominalIncomeGrowthPercent / 100);

    const projectedMonthlyExpense = normalizeZero(
      baseExpense * inflationFactor * shockFactor * consumptionFactor +
        Math.max(0, sc.unexpectedExpenseMonthly)
    );
    const projectedMonthlyIncome = normalizeZero(baseIncome * incomeFactor);
    const projectedMonthlyBalance = normalizeZero(projectedMonthlyIncome - projectedMonthlyExpense);
    const projectedAnnualBalance = normalizeZero(projectedMonthlyBalance * 12);

    const effectiveTotalPricePressure = (inflationFactor * shockFactor - 1) * 100;
    const realIncomeVariationPercent =
      baseIncome > 0
        ? calculateRealPurchasingPowerChange(
            sc.nominalIncomeGrowthPercent,
            effectiveTotalPricePressure
          ) ?? 0
        : 0;

    const simC = simulatePlanC({
      monthlyDeposit: Math.max(0, sc.monthlyContribution),
      termMonths: 12,
      nominalAnnualRatePercent: investRate,
      expectedAnnualInflationPercent: sc.annualInflationPercent,
      productType: 'cdb',
    });

    return {
      ...sc,
      projectedMonthlyExpense,
      projectedMonthlyIncome,
      projectedMonthlyBalance,
      projectedAnnualBalance,
      realIncomeVariationPercent: normalizeZero(realIncomeVariationPercent),
      projected12MInvestmentNet: simC.netFutureValue,
      disclaimer:
        'Projeção hipotética baseada nas premissas selecionadas; não constitui previsão garantida de mercado.',
    };
  });
}

/**
 * 49. Matriz de Sensibilidade (Inflação × Crescimento da Renda × Ajuste de Consumo)
 */
export function runSensitivityMatrix(params: {
  baseMonthlyExpense: number;
  baseMonthlyIncome: number;
  inflationRates: number[];
  incomeGrowthRates: number[];
  consumptionReductionPercent?: number;
}): SensitivityCell[] {
  const redPct = Number(params.consumptionReductionPercent || 0);
  const consFactor = Math.max(0, 1 - redPct / 100);
  const cells: SensitivityCell[] = [];

  for (const inf of params.inflationRates) {
    for (const inc of params.incomeGrowthRates) {
      const projectedExpenseMonthly = normalizeZero(
        params.baseMonthlyExpense * (1 + inf / 100) * consFactor
      );
      const projectedIncomeMonthly = normalizeZero(params.baseMonthlyIncome * (1 + inc / 100));
      const projectedBalanceMonthly = normalizeZero(
        projectedIncomeMonthly - projectedExpenseMonthly
      );
      const realIncomeChangePercent =
        calculateRealPurchasingPowerChange(inc, inf) ?? 0;

      cells.push({
        inflationPercent: inf,
        incomeGrowthPercent: inc,
        consumptionReductionPercent: redPct,
        projectedExpenseMonthly,
        projectedIncomeMonthly,
        projectedBalanceMonthly,
        realIncomeChangePercent,
      });
    }
  }
  return cells;
}

/**
 * 35. Indicadores Financeiros Domésticos Dinâmicos
 */
export function calculateHouseholdIndicators(params: {
  consumptionExpenses: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
  debtObligations: number;
  financialApplications: number;
  transfers: number;
  baseConsumptionCost: number;
  ipcaIndexFactor: number;
  netIncome: number | null;
  grossIncome: number | null;
  availableReserve: number | null;
}): HouseholdIndicators {
  const {
    consumptionExpenses,
    essentialExpenses,
    discretionaryExpenses,
    debtObligations,
    financialApplications,
    transfers,
    baseConsumptionCost,
    ipcaIndexFactor,
    netIncome,
    grossIncome,
    availableReserve,
  } = params;

  const missingFields: string[] = [];
  const hasValidNetIncome = netIncome !== null && Number.isFinite(netIncome) && netIncome > 0;
  if (!hasValidNetIncome) missingFields.push('Renda líquida mensal');
  if (consumptionExpenses <= 0) missingFields.push('Despesas de consumo da cesta');
  if (availableReserve === null || !Number.isFinite(availableReserve)) {
    missingFields.push('Reserva financeira disponível');
  }

  const totalCommitments = normalizeZero(consumptionExpenses + debtObligations);
  const monthlyBalance = hasValidNetIncome
    ? normalizeZero(netIncome! - totalCommitments)
    : null;

  const expenseToIncomePercent = hasValidNetIncome
    ? normalizeZero((consumptionExpenses / netIncome!) * 100)
    : null;

  const savingsRatePercent = hasValidNetIncome
    ? normalizeZero(((netIncome! - totalCommitments) / netIncome!) * 100)
    : null;

  const essentialSharePercent =
    consumptionExpenses > 0
      ? normalizeZero((essentialExpenses / consumptionExpenses) * 100)
      : null;

  const debtCommitmentPercent = hasValidNetIncome
    ? normalizeZero((debtObligations / netIncome!) * 100)
    : null;

  const reserveInMonths =
    availableReserve !== null &&
    Number.isFinite(availableReserve) &&
    availableReserve >= 0 &&
    essentialExpenses > 0
      ? normalizeZero(availableReserve / essentialExpenses)
      : null;

  const realExpenseVariationPercent =
    baseConsumptionCost > 0 && consumptionExpenses >= 0 && ipcaIndexFactor > 0
      ? normalizeZero(((consumptionExpenses / baseConsumptionCost) / ipcaIndexFactor - 1) * 100)
      : null;

  const completenessStatus: HouseholdIndicators['completenessStatus'] =
    missingFields.length === 0
      ? 'completo'
      : hasValidNetIncome || consumptionExpenses > 0
      ? 'parcial'
      : 'insuficiente';

  return {
    netIncome: hasValidNetIncome ? normalizeZero(netIncome!) : null,
    grossIncome:
      grossIncome !== null && Number.isFinite(grossIncome) && grossIncome >= 0
        ? normalizeZero(grossIncome)
        : null,
    consumptionExpenses: normalizeZero(consumptionExpenses),
    debtObligations: normalizeZero(debtObligations),
    financialApplications: normalizeZero(financialApplications),
    transfers: normalizeZero(transfers),
    essentialExpenses: normalizeZero(essentialExpenses),
    discretionaryExpenses: normalizeZero(discretionaryExpenses),
    totalCommitments,
    monthlyBalance,
    expenseToIncomePercent,
    savingsRatePercent,
    essentialSharePercent,
    debtCommitmentPercent,
    reserveInMonths,
    availableReserve:
      availableReserve !== null && Number.isFinite(availableReserve)
        ? normalizeZero(availableReserve)
        : null,
    realExpenseVariationPercent,
    completenessStatus,
    missingFields,
  };
}

/**
 * Resolve preços P0 e P1 de acordo com o recorte temporal selecionado quando houver histórico de cotações suficiente.
 */
function resolveTimeframePricesForItem(
  item: BasketItem,
  timeframe: TimeframeWindow,
  priceHistory: PriceRecord[] | undefined,
  customStartDate?: string,
  customEndDate?: string
): { oldPrice: number; currentPrice: number; usedHistoryQuotes: boolean } {
  const defaultOld = Number(item.oldPrice);
  const defaultCur = Number(item.currentPrice);

  if (!priceHistory || priceHistory.length < 2) {
    return {
      oldPrice: Number.isFinite(defaultOld) ? defaultOld : 0,
      currentPrice: Number.isFinite(defaultCur) ? defaultCur : 0,
      usedHistoryQuotes: false,
    };
  }

  // Somente aplica recorte sobre histórico quando explicitamente há >=2 cotações compatíveis daquele item
  const itemQuotes = priceHistory
    .filter((rec) => rec.itemId === item.id && !rec.comparabilityBroken && Number.isFinite(rec.price) && rec.price >= 0)
    .map((rec) => ({
      rec,
      iso: extractIsoDatePrefix(rec.referenceDate || rec.date) || '',
    }))
    .filter((x) => x.iso !== '')
    .sort((a, b) => a.iso.localeCompare(b.iso));

  if (itemQuotes.length < 2) {
    return {
      oldPrice: Number.isFinite(defaultOld) ? defaultOld : 0,
      currentPrice: Number.isFinite(defaultCur) ? defaultCur : 0,
      usedHistoryQuotes: false,
    };
  }

  // Para 12M sem customização, se os preços de cadastro do item já representam o par P0->P1 completo, mantém se o histórico tiver menor amplitude
  const endLimit =
    timeframe === 'CUSTOM' && customEndDate ? customEndDate : getTodayIsoDate();
  const startLimit =
    timeframe === '1M'
      ? getMonthsAgoIsoDate(1)
      : timeframe === 'YTD'
      ? getYearStartIsoDate()
      : timeframe === 'CUSTOM' && customStartDate
      ? customStartDate
      : getMonthsAgoIsoDate(12);

  const inEnd = itemQuotes.filter((q) => q.iso <= endLimit);
  if (inEnd.length < 2) {
    return {
      oldPrice: Number.isFinite(defaultOld) ? defaultOld : 0,
      currentPrice: Number.isFinite(defaultCur) ? defaultCur : 0,
      usedHistoryQuotes: false,
    };
  }

  const endQuote = inEnd[inEnd.length - 1];
  // Procura cotação âncora mais próxima igual ou imediatamente anterior a startLimit, ou primeira dentro da janela
  const onOrBeforeStart = inEnd.filter((q) => q.iso <= startLimit);
  const withinWindow = inEnd.filter((q) => q.iso >= startLimit);
  const startQuote =
    onOrBeforeStart.length > 0
      ? onOrBeforeStart[onOrBeforeStart.length - 1]
      : withinWindow[0];

  if (startQuote && endQuote && startQuote.iso < endQuote.iso) {
    return {
      oldPrice: startQuote.rec.price,
      currentPrice: endQuote.rec.price,
      usedHistoryQuotes: true,
    };
  }

  return {
    oldPrice: Number.isFinite(defaultOld) ? defaultOld : 0,
    currentPrice: Number.isFinite(defaultCur) ? defaultCur : 0,
    usedHistoryQuotes: false,
  };
}

/**
 * Motor Completo: Processa itens da cesta, separa consumo de fluxos financeiros, calcula pesos-base e atuais,
 * Laspeyres clássico vs simplificado, decomposição de variação orçamentária, contribuições, impacto no bolso,
 * indicadores familiares e trilhas auditáveis (§5–§35).
 */
export function processBasketEconomics(
  items: BasketItem[],
  officialIBGE12M = 0,
  incomeInitial: number | null = null,
  incomeFinal: number | null = null,
  dateInitial = getMonthsAgoIsoDate(12),
  dateFinal = getTodayIsoDate(),
  timeframe: TimeframeWindow = '12M',
  options?: ProcessEconomicsOptions
): EconomicCalculationSummary {
  const safeOfficialIBGE12M = Number.isFinite(officialIBGE12M) ? officialIBGE12M : 0;
  const activeItems = (items || []).filter((i) => i.active && !i.isArchived);
  const customStart = options?.customStartDate;
  const customEnd = options?.customEndDate;
  const priceHistory = options?.priceHistory;

  const nonConsumptionFlows = calculateNonConsumptionFlows(activeItems);

  // Fase 1: Pré-cálculo individual (gastos efetivos, unidades normalizadas, elegibilidade)
  interface PreComputedItem {
    raw: BasketItem;
    isConsumption: boolean;
    effSpend: number;
    isMonthlyEquivalence: boolean;
    monthlyEquivalenceNote?: string;
    effectiveOldPrice: number;
    effectiveCurrentPrice: number;
    priceChangePercent: number | null;
    normOldUnitPrice: number | null;
    normCurUnitPrice: number | null;
    canonicalUnit: string;
    isComparable: boolean;
    exclusionReason?: string;
    dataState: DataCompletenessState;
    dataOriginResolved: DataOrigin;
    hasExplicitQ0: boolean;
    q0: number;
    q1: number;
    baseCostReais: number;
    currentCostOfBaseReais: number;
    currentActualSpendReais: number;
  }

  const preItems: PreComputedItem[] = activeItems.map((item) => {
    const isConsumption = isConsumptionAccountingType(item.accountingType);
    const { monthlySpend, isMonthlyEquivalence, monthlyEquivalenceNote } =
      resolveEffectiveMonthlySpend(item);

    const resolvedPrices = resolveTimeframePricesForItem(
      item,
      timeframe,
      priceHistory,
      customStart,
      customEnd
    );

    const p0Raw = resolvedPrices.oldPrice;
    const p1Raw = resolvedPrices.currentPrice;

    const unitCheck = calculateNormalizedPriceVariation({
      oldPrice: p0Raw,
      currentPrice: p1Raw,
      oldPackageSize: item.packageSize,
      oldPackageUnit: item.packageUnit || item.unit,
      currentPackageSize: item.packageSize,
      currentPackageUnit: item.packageUnit || item.unit,
      comparabilityBroken: item.comparabilityBroken,
    });

    const priceChangePercent = item.comparabilityBroken
      ? null
      : resolvedPrices.usedHistoryQuotes
      ? calculatePriceVariation(p0Raw, p1Raw)
      : unitCheck.comparable && unitCheck.variationPercent !== null
      ? unitCheck.variationPercent
      : calculatePriceVariation(p0Raw, p1Raw);

    let dataState: DataCompletenessState = 'ok';
    let exclusionReason: string | undefined;

    if (!isConsumption) {
      exclusionReason = `Classificação contábil "${item.accountingType}" excluída da inflação de consumo.`;
    } else if (item.comparabilityBroken) {
      dataState = 'sem_comparabilidade';
      exclusionReason = item.comparabilityReason || 'Quebra de comparabilidade de embalagem/qualidade.';
    } else if (p0Raw <= 0 || !Number.isFinite(p0Raw) || !Number.isFinite(p1Raw) || p1Raw < 0) {
      dataState = p0Raw <= 0 ? 'nao_informado' : 'invalido';
      exclusionReason =
        p0Raw <= 0 ? 'Preço-base anterior não informado.' : 'Preço atual inválido.';
    } else if (monthlySpend <= 0) {
      dataState = 'nao_informado';
      exclusionReason = 'Gasto mensal não informado ou zero.';
    } else if (isMonthlyEquivalence) {
      dataState = 'estimado';
    }

    const isComparable =
      isConsumption &&
      !item.comparabilityBroken &&
      priceChangePercent !== null &&
      monthlySpend > 0 &&
      p0Raw > 0 &&
      p1Raw >= 0;

    // Quantidade-base explícita vs implícita (com escala de periodicidade mensal quando aplicável)
    const freqInfo = frequencyToMonthlyMultiplier(item.consumptionFrequency, item.frequencyDays);
    const freqFactor = freqInfo.valid ? freqInfo.multiplierToMonthly : 1;
    const rawExplicitQ0 = Number(item.baseQuantity ?? item.quantity);
    const rawExplicitQ1 = Number(item.quantity ?? item.baseQuantity);
    const hasExplicitQ0 = Number.isFinite(rawExplicitQ0) && rawExplicitQ0 > 0;

    let q0 = 0;
    let q1 = 0;
    let baseCostReais = 0;
    let currentCostOfBaseReais = 0;
    let currentActualSpendReais = monthlySpend;

    if (isComparable) {
      if (hasExplicitQ0) {
        q0 = rawExplicitQ0 * freqFactor;
        q1 =
          Number.isFinite(rawExplicitQ1) && rawExplicitQ1 > 0
            ? rawExplicitQ1 * freqFactor
            : q0;
        baseCostReais = p0Raw * q0;
        currentCostOfBaseReais = p1Raw * q0;
        currentActualSpendReais = p1Raw * q1;
      } else {
        // Metodologia simplificada a partir do gasto atual informado (Q constante implícito = G_atual / P1)
        const p1Safe = p1Raw > 0 ? p1Raw : p0Raw;
        q0 = p1Safe > 0 ? monthlySpend / p1Safe : 0;
        q1 = q0;
        currentCostOfBaseReais = p1Raw > 0 ? monthlySpend : 0;
        baseCostReais = p1Raw > 0 ? p0Raw * q0 : monthlySpend;
        currentActualSpendReais = monthlySpend;
      }
    }

    const originResolved: DataOrigin =
      item.dataOrigin || (options?.isDemo ? 'demonstrativo' : 'usuario');

    return {
      raw: item,
      isConsumption,
      effSpend: monthlySpend,
      isMonthlyEquivalence,
      monthlyEquivalenceNote,
      effectiveOldPrice: p0Raw,
      effectiveCurrentPrice: p1Raw,
      priceChangePercent,
      normOldUnitPrice: unitCheck.normalizedOldUnitPrice,
      normCurUnitPrice: unitCheck.normalizedCurrentUnitPrice,
      canonicalUnit: unitCheck.canonicalUnit,
      isComparable,
      exclusionReason,
      dataState,
      dataOriginResolved: originResolved,
      hasExplicitQ0,
      q0,
      q1,
      baseCostReais,
      currentCostOfBaseReais,
      currentActualSpendReais,
    };
  });

  // Total de despesas de consumo (inclui incompletos de consumo no orçamento, mas NÃO no denominador de pesos comparáveis)
  const totalMonthlySpend = normalizeZero(
    preItems
      .filter((p) => p.isConsumption)
      .reduce((acc, p) => acc + p.effSpend, 0)
  );

  const comparableItems = preItems.filter((p) => p.isComparable);
  const totalComparableBaseCost = comparableItems.reduce((acc, p) => acc + p.baseCostReais, 0);
  const totalComparableCurrentSpend = comparableItems.reduce((acc, p) => acc + p.effSpend, 0);
  const totalComparableCurrentCostOfBase = comparableItems.reduce(
    (acc, p) => acc + p.currentCostOfBaseReais,
    0
  );

  const allComparableHaveExplicitQ0 =
    comparableItems.length > 0 && comparableItems.every((p) => p.hasExplicitQ0);

  const methodologyCode: LaspeyresResult['methodology'] =
    comparableItems.length === 0
      ? 'insuficiente'
      : allComparableHaveExplicitQ0
      ? 'laspeyres_classico'
      : 'ponderado_gasto_informado';

  const methodologyLabel =
    methodologyCode === 'laspeyres_classico'
      ? 'Índice Clássico de Laspeyres (quantidades do período-base Q0)'
      : methodologyCode === 'ponderado_gasto_informado'
      ? 'Índice Doméstico Simplificado (ponderado pelo gasto-base implícito)'
      : 'Dados insuficientes para apuração do índice doméstico';

  // Fase 2: Construir CalculatedBasketItem com pesos normalizados (soma = 100% no subconjunto comparável)
  const calculatedItems: CalculatedBasketItem[] = preItems.map((p) => {
    const budgetSharePercent = calculateItemWeight(p.effSpend, totalMonthlySpend);

    let baseWeightPercent = 0;
    let currentWeightPercent = 0;
    let weightedContribution = 0;
    let priceEffectReais = 0;
    let quantityEffectReais = 0;
    let mixEffectReais = 0;
    let spendChangeReais = 0;

    if (p.isComparable && p.priceChangePercent !== null) {
      baseWeightPercent =
        totalComparableBaseCost > 0
          ? normalizeZero((p.baseCostReais / totalComparableBaseCost) * 100)
          : 0;
      currentWeightPercent =
        totalComparableCurrentSpend > 0
          ? normalizeZero((p.effSpend / totalComparableCurrentSpend) * 100)
          : 0;
      weightedContribution = calculateWeightedContribution(baseWeightPercent, p.priceChangePercent);

      priceEffectReais = normalizeZero((p.effectiveCurrentPrice - p.effectiveOldPrice) * p.q0);
      quantityEffectReais = normalizeZero(p.effectiveOldPrice * (p.q1 - p.q0));
      mixEffectReais = normalizeZero(
        (p.effectiveCurrentPrice - p.effectiveOldPrice) * (p.q1 - p.q0)
      );
      spendChangeReais = normalizeZero(p.currentActualSpendReais - p.baseCostReais);
    }

    const impactLevel = determineImpactLevel(p.priceChangePercent, weightedContribution);
    const isVillain =
      p.isComparable &&
      ((baseWeightPercent >= 4.0 && (p.priceChangePercent ?? 0) >= 7.0) ||
        weightedContribution >= 0.7);
    const isDataComplete =
      Boolean(p.raw.name) &&
      Boolean(p.raw.group) &&
      p.effSpend > 0 &&
      p.isComparable;

    return {
      ...p.raw,
      monthlySpend: p.effSpend,
      weightPercent: baseWeightPercent,
      baseWeightPercent,
      currentWeightPercent,
      budgetSharePercent,
      priceChangePercent: p.priceChangePercent,
      weightedContribution,
      impactLevel,
      isVillain,
      isDataComplete,
      isPriceChangeAvailable: p.priceChangePercent !== null && p.isComparable,
      dataStatus: p.raw.isArchived ? 'Arquivado' : isDataComplete ? 'Completo' : 'Incompleto',
      dataState: p.dataState,
      dataOriginResolved: p.dataOriginResolved,
      isConsumptionItem: p.isConsumption,
      isComparable: p.isComparable,
      exclusionReason: p.exclusionReason,
      baseCostReais: normalizeZero(p.baseCostReais),
      currentCostOfBaseReais: normalizeZero(p.currentCostOfBaseReais),
      priceEffectReais,
      quantityEffectReais,
      mixEffectReais,
      spendChangeReais,
      normalizedCurrentUnitPrice: p.normCurUnitPrice,
      normalizedBaseUnitPrice: p.normOldUnitPrice,
      canonicalUnit: p.canonicalUnit,
      monthlyEquivalenceNote: p.monthlyEquivalenceNote,
      isMonthlyEquivalence: p.isMonthlyEquivalence,
      effectiveOldPrice: p.effectiveOldPrice,
      effectiveCurrentPrice: p.effectiveCurrentPrice,
    };
  });

  const eligibleItemsCount = calculatedItems.filter((i) => i.isPriceChangeAvailable).length;
  const incompleteItemsCount = calculatedItems.filter(
    (i) => i.isConsumptionItem && !i.isComparable
  ).length;
  const ignoredItemsCount = calculatedItems.length - eligibleItemsCount;

  const ipcaCasa12M = calculateIpcaCasa(calculatedItems);
  const spreadPP = calculateSpreadPP(ipcaCasa12M, safeOfficialIBGE12M);
  const sumOfWeights = normalizeZero(
    calculatedItems.reduce((acc, item) => acc + item.weightPercent, 0)
  );
  const comparableCoveragePercent =
    totalMonthlySpend > 0
      ? normalizeZero((totalComparableCurrentSpend / totalMonthlySpend) * 100)
      : 0;

  const methodology: LaspeyresResult = {
    methodology: methodologyCode,
    methodologyLabel,
    indexValue:
      comparableItems.length > 0 && totalComparableBaseCost > 0
        ? normalizeZero((totalComparableCurrentCostOfBase / totalComparableBaseCost) * 100)
        : null,
    variationPercent: ipcaCasa12M,
    baseBasketCost: normalizeZero(totalComparableBaseCost),
    currentCostOfBaseBasket: normalizeZero(totalComparableCurrentCostOfBase),
    comparableCoveragePercent,
    comparableItemsCount: eligibleItemsCount,
    totalConsumptionItemsCount: calculatedItems.filter((i) => i.isConsumptionItem).length,
    sumOfComparableWeights: sumOfWeights,
  };

  // Decomposição do orçamento comparável (§22)
  const priceEffectTotal = calculatedItems.reduce((acc, i) => acc + i.priceEffectReais, 0);
  const quantityEffectTotal = calculatedItems.reduce((acc, i) => acc + i.quantityEffectReais, 0);
  const mixEffectTotal = calculatedItems.reduce((acc, i) => acc + i.mixEffectReais, 0);
  const currentComparableActualTotal = comparableItems.reduce(
    (acc, p) => acc + p.currentActualSpendReais,
    0
  );
  const totalSpendChangeReais = normalizeZero(currentComparableActualTotal - totalComparableBaseCost);
  const decomposedSum = priceEffectTotal + quantityEffectTotal + mixEffectTotal;
  const budgetDecomposition: BudgetDecomposition = {
    baseCostTotal: normalizeZero(totalComparableBaseCost),
    currentCostTotal: normalizeZero(currentComparableActualTotal),
    currentCostOfBaseBasket: normalizeZero(totalComparableCurrentCostOfBase),
    priceEffectReais: normalizeZero(priceEffectTotal),
    quantityEffectReais: normalizeZero(quantityEffectTotal),
    mixEffectReais: normalizeZero(mixEffectTotal),
    totalSpendChangeReais,
    totalSpendChangePercent:
      totalComparableBaseCost > 0
        ? normalizeZero((totalSpendChangeReais / totalComparableBaseCost) * 100)
        : null,
    reconcilesExact: Math.abs(decomposedSum - totalSpendChangeReais) < 0.05,
  };

  // Agrupamento por Grupo de Consumo
  const groupColors: Record<string, { color: string; icon: string }> = {
    'Alimentação e bebidas': { color: '#000000', icon: 'restaurant' },
    Habitação: { color: '#497cff', icon: 'home' },
    Transportes: { color: '#006a61', icon: 'directions_car' },
    'Saúde e cuidados pessoais': { color: '#86f2e4', icon: 'health_and_safety' },
    Educação: { color: '#bec6e0', icon: 'school' },
    'Despesas pessoais': { color: '#d3e4fe', icon: 'person' },
    Comunicação: { color: '#7c839b', icon: 'wifi' },
    Vestuário: { color: '#3f465c', icon: 'checkroom' },
    'Artigos de residência': { color: '#565e74', icon: 'chair' },
  };

  const groupMap = new Map<
    string,
    {
      totalSpend: number;
      baseSpend: number;
      currentCostOfBase: number;
      comparableSpend: number;
      weightedContribution: number;
      itemCount: number;
      eligibleItemsCount: number;
    }
  >();

  for (const item of calculatedItems) {
    if (!item.isConsumptionItem) continue;
    const grp = item.group || 'Outros';
    const current = groupMap.get(grp) || {
      totalSpend: 0,
      baseSpend: 0,
      currentCostOfBase: 0,
      comparableSpend: 0,
      weightedContribution: 0,
      itemCount: 0,
      eligibleItemsCount: 0,
    };
    current.totalSpend += item.monthlySpend;
    current.itemCount += 1;
    if (item.isComparable) {
      current.baseSpend += item.baseCostReais;
      current.currentCostOfBase += item.currentCostOfBaseReais;
      current.comparableSpend += item.monthlySpend;
      current.weightedContribution += item.weightedContribution;
      current.eligibleItemsCount += 1;
    }
    groupMap.set(grp, current);
  }

  const groupContributions: GroupContribution[] = Array.from(groupMap.entries())
    .map(([group, data]) => {
      const budgetGroupWeight =
        totalMonthlySpend > 0 ? normalizeZero((data.totalSpend / totalMonthlySpend) * 100) : 0;
      const baseGroupWeight =
        totalComparableBaseCost > 0
          ? normalizeZero((data.baseSpend / totalComparableBaseCost) * 100)
          : 0;
      const groupInflationPercent =
        data.baseSpend > 0
          ? normalizeZero(((data.currentCostOfBase / data.baseSpend) - 1) * 100)
          : null;
      const groupCoveragePercent =
        data.totalSpend > 0 ? normalizeZero((data.comparableSpend / data.totalSpend) * 100) : 0;

      return {
        group,
        totalSpend: normalizeZero(data.totalSpend),
        baseSpend: normalizeZero(data.baseSpend),
        weightPercent: budgetGroupWeight,
        baseWeightPercent: baseGroupWeight,
        currentWeightPercent: budgetGroupWeight,
        weightedContribution: normalizeZero(data.weightedContribution),
        groupInflationPercent,
        groupCoveragePercent,
        itemCount: data.itemCount,
        eligibleItemsCount: data.eligibleItemsCount,
        isOfficialIbgeGroup: OFFICIAL_GROUP_NAMES.has(group),
        color: groupColors[group]?.color || '#565e74',
        icon: groupColors[group]?.icon || 'category',
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);

  const topIncreases = [...calculatedItems]
    .filter((i) => i.isPriceChangeAvailable && (i.priceChangePercent ?? 0) > 0)
    .sort((a, b) => (b.priceChangePercent ?? 0) - (a.priceChangePercent ?? 0))
    .slice(0, 5);

  const topReliefs = [...calculatedItems]
    .filter((i) => i.isPriceChangeAvailable && (i.priceChangePercent ?? 0) < 0)
    .sort((a, b) => (a.priceChangePercent ?? 0) - (b.priceChangePercent ?? 0))
    .slice(0, 5);

  const topVillains = [...calculatedItems]
    .filter((i) => i.isPriceChangeAvailable)
    .sort((a, b) => b.weightedContribution - a.weightedContribution)
    .slice(0, 5);

  // Renda & Indicadores Familiares
  const latestIncomeRec =
    options?.incomeRecords && options.incomeRecords.length > 0
      ? options.incomeRecords[options.incomeRecords.length - 1]
      : undefined;

  const netIncomeResolved =
    latestIncomeRec?.netIncome !== undefined && Number.isFinite(latestIncomeRec.netIncome)
      ? latestIncomeRec.netIncome
      : incomeFinal;
  const grossIncomeResolved =
    latestIncomeRec?.grossIncome !== undefined && Number.isFinite(latestIncomeRec.grossIncome)
      ? latestIncomeRec.grossIncome
      : null;

  const hasIncomeData =
    incomeInitial !== null &&
    Number.isFinite(incomeInitial) &&
    incomeInitial > 0 &&
    incomeFinal !== null &&
    Number.isFinite(incomeFinal) &&
    incomeFinal >= 0;

  const nominalIncomeGrowthPercent = hasIncomeData
    ? calculateNominalIncomeGrowth(incomeInitial, incomeFinal)
    : null;
  const realPurchasingPowerChangePercent = hasIncomeData
    ? calculateRealPurchasingPowerChange(nominalIncomeGrowthPercent, ipcaCasa12M)
    : null;
  const neededSalaryForBreakeven = hasIncomeData
    ? calculateNeededSalary(incomeInitial, ipcaCasa12M, 0)
    : null;
  const monthlyPurchasingDeficitOrGain =
    hasIncomeData && neededSalaryForBreakeven !== null && incomeFinal !== null
      ? normalizeZero(incomeFinal - neededSalaryForBreakeven)
      : null;
  const annualizedImpact =
    monthlyPurchasingDeficitOrGain !== null
      ? normalizeZero(monthlyPurchasingDeficitOrGain * 12)
      : null;

  const purchasingPower: PurchasingPowerAnalysis = {
    hasIncomeData,
    initialIncome: incomeInitial,
    finalIncome: incomeFinal,
    grossIncome: grossIncomeResolved,
    netIncome: netIncomeResolved,
    initialDate: dateInitial,
    finalDate: dateFinal,
    nominalIncomeGrowthPercent,
    appliedInflationPercent: ipcaCasa12M,
    inflationSource: 'IPCA-Casa',
    realPurchasingPowerChangePercent,
    monthlyPurchasingDeficitOrGain,
    annualizedImpact,
    neededSalaryForBreakeven,
    neededSalaryWithRealGain: (target) =>
      hasIncomeData ? calculateNeededSalary(incomeInitial, ipcaCasa12M, target) : null,
  };

  const essentialExpenses = calculatedItems
    .filter((i) => i.isConsumptionItem && i.classification === 'Essencial')
    .reduce((acc, i) => acc + i.monthlySpend, 0);
  const discretionaryExpenses = calculatedItems
    .filter(
      (i) =>
        i.isConsumptionItem &&
        (i.classification === 'Supérfluo' || i.classification === 'Discricionário')
    )
    .reduce((acc, i) => acc + i.monthlySpend, 0);

  const debtTotal = normalizeZero(
    (latestIncomeRec?.debtObligations || 0) + nonConsumptionFlows.debtObligations
  );
  const appTotal = normalizeZero(
    (latestIncomeRec?.financialApplications || 0) + nonConsumptionFlows.financialApplications
  );
  const transferTotal = normalizeZero(
    (latestIncomeRec?.transfers || 0) + nonConsumptionFlows.transfers
  );

  const householdIndicators = calculateHouseholdIndicators({
    consumptionExpenses: totalMonthlySpend,
    essentialExpenses,
    discretionaryExpenses,
    debtObligations: debtTotal,
    financialApplications: appTotal,
    transfers: transferTotal,
    baseConsumptionCost: totalComparableBaseCost,
    ipcaIndexFactor: 1 + ipcaCasa12M / 100,
    netIncome: netIncomeResolved,
    grossIncome: grossIncomeResolved,
    availableReserve:
      latestIncomeRec?.availableReserve !== undefined &&
      Number.isFinite(latestIncomeRec.availableReserve)
        ? latestIncomeRec.availableReserve
        : null,
  });

  // Impacto no Bolso consolidado (§22 / §38)
  const ibgeMonthlyEffect = calculateEstimatedMonthlyImpact(totalMonthlySpend, safeOfficialIBGE12M);
  const ibgeAnnualEffect = calculateEstimatedAnnualImpact(totalMonthlySpend, safeOfficialIBGE12M);
  const houseMonthlyEffect = calculateEstimatedMonthlyImpact(totalMonthlySpend, ipcaCasa12M);
  const houseAnnualEffect = calculateEstimatedAnnualImpact(totalMonthlySpend, ipcaCasa12M);
  const directBasketDifference = calculateObservedBasketDifference(activeItems);
  const directBasketAnnual = normalizeZero(directBasketDifference * 12);

  const pocketImpact: PocketImpactBreakdown = {
    ibgeMonthlyEffect,
    ibgeAnnualEffect,
    houseMonthlyEffect,
    houseAnnualEffect,
    directBasketDifference,
    directBasketAnnual,
    monthlyRealVariation: houseMonthlyEffect,
    annualRealVariation: houseAnnualEffect,
    annualizationNotice:
      'Os valores anuais estimam a continuidade do gasto mensal observado por 12 meses consecutivos; não representam despesa histórica já paga em meses anteriores.',
  };

  const chainedSeries =
    priceHistory && priceHistory.length >= 2
      ? calculateChainedMonthlyIndex(activeItems, priceHistory)
      : [];

  const timeframeLabels: Record<TimeframeWindow, string> = {
    '12M': 'Últimos 12 meses',
    YTD: 'Ano corrente (YTD)',
    '1M': 'Último mês',
    CUSTOM:
      customStart && customEnd
        ? `Personalizado (${formatDateRangeLabel(customStart, customEnd)})`
        : 'Período personalizado',
  };

  // Trilhas de Auditoria e Rastreabilidade (§5)
  const periodRefText =
    timeframe === 'CUSTOM' && customStart && customEnd
      ? formatDateRangeLabel(customStart, customEnd)
      : timeframeLabels[timeframe] || 'Últimos 12 meses';

  const traces: CalculationTrace[] = [
    {
      id: 'ipca_casa',
      label: 'IPCA-Casa Ponderado',
      formula:
        methodologyCode === 'laspeyres_classico'
          ? 'IL = [Σ(P₁ × Q₀) / Σ(P₀ × Q₀)] × 100; Variação = IL - 100'
          : 'Σ [(G_base,i / G_base_total) × ((P₁,i / P₀,i) - 1) × 100]',
      inputsSummary: `${eligibleItemsCount} itens comparáveis (cobertura ${comparableCoveragePercent.toFixed(1).replace('.', ',')}% do gasto de consumo)`,
      referencePeriod: periodRefText,
      unit: '% / p.p.',
      resultDisplay: formatSignedPercent(ipcaCasa12M),
      dataOrigin: options?.isDemo ? 'demonstrativo' : 'usuario',
      premises: [
        'Pesos-base normalizados a 100% dentro do conjunto de consumo comparável.',
        'Amortização de dívidas, aplicações financeiras e transferências são excluídas do índice de consumo.',
      ],
      limitations:
        incompleteItemsCount > 0
          ? [`${incompleteItemsCount} item(ns) sem histórico/comparabilidade excluído(s) da variação.`]
          : ['Cobertura integral dos itens ativos de consumo.'],
      validityStatus: eligibleItemsCount > 0 ? (incompleteItemsCount > 0 ? 'parcial' : 'valido') : 'indisponivel',
    },
    {
      id: 'spread_ibge',
      label: 'Spread vs. IPCA Oficial',
      formula: 'Spread (p.p.) = IPCA-Casa − IPCA Oficial IBGE',
      inputsSummary: `${formatSignedPercent(ipcaCasa12M)} − ${formatSignedPercent(safeOfficialIBGE12M)}`,
      referencePeriod: periodRefText,
      unit: 'p.p.',
      resultDisplay: formatSignedPP(spreadPP),
      dataOrigin: 'oficial_ibge',
      premises: ['Comparação realizada contra referência equivalente da série SIDRA/IBGE 1737.'],
      limitations: ['O IPCA oficial utiliza estrutura da POF 2017/2018 (1 a 40 SM) distinta de cestas individuais.'],
      validityStatus: eligibleItemsCount > 0 ? 'valido' : 'parcial',
    },
    {
      id: 'budget_decomposition',
      label: 'Decomposição da Variação Orçamentária',
      formula: 'ΔG = (P₁−P₀)·Q₀ [Preços] + P₀·(Q₁−Q₀) [Quant.] + (P₁−P₀)·(Q₁−Q₀) [Misto]',
      inputsSummary: `Base ${formatCurrencyBR(budgetDecomposition.baseCostTotal)} → Atual ${formatCurrencyBR(budgetDecomposition.currentCostTotal)}`,
      referencePeriod: periodRefText,
      unit: 'R$/mês',
      resultDisplay: formatCurrencyBR(budgetDecomposition.totalSpendChangeReais),
      dataOrigin: options?.isDemo ? 'demonstrativo' : 'usuario',
      premises: ['Separação algébrica exata entre efeito-preço (inflação pura) e alteração física de consumo.'],
      limitations:
        methodologyCode !== 'laspeyres_classico'
          ? ['Sem quantidades Q₀ e Q₁ distintas informadas, assume-se quantidade constante no efeito-preço.']
          : [],
      validityStatus: eligibleItemsCount > 0 ? 'valido' : 'indisponivel',
    },
  ];

  return {
    totalMonthlySpend,
    nonConsumptionSpend: nonConsumptionFlows.totalNonConsumption,
    totalItemsCount: calculatedItems.length,
    eligibleItemsCount,
    ignoredItemsCount,
    incompleteItemsCount,
    essentialCount: calculatedItems.filter((i) => i.classification === 'Essencial').length,
    superfluousCount: calculatedItems.filter(
      (i) => i.classification === 'Supérfluo' || i.classification === 'Discricionário'
    ).length,
    unclassifiedCount: calculatedItems.filter((i) => i.classification === 'Não classificado').length,
    ipcaCasa12M,
    ipcaIBGE12M: safeOfficialIBGE12M,
    spreadPP,
    sumOfWeights,
    comparableCoveragePercent,
    timeframeLabel: timeframeLabels[timeframe] || 'Últimos 12 meses',
    activeTimeframe: timeframe,
    periodStartDate: customStart || dateInitial,
    periodEndDate: customEnd || dateFinal,
    methodology,
    budgetDecomposition,
    householdIndicators,
    chainedSeries,
    calculatedItems,
    groupContributions,
    topIncreases,
    topReliefs,
    topVillains,
    purchasingPower,
    pocketImpact,
    traces,
  };
}

/**
 * 45. Constrói pacote padronizado de exportação de relatórios garantindo paridade integral com o motor.
 */
export function buildReportExportData(params: {
  summary: EconomicCalculationSummary;
  profile: FamilyProfile | null;
  isDemo: boolean;
  ibgeOriginLabel: string;
  ibgeReferenceMonth: string;
  plansA: SubstitutePlanA[];
  plansB: EfficiencyPlanB[];
  planC?: OpportunityPlanC;
}): ReportExportPayload {
  const { summary, profile, isDemo, ibgeOriginLabel, ibgeReferenceMonth, plansA, plansB, planC } =
    params;

  const activePlansA = plansA.filter((p) => p.applied);
  const activePlansB = plansB.filter((p) => p.applied);
  const planATotalMonthly = normalizeZero(
    activePlansA.reduce((acc, p) => acc + (Number(p.monthlySavings) || 0), 0)
  );
  const planBTotalMonthly = normalizeZero(
    activePlansB.reduce((acc, p) => acc + (Number(p.estimatedMonthlySavings) || 0), 0)
  );

  let planCNetProjection36M = 0;
  let planCConsidered = false;
  if (planC && (planC.monthlyInvestment > 0 || (planC.initialCapital ?? 0) > 0)) {
    planCConsidered = true;
    const sim = simulatePlanC({
      initialCapital: planC.initialCapital,
      monthlyDeposit: planC.monthlyInvestment,
      termMonths: 36,
      nominalAnnualRatePercent: planC.nominalAnnualRate,
      expectedAnnualInflationPercent: planC.expectedAnnualInflation,
      productType: planC.productType,
      compoundingFrequency: planC.compoundingFrequency,
      depositTiming: planC.depositTiming,
      taxMode: planC.taxMode,
      manualTaxRatePercent: planC.manualTaxRate,
      adminFeeAnnualPercent: planC.adminFeeAnnual,
      custodyFeeAnnualPercent: planC.custodyFeeAnnual,
    });
    planCNetProjection36M = sim.netFutureValue;
  }

  return {
    generatedAt: new Date().toISOString(),
    profile,
    isDemo,
    timeframeLabel: summary.timeframeLabel,
    ibgeOriginLabel,
    ibgeReferenceMonth,
    summary: {
      ipcaCasaPercent: summary.ipcaCasa12M,
      ipcaOficialPercent: summary.ipcaIBGE12M,
      spreadPP: summary.spreadPP,
      totalMonthlySpend: summary.totalMonthlySpend,
      nonConsumptionSpend: summary.nonConsumptionSpend,
      comparableCoveragePercent: summary.comparableCoveragePercent,
      methodologyLabel: summary.methodology.methodologyLabel,
    },
    householdIndicators: summary.householdIndicators,
    purchasingPower: summary.purchasingPower,
    budgetDecomposition: summary.budgetDecomposition,
    groupContributions: summary.groupContributions,
    topVillains: summary.topVillains.map((v) => ({
      name: v.name,
      group: v.group,
      weightPercent: v.weightPercent,
      priceChangePercent: v.priceChangePercent,
      weightedContribution: v.weightedContribution,
    })),
    activeStrategies: {
      planATotalMonthly,
      planBTotalMonthly,
      totalMonthlyPotential: normalizeZero(planATotalMonthly + planBTotalMonthly),
      planCNetProjection36M,
      planCConsidered,
      itemsCountA: activePlansA.length,
      itemsCountB: activePlansB.length,
    },
    premises: [
      `Metodologia aplicada: ${summary.methodology.methodologyLabel}.`,
      'Pesos orçamentários normalizados em 100% exclusivamente dentro dos itens de consumo comparáveis.',
      'Periodicidades inferiores a 1 mês utilizam convenção explícita de 30 dias; despesas anuais são divididas por 12 como equivalência mensal.',
      'Simulações dos Planos A, B e C refletem potenciais ou projeções hipotéticas condicionadas às premissas declaradas.',
    ],
    limitations: [
      summary.incompleteItemsCount > 0
        ? `${summary.incompleteItemsCount} item(ns) incompleto(s) ou sem comparabilidade não entrou(aram) no cômputo de inflação.`
        : 'Todos os itens ativos de consumo possuem preços comparáveis no período.',
      'Este relatório privado possui caráter analítico doméstico e não substitui auditoria contábil ou estatística oficial.',
    ],
    sources: [
      `IBGE / SIDRA (Tabelas 1737 e 7060) — Status: ${ibgeOriginLabel}${ibgeReferenceMonth ? ` (${ibgeReferenceMonth})` : ''}`,
      isDemo
        ? 'Dados financeiros do perfil demonstrativo educativo do IPCA-Casa'
        : 'Dados financeiros e cotações cadastrados pelo usuário titular na plataforma IPCA-Casa',
    ],
  };
}

/**
 * 50. Detecta alertas de aumento de preço apenas quando há comparabilidade real de unidade/especificação.
 * Calcula tanto o aumento percentual (%) quanto a diferença absoluta (R$) no preço unitário e no orçamento mensal.
 */
export function detectComparablePriceAlerts(
  items: Array<BasketItem | CalculatedBasketItem>,
  priceHistory: PriceRecord[] = [],
  thresholdPercent = 10
): ComparablePriceAlert[] {
  const safeThreshold = Number.isFinite(thresholdPercent) && thresholdPercent > 0 ? thresholdPercent : 10;
  const alerts: ComparablePriceAlert[] = [];

  for (const item of items || []) {
    if (!item.active || item.isArchived || item.comparabilityBroken) continue;
    if (!isConsumptionAccountingType(item.accountingType)) continue;

    // Primeiro verifica se há >= 2 cotações compatíveis recentes no histórico para comparação entre registros
    const itemQuotes = (priceHistory || [])
      .filter(
        (rec) =>
          rec.itemId === item.id &&
          !rec.comparabilityBroken &&
          Number.isFinite(rec.price) &&
          rec.price > 0 &&
          areUnitsCompatible(item.packageUnit || item.unit || 'un', rec.packageUnit || rec.unit || item.unit || 'un')
      )
      .map((rec) => ({
        rec,
        iso: extractIsoDatePrefix(rec.referenceDate || rec.date) || '',
      }))
      .filter((x) => x.iso !== '')
      .sort((a, b) => a.iso.localeCompare(b.iso));

    let refOldPrice = Number(item.oldPrice);
    let refCurrentPrice = Number(item.currentPrice);
    let refOldUnit = item.packageUnit || item.unit || 'un';
    let refCurrentUnit = item.packageUnit || item.unit || 'un';
    let refOldSize = item.packageSize && item.packageSize > 0 ? item.packageSize : 1;
    let refCurrentSize = item.packageSize && item.packageSize > 0 ? item.packageSize : 1;

    if (itemQuotes.length >= 2) {
      const prevQ = itemQuotes[itemQuotes.length - 2].rec;
      const currQ = itemQuotes[itemQuotes.length - 1].rec;
      // Só substitui se os preços base P0->P1 no item não mostrarem variação ainda maior ou se P0 não existir
      const normHistory = calculateNormalizedPriceVariation({
        oldPrice: prevQ.price,
        currentPrice: currQ.price,
        oldPackageSize: prevQ.packageSize,
        oldPackageUnit: prevQ.packageUnit || prevQ.unit || item.unit,
        currentPackageSize: currQ.packageSize,
        currentPackageUnit: currQ.packageUnit || currQ.unit || item.unit,
      });
      if (
        normHistory.comparable &&
        normHistory.variationPercent !== null &&
        normHistory.variationPercent >= safeThreshold &&
        (!(refOldPrice > 0) || normHistory.variationPercent >= (calculatePriceVariation(refOldPrice, refCurrentPrice) ?? 0))
      ) {
        refOldPrice = prevQ.price;
        refCurrentPrice = currQ.price;
        refOldUnit = prevQ.packageUnit || prevQ.unit || item.unit || 'un';
        refCurrentUnit = currQ.packageUnit || currQ.unit || item.unit || 'un';
        refOldSize = prevQ.packageSize && prevQ.packageSize > 0 ? prevQ.packageSize : 1;
        refCurrentSize = currQ.packageSize && currQ.packageSize > 0 ? currQ.packageSize : 1;
      }
    }

    const norm = calculateNormalizedPriceVariation({
      oldPrice: refOldPrice,
      currentPrice: refCurrentPrice,
      oldPackageSize: refOldSize,
      oldPackageUnit: refOldUnit,
      currentPackageSize: refCurrentSize,
      currentPackageUnit: refCurrentUnit,
      comparabilityBroken: item.comparabilityBroken,
    });

    if (!norm.comparable || norm.variationPercent === null || norm.variationPercent < safeThreshold) {
      continue;
    }

    const absChange =
      norm.normalizedCurrentUnitPrice !== null && norm.normalizedOldUnitPrice !== null
        ? normalizeZero(norm.normalizedCurrentUnitPrice - norm.normalizedOldUnitPrice)
        : normalizeZero(refCurrentPrice - refOldPrice);

    const eff = resolveEffectiveMonthlySpend(item);
    const monthlySpend = eff.monthlySpend;
    const monthlyImpactReais =
      monthlySpend > 0 && norm.variationPercent > -100
        ? normalizeZero(monthlySpend - monthlySpend / (1 + norm.variationPercent / 100))
        : Math.max(0, absChange);

    alerts.push({
      itemId: item.id,
      itemName: item.name,
      group: item.group || 'Outros',
      unit: norm.canonicalUnit || item.unit || 'un',
      oldPrice: norm.normalizedOldUnitPrice ?? refOldPrice,
      currentPrice: norm.normalizedCurrentUnitPrice ?? refCurrentPrice,
      absoluteChangeReais: absChange,
      percentChange: normalizeZero(norm.variationPercent),
      monthlyImpactReais,
      thresholdUsed: safeThreshold,
      isEstimatedConversion: eff.isMonthlyEquivalence,
    });
  }

  return alerts.sort((a, b) => b.monthlyImpactReais - a.monthlyImpactReais || b.percentChange - a.percentChange);
}

/**
 * 51. Recomendações explicadas em linguagem simples, separando Efeito Preço, Efeito Quantidade,
 * Composição por Categoria e Equilíbrio Financeiro (Personal/Business friendly, sem recomendações genéricas inventadas).
 */
export function generateStructuredRecommendations(params: {
  summary: EconomicCalculationSummary;
  closures?: MonthlyClosure[];
  profileMode?: ProfileMode;
}): {
  hasSufficientData: boolean;
  insufficientReason?: string;
  recommendations: StructuredRecommendation[];
} {
  const { summary, closures = [], profileMode = 'pessoal' } = params;
  const isBiz = profileMode === 'negocio';

  if (!summary || summary.totalMonthlySpend <= 0 || summary.eligibleItemsCount === 0) {
    return {
      hasSufficientData: false,
      insufficientReason:
        summary?.totalMonthlySpend > 0
          ? 'Os itens cadastrados ainda não têm preço anterior para comparação. Informe o preço anterior de pelo menos 1 item para destravar as recomendações explicadas.'
          : isBiz
          ? 'Cadastre seus primeiros insumos ou custos operacionais com preço anterior e atual para gerar recomendações baseadas nos seus números.'
          : 'Cadastre seus primeiros gastos com preço anterior e atual para receber recomendações claras sobre seu orçamento.',
      recommendations: [
        {
          id: 'rec-insufficient',
          driverType: 'insuficiente',
          title: 'Complete os preços de comparação para ver diagnósticos',
          summary:
            summary?.totalMonthlySpend > 0
              ? 'Já sabemos quanto você gasta no mês, mas falta o preço anterior para separar o que subiu de preço do que mudou por quantidade.'
              : isBiz
              ? 'Adicione seus principais insumos e custos fixos com preço anterior e atual.'
              : 'Adicione seus principais gastos da casa com preço anterior e atual.',
          effectDetail: 'Sem dados suficientes de comparação temporal.',
          actionLabel: isBiz ? 'Ir para Insumos e Custos' : 'Ir para Minha Cesta',
          targetTab: 'minha-cesta-familiar',
        },
      ],
    };
  }

  const recommendations: StructuredRecommendation[] = [];

  // 1. Efeito Preço (item comparável que mais pesou no aumento real em R$)
  const topPriceItem = [...summary.calculatedItems]
    .filter((i) => i.isComparable && i.priceEffectReais > 0)
    .sort((a, b) => b.priceEffectReais - a.priceEffectReais)[0];

  if (topPriceItem) {
    const pctText = formatSignedPercent(topPriceItem.priceChangePercent ?? 0);
    recommendations.push({
      id: `rec-price-${topPriceItem.id}`,
      driverType: 'preco',
      title: `Aumento de preço em ${topPriceItem.name}`,
      summary: isBiz
        ? `Mesmo comprando a mesma quantidade, o custo unitário de ${topPriceItem.name} subiu ${pctText} e adicionou ${formatCurrencyBR(topPriceItem.priceEffectReais)}/mês na operação.`
        : `Mesmo mantendo a mesma quantidade, a alta de preço de ${topPriceItem.name} (${pctText}) encareceu seu mês em ${formatCurrencyBR(topPriceItem.priceEffectReais)}.`,
      effectDetail: `Efeito Preço puro: +${formatCurrencyBR(topPriceItem.priceEffectReais)}/mês (${topPriceItem.weightPercent.toFixed(1).replace('.', ',')}% do peso comparável).`,
      itemName: topPriceItem.name,
      categoryName: topPriceItem.group,
      amountReais: topPriceItem.priceEffectReais,
      percentValue: topPriceItem.priceChangePercent ?? undefined,
      actionLabel: 'Avaliar substituição',
      targetTab: 'estrategias-de-economia',
    });
  }

  // 2. Efeito Quantidade / Volume (via decomposição algébrica ou comparação entre último fechamento mensal)
  const sortedClosures = [...closures].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const lastClosure = sortedClosures.length > 0 ? sortedClosures[sortedClosures.length - 1] : undefined;
  const qtyEffect = summary.budgetDecomposition.quantityEffectReais;

  if (Math.abs(qtyEffect) >= 1) {
    const grewQty = qtyEffect > 0;
    recommendations.push({
      id: 'rec-qty-decomposition',
      driverType: 'quantidade',
      title: grewQty
        ? isBiz
          ? 'Aumento por volume consumido de insumos'
          : 'Seu gasto cresceu também por aumento na quantidade consumida'
        : isBiz
        ? 'Redução de volume físico compensou parte da alta de preços'
        : 'Redução de quantidade ajudou a segurar o gasto mensal',
      summary: grewQty
        ? `Além dos preços, a mudança nas quantidades informadas (Q₁ vs Q₀) elevou a despesa em ${formatCurrencyBR(qtyEffect)}/mês.`
        : `Você reduziu o volume consumido em relação à base, gerando economia física de ${formatCurrencyBR(Math.abs(qtyEffect))}/mês independentemente dos preços.`,
      effectDetail: `Efeito Quantidade separado do preço: ${qtyEffect >= 0 ? '+' : '-'}${formatCurrencyBR(Math.abs(qtyEffect))}/mês.`,
      amountReais: qtyEffect,
      actionLabel: 'Ajustar metas de consumo',
      targetTab: 'estrategias-de-economia',
    });
  } else if (lastClosure && lastClosure.totalMonthlySpend > 0) {
    const spendDelta = normalizeZero(summary.totalMonthlySpend - lastClosure.totalMonthlySpend);
    if (Math.abs(spendDelta) >= 1) {
      recommendations.push({
        id: 'rec-qty-closure-diff',
        driverType: 'quantidade',
        title: `Diferença de ${formatCurrencyBR(Math.abs(spendDelta))} frente a ${lastClosure.monthLabel}`,
        summary:
          spendDelta > 0
            ? `Frente ao fechamento de ${lastClosure.monthLabel} (${formatCurrencyBR(lastClosure.totalMonthlySpend)}), o gasto subiu ${formatCurrencyBR(spendDelta)}. Parte vem da inflação pura (${formatCurrencyBR(summary.budgetDecomposition.priceEffectReais)}) e o restante de novos itens ou quantidades.`
            : `Frente ao fechamento de ${lastClosure.monthLabel} (${formatCurrencyBR(lastClosure.totalMonthlySpend)}), o gasto recuou ${formatCurrencyBR(Math.abs(spendDelta))}.`,
        effectDetail: `Comparação mensal real vs. fechamento ${lastClosure.monthLabel}.`,
        amountReais: spendDelta,
        actionLabel: 'Ver fechamentos mensais',
        targetTab: 'relatorios',
      });
    }
  }

  // 3. Concentração por Categoria (Efeito Composição / Peso)
  const topCategory = summary.groupContributions[0];
  if (topCategory && topCategory.weightPercent > 0) {
    recommendations.push({
      id: `rec-category-${topCategory.group}`,
      driverType: 'composicao',
      title: `${topCategory.group} concentra ${topCategory.weightPercent.toFixed(1).replace('.', ',')}% do orçamento`,
      summary: isBiz
        ? `A categoria "${topCategory.group}" responde por ${formatCurrencyBR(topCategory.totalSpend)}/mês${topCategory.groupInflationPercent !== null ? ` com variação média de ${formatSignedPercent(topCategory.groupInflationPercent)}` : ''}. Pequenos reajustes aqui movem todo o custo do negócio.`
        : `A categoria "${topCategory.group}" soma ${formatCurrencyBR(topCategory.totalSpend)}/mês${topCategory.groupInflationPercent !== null ? ` e subiu ${formatSignedPercent(topCategory.groupInflationPercent)}` : ''}. É onde qualquer economia tem o maior efeito no bolso.`,
      effectDetail: `Peso por Categoria: ${topCategory.weightPercent.toFixed(1).replace('.', ',')}% do gasto mensal total.`,
      categoryName: topCategory.group,
      amountReais: topCategory.totalSpend,
      percentValue: topCategory.weightPercent,
      actionLabel: 'Filtrar categoria',
      targetTab: 'minha-cesta-familiar',
    });
  }

  // 4. Equilíbrio Financeiro (Renda / Faturamento vs Gasto)
  const indicators = summary.householdIndicators;
  if (indicators.monthlyBalance !== null && indicators.netIncome !== null && indicators.netIncome > 0) {
    const deficit = indicators.monthlyBalance < 0;
    recommendations.push({
      id: 'rec-balance',
      driverType: 'equilibrio',
      title: deficit
        ? isBiz
          ? 'Custos superam o faturamento informado'
          : 'Gastos maiores que a renda informada'
        : isBiz
        ? `Margem mensal positiva de ${formatCurrencyBR(indicators.monthlyBalance)}`
        : `Sobra mensal estimada de ${formatCurrencyBR(indicators.monthlyBalance)}`,
      summary: deficit
        ? `Os compromissos somam ${formatCurrencyBR(indicators.totalCommitments)} frente a ${formatCurrencyBR(indicators.netIncome)} de entrada (déficit de ${formatCurrencyBR(Math.abs(indicators.monthlyBalance))}/mês).`
        : summary.purchasingPower.realPurchasingPowerChangePercent !== null &&
          summary.purchasingPower.realPurchasingPowerChangePercent < 0
        ? `Apesar da sobra de ${formatCurrencyBR(indicators.monthlyBalance)}, seu ganho de renda não acompanhou sua inflação (${formatSignedPercent(summary.purchasingPower.realPurchasingPowerChangePercent)} real).`
        : `Seus gastos consomem ${(indicators.expenseToIncomePercent ?? 0).toFixed(1).replace('.', ',')}% da entrada mensal, preservando margem para reserva.`,
      effectDetail: `Renda/Faturamento ${formatCurrencyBR(indicators.netIncome)} vs. Compromissos ${formatCurrencyBR(indicators.totalCommitments)}.`,
      amountReais: indicators.monthlyBalance,
      actionLabel: isBiz ? 'Ver Faturamento e Margem' : 'Ver Renda e Poder de Compra',
      targetTab: 'renda-e-poder-de-compra',
    });
  }

  return {
    hasSufficientData: recommendations.length > 0,
    recommendations,
  };
}

const MONTHS_SHORT_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function formatMonthKeyLabel(monthKey: string): string {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const yearShort = match[1].slice(-2);
  const monthIdx = Math.max(0, Math.min(11, parseInt(match[2], 10) - 1));
  return `${MONTHS_SHORT_PT[monthIdx]}/${yearShort}`;
}

export function buildMonthlyClosureSnapshot(params: {
  profileId: string;
  monthKey: string;
  summary: EconomicCalculationSummary;
  ibgeData?: { sourceMode?: 'live' | 'cached_live' | 'contingency'; latestMonthLabel?: string } | null;
  profileMode?: ProfileMode;
  isDemo?: boolean;
  notes?: string;
}): MonthlyClosure {
  const cleanMonthKey = /^\d{4}-\d{2}$/.test(params.monthKey)
    ? params.monthKey
    : getTodayIsoDate().slice(0, 7);
  const topCat = params.summary.groupContributions[0];
  const topDriver = params.summary.topIncreases[0] || params.summary.topVillains[0];

  return {
    id: `cls_${params.profileId}_${cleanMonthKey}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
    profileId: params.profileId,
    monthKey: cleanMonthKey,
    monthLabel: formatMonthKeyLabel(cleanMonthKey),
    profileMode: params.profileMode || 'pessoal',
    totalMonthlySpend: params.summary.totalMonthlySpend,
    comparableBaseCost: params.summary.budgetDecomposition.baseCostTotal,
    ipcaCasaPercent: params.summary.ipcaCasa12M,
    ipcaOficialPercent: params.summary.ipcaIBGE12M,
    spreadPP: params.summary.spreadPP,
    itemsCount: params.summary.totalItemsCount,
    eligibleItemsCount: params.summary.eligibleItemsCount,
    monthlyIncome: params.summary.householdIndicators.netIncome ?? undefined,
    monthlyBalance: params.summary.householdIndicators.monthlyBalance ?? undefined,
    topCategory: topCat?.group,
    topDriverName: topDriver?.name,
    topDriverChangePercent: topDriver?.priceChangePercent ?? undefined,
    priceEffectReais: params.summary.budgetDecomposition.priceEffectReais,
    quantityEffectReais: params.summary.budgetDecomposition.quantityEffectReais,
    mixEffectReais: params.summary.budgetDecomposition.mixEffectReais,
    ibgeSourceMode: params.ibgeData?.sourceMode,
    ibgeReferenceMonth: params.ibgeData?.latestMonthLabel,
    dataOrigin: params.isDemo ? 'demonstrativo' : 'usuario',
    notes: params.notes,
    closedAt: getTodayIsoDate(),
  };
}

export function compareMonthlyClosures(
  currentClosure: MonthlyClosure,
  previousClosure: MonthlyClosure
): {
  spendDiffReais: number;
  spendDiffPercent: number | null;
  ipcaCasaDiffPP: number;
  spreadDiffPP: number;
  balanceDiffReais: number | null;
  summaryText: string;
} {
  const spendDiffReais = normalizeZero(
    currentClosure.totalMonthlySpend - previousClosure.totalMonthlySpend
  );
  const spendDiffPercent =
    previousClosure.totalMonthlySpend > 0
      ? normalizeZero((spendDiffReais / previousClosure.totalMonthlySpend) * 100)
      : null;
  const ipcaCasaDiffPP = normalizeZero(
    currentClosure.ipcaCasaPercent - previousClosure.ipcaCasaPercent
  );
  const spreadDiffPP = normalizeZero(currentClosure.spreadPP - previousClosure.spreadPP);
  const balanceDiffReais =
    typeof currentClosure.monthlyBalance === 'number' &&
    typeof previousClosure.monthlyBalance === 'number'
      ? normalizeZero(currentClosure.monthlyBalance - previousClosure.monthlyBalance)
      : null;

  const direction =
    spendDiffReais > 0
      ? `aumento de ${formatCurrencyBR(spendDiffReais)}`
      : spendDiffReais < 0
      ? `redução de ${formatCurrencyBR(Math.abs(spendDiffReais))}`
      : 'estabilidade';

  const summaryText = `De ${previousClosure.monthLabel} para ${currentClosure.monthLabel}, o gasto mensal teve ${direction}${spendDiffPercent !== null ? ` (${formatSignedPercent(spendDiffPercent)})` : ''}, com variação do IPCA-Casa de ${formatSignedPP(ipcaCasaDiffPP)}.`;

  return {
    spendDiffReais,
    spendDiffPercent,
    ipcaCasaDiffPP,
    spreadDiffPP,
    balanceDiffReais,
    summaryText,
  };
}

