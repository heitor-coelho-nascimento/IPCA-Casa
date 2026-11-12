export type ItemClassification = 'Essencial' | 'Supérfluo' | 'Discricionário' | 'Não classificado';
export type ExpenseClassification = ItemClassification;
export type ExpenseNature = 'Fixa' | 'Variável';
export type RecurrenceType = 'Recorrente' | 'Eventual';
export type AccountingType =
  | 'Consumo'
  | 'Amortização de dívida'
  | 'Aplicação financeira'
  | 'Transferência';

export type ConsumptionFrequency =
  | 'mensal'
  | 'quinzenal'
  | 'semanal'
  | 'diaria'
  | 'anual'
  | 'personalizada_dias';

export type DataOrigin =
  | 'usuario'
  | 'oficial_ibge'
  | 'demonstrativo'
  | 'estimado'
  | 'simulado'
  | 'cache';

export type DataCompletenessState =
  | 'ok'
  | 'nao_informado'
  | 'indisponivel'
  | 'invalido'
  | 'estimado'
  | 'desatualizado'
  | 'sem_comparabilidade';

export type TimeframeWindow = '12M' | 'YTD' | '1M' | 'CUSTOM';
export type TimeframeOption = TimeframeWindow;
export type PocketImpactPerspective = 'ipca-oficial' | 'ipca-casa' | 'variacao-cesta';

export type ItemDataStatus = 'Completo' | 'Incompleto' | 'Arquivado';

export type ImpactLevel =
  | 'Crítico'
  | 'Alto'
  | 'Moderado'
  | 'Baixo'
  | 'Estável'
  | 'Alívio'
  | 'Incompleto';

export type StrategyStatus = 'potencial' | 'simulada' | 'planejada' | 'realizada';

export type InvestmentProductType =
  | 'poupanca'
  | 'cdb'
  | 'tesouro_selic'
  | 'tesouro_prefixado'
  | 'tesouro_ipca'
  | 'fundos'
  | 'outros';

export type CompoundingFrequency = 'mensal' | 'diaria' | 'anual';
export type DepositTiming = 'fim' | 'inicio';
export type TaxMode = 'automatica' | 'manual' | 'isento' | 'bruto';

export type EconomicGroup =
  | 'Alimentação e bebidas'
  | 'Habitação'
  | 'Artigos de residência'
  | 'Vestuário'
  | 'Transportes'
  | 'Saúde e cuidados pessoais'
  | 'Despesas pessoais'
  | 'Educação'
  | 'Comunicação'
  | string;

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp?: number;
}

export interface ConsumptionGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  nationalWeightIBGE?: number;
  isCustom?: boolean;
  active?: boolean;
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  authProvider?: 'google' | 'password' | 'email';
  emailVerified?: boolean;
  createdAt: string;
  lastLoginAt: string;
  lastSyncAt?: string;
  profileId: string;
}

export interface AuthSession {
  user: UserAccount;
  token?: string;
  expiresAt?: string;
}

export type ProfileMode = 'pessoal' | 'negocio';

export interface FamilyProfile {
  id: string;
  name: string;
  profileMode?: ProfileMode;
  priceAlertThresholdPercent?: number;
  membersCount: number;
  referenceRegion: string;
  currency: 'BRL' | string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BasketItem {
  id: string;
  profileId?: string;
  name: string;
  description?: string;
  group: EconomicGroup;
  subcategory?: string;
  classification: ItemClassification;
  monthlySpend: number;
  oldPrice: number;
  currentPrice: number;
  oldPriceDate: string;
  currentPriceDate: string;
  unit: string;
  quantity?: number;
  baseQuantity?: number;
  packageSize?: number;
  packageUnit?: string;
  consumptionFrequency?: ConsumptionFrequency;
  frequencyDays?: number;
  expenseNature?: ExpenseNature;
  recurrenceType?: RecurrenceType;
  accountingType?: AccountingType;
  comparabilityBroken?: boolean;
  comparabilityReason?: string;
  dataOrigin?: DataOrigin;
  notes?: string;
  active: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PriceRecord {
  id: string;
  profileId?: string;
  itemId: string;
  itemName?: string;
  price: number;
  referenceDate: string;
  date?: string;
  unit?: string;
  source?: string;
  origin?: string;
  region?: string;
  packageSize?: number;
  packageUnit?: string;
  dataOrigin?: DataOrigin;
  comparabilityBroken?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  isDemo?: boolean;
}

export type PriceHistory = PriceRecord;

export interface IncomeRecord {
  id: string;
  profileId: string;
  referenceDate: string;
  nominalIncome: number;
  source?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  // Campos opcionais estendidos para diagnóstico financeiro completo (§21, §28, §35)
  grossIncome?: number;
  netIncome?: number;
  incomeType?: string;
  debtObligations?: number;
  financialApplications?: number;
  transfers?: number;
  availableReserve?: number;
  workingDaysPerMonth?: number;
}

export interface SubstitutePlanA {
  id: string;
  profileId?: string;
  originalItemId: string;
  originalItemName: string;
  originalPrice: number;
  originalPackageSize?: number;
  originalPackageUnit?: string;
  substituteName: string;
  substitutePrice: number;
  substitutePackageSize?: number;
  substitutePackageUnit?: string;
  monthlyQuantity?: number;
  monthlySavings: number;
  qualitativeTradeoff: string;
  unit?: string;
  notes?: string;
  status?: StrategyStatus;
  applied: boolean;
}

export interface EfficiencyPlanB {
  id: string;
  profileId?: string;
  resourceName: string;
  resourceCategory?: 'energia' | 'agua' | 'combustivel' | 'gas' | 'internet' | 'outros';
  unit: string;
  tariffPerUnit: number;
  fixedFee?: number;
  extraCharges?: number;
  tariffSource?: string;
  tariffDate?: string;
  tieredTariffNote?: string;
  currentConsumption: number;
  targetConsumption: number;
  currentSpend: number;
  estimatedMonthlySavings: number;
  progressPercent: number;
  status?: StrategyStatus;
  applied: boolean;
  notes?: string;
}

export interface OpportunityPlanC {
  id: string;
  profileId?: string;
  initialCapital?: number;
  monthlyInvestment: number;
  termMonths?: number;
  nominalAnnualRate: number;
  expectedAnnualInflation: number;
  realAnnualYield: number;
  projection12Months: number;
  projection24Months: number;
  projection36Months: number;
  productType?: InvestmentProductType;
  compoundingFrequency?: CompoundingFrequency;
  depositTiming?: DepositTiming;
  taxMode?: TaxMode;
  manualTaxRate?: number;
  adminFeeAnnual?: number;
  custodyFeeAnnual?: number;
  useLinkedSavings?: boolean;
  isSimulated?: boolean;
  status?: StrategyStatus;
  notes?: string;
  updatedAt?: string;
}

export interface IBGEHistoricalPoint {
  date: string; // 'YYYY-MM-01'
  monthCode?: string; // 'YYYYMM'
  label: string; // 'Fev/26'
  monthlyRate: number;
  accumulated12M: number;
  accumulatedYear: number | null;
}

export interface CalculatedBasketItem extends BasketItem {
  priceChangePercent: number | null;
  weightPercent: number; // Peso-base normalizado dentro do subconjunto comparável (soma = 100%)
  baseWeightPercent: number;
  currentWeightPercent: number;
  budgetSharePercent: number; // Participação sobre TODA a despesa de consumo ativa
  weightedContribution: number;
  impactLevel: ImpactLevel;
  isVillain: boolean;
  isDataComplete: boolean;
  isPriceChangeAvailable: boolean;
  dataStatus: ItemDataStatus;
  dataState: DataCompletenessState;
  dataOriginResolved: DataOrigin;
  isConsumptionItem: boolean;
  isComparable: boolean;
  exclusionReason?: string;
  baseCostReais: number;
  currentCostOfBaseReais: number;
  priceEffectReais: number;
  quantityEffectReais: number;
  mixEffectReais: number;
  spendChangeReais: number;
  normalizedCurrentUnitPrice: number | null;
  normalizedBaseUnitPrice: number | null;
  canonicalUnit: string;
  monthlyEquivalenceNote?: string;
  isMonthlyEquivalence?: boolean;
  effectiveOldPrice: number;
  effectiveCurrentPrice: number;
}

export type CalculatedItem = CalculatedBasketItem;

export interface GroupContribution {
  group: EconomicGroup;
  totalSpend: number;
  baseSpend: number;
  weightPercent: number;
  baseWeightPercent: number;
  currentWeightPercent: number;
  weightedContribution: number;
  groupInflationPercent: number | null;
  groupCoveragePercent: number;
  itemCount: number;
  eligibleItemsCount: number;
  isOfficialIbgeGroup: boolean;
  color: string;
  icon: string;
}

export interface PurchasingPowerAnalysis {
  initialIncome: number | null;
  finalIncome: number | null;
  grossIncome: number | null;
  netIncome: number | null;
  initialDate: string;
  finalDate: string;
  hasIncomeData: boolean;
  nominalIncomeGrowthPercent: number | null;
  appliedInflationPercent: number;
  inflationSource: string;
  realPurchasingPowerChangePercent: number | null;
  neededSalaryForBreakeven: number | null;
  neededSalaryWithRealGain: (targetRealGain: number) => number | null;
  monthlyPurchasingDeficitOrGain: number | null;
  annualizedImpact: number | null;
}

export interface PocketImpactBreakdown {
  ibgeMonthlyEffect: number;
  ibgeAnnualEffect: number;
  houseMonthlyEffect: number;
  houseAnnualEffect: number;
  directBasketDifference: number;
  directBasketAnnual: number;
  monthlyRealVariation: number;
  annualRealVariation: number;
  annualizationNotice: string;
}

export interface LaspeyresResult {
  methodology: 'laspeyres_classico' | 'ponderado_gasto_informado' | 'insuficiente';
  methodologyLabel: string;
  indexValue: number | null;
  variationPercent: number;
  baseBasketCost: number;
  currentCostOfBaseBasket: number;
  comparableCoveragePercent: number;
  comparableItemsCount: number;
  totalConsumptionItemsCount: number;
  sumOfComparableWeights: number;
}

export interface BudgetDecomposition {
  baseCostTotal: number;
  currentCostTotal: number;
  currentCostOfBaseBasket: number;
  priceEffectReais: number;
  quantityEffectReais: number;
  mixEffectReais: number;
  totalSpendChangeReais: number;
  totalSpendChangePercent: number | null;
  reconcilesExact: boolean;
}

export interface HouseholdIndicators {
  netIncome: number | null;
  grossIncome: number | null;
  consumptionExpenses: number;
  debtObligations: number;
  financialApplications: number;
  transfers: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
  totalCommitments: number;
  monthlyBalance: number | null;
  expenseToIncomePercent: number | null;
  savingsRatePercent: number | null;
  essentialSharePercent: number | null;
  debtCommitmentPercent: number | null;
  reserveInMonths: number | null;
  availableReserve: number | null;
  realExpenseVariationPercent: number | null;
  completenessStatus: 'completo' | 'parcial' | 'insuficiente';
  missingFields: string[];
}

export interface ChainedSeriesPoint {
  monthCode: string;
  label: string;
  monthlyChangePercent: number;
  chainedIndexValue: number;
  accumulatedPercent: number;
  comparableItemsCount: number;
  coveragePercent: number;
  compositionChanged: boolean;
}

export interface CalculationTrace {
  id: string;
  label: string;
  formula: string;
  inputsSummary: string;
  referencePeriod: string;
  unit: string;
  resultDisplay: string;
  dataOrigin: DataOrigin;
  premises: string[];
  limitations: string[];
  validityStatus: 'valido' | 'parcial' | 'indisponivel' | 'estimado';
}

export interface EconomicCalculationSummary {
  totalMonthlySpend: number;
  nonConsumptionSpend: number;
  totalItemsCount: number;
  eligibleItemsCount: number;
  ignoredItemsCount: number;
  incompleteItemsCount: number;
  essentialCount: number;
  superfluousCount: number;
  unclassifiedCount: number;
  sumOfWeights: number;
  comparableCoveragePercent: number;
  ipcaCasa12M: number;
  ipcaIBGE12M: number;
  spreadPP: number;
  timeframeLabel: string;
  activeTimeframe: TimeframeWindow;
  periodStartDate?: string;
  periodEndDate?: string;
  methodology: LaspeyresResult;
  budgetDecomposition: BudgetDecomposition;
  householdIndicators: HouseholdIndicators;
  chainedSeries: ChainedSeriesPoint[];
  groupContributions: GroupContribution[];
  calculatedItems: CalculatedBasketItem[];
  topVillains: CalculatedBasketItem[];
  topIncreases: CalculatedBasketItem[];
  topReliefs: CalculatedBasketItem[];
  purchasingPower: PurchasingPowerAnalysis;
  pocketImpact: PocketImpactBreakdown;
  traces: CalculationTrace[];
}

export interface MonetaryCorrectionResult {
  valid: boolean;
  initialAmount: number;
  correctedAmount: number | null;
  differenceReais: number | null;
  accumulatedFactor: number | null;
  accumulatedPercent: number | null;
  indexUsedLabel: string;
  periodLabel: string;
  reason?: string;
}

export interface WorkingDaysEquivalenceResult {
  valid: boolean;
  dailyRate: number | null;
  workingDaysNeeded: number | null;
  purchasableUnitsWithIncome: number | null;
  workingDaysPerMonth: number;
  premiseNote: string;
  reason?: string;
}

export interface NormalizedQuoteStats {
  totalCount: number;
  comparableCount: number;
  excludedCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  averagePrice: number | null;
  latestPrice: number | null;
  oldestPrice: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  canonicalUnit: string;
  isNormalized: boolean;
  averageMethodNote: string;
  minRecord?: PriceRecord;
  maxRecord?: PriceRecord;
  latestRecord?: PriceRecord;
}

export interface PlanCScheduleRow {
  month: number;
  contributedCumulative: number;
  grossBalance: number;
  interestPeriod: number;
  netEstimated: number;
  realValue: number;
}

export interface PlanCSimulationResult {
  valid: boolean;
  productType: InvestmentProductType;
  productLabel: string;
  compoundingFrequency: CompoundingFrequency;
  depositTiming: DepositTiming;
  termMonths: number;
  initialCapital: number;
  monthlyDeposit: number;
  totalContributed: number;
  grossFutureValue: number;
  grossInterest: number;
  estimatedTaxes: number;
  estimatedTaxRatePercent: number;
  estimatedCosts: number;
  netFutureValue: number;
  realFutureValue: number;
  nominalReturnPercent: number;
  realReturnPercent: number;
  taxAppliedLabel: string;
  fgcAndRiskDisclaimer: string;
  liquidityDisclaimer: string;
  missingTaxInfoNote?: string;
  schedule: PlanCScheduleRow[];
}

export interface EconomicScenarioInput {
  id: 'conservador' | 'base' | 'otimista';
  label: string;
  annualInflationPercent: number;
  nominalIncomeGrowthPercent: number;
  priceShockPercent: number;
  consumptionAdjustmentPercent: number;
  monthlyContribution: number;
  unexpectedExpenseMonthly: number;
}

export interface EconomicScenarioResult extends EconomicScenarioInput {
  projectedMonthlyExpense: number;
  projectedMonthlyIncome: number;
  projectedMonthlyBalance: number;
  projectedAnnualBalance: number;
  realIncomeVariationPercent: number;
  projected12MInvestmentNet: number;
  disclaimer: string;
}

export interface SensitivityCell {
  inflationPercent: number;
  incomeGrowthPercent: number;
  consumptionReductionPercent: number;
  projectedExpenseMonthly: number;
  projectedIncomeMonthly: number;
  projectedBalanceMonthly: number;
  realIncomeChangePercent: number;
}

export interface ReportExportPayload {
  generatedAt: string;
  profile: FamilyProfile | null;
  isDemo: boolean;
  timeframeLabel: string;
  ibgeOriginLabel: string;
  ibgeReferenceMonth: string;
  summary: {
    ipcaCasaPercent: number;
    ipcaOficialPercent: number;
    spreadPP: number;
    totalMonthlySpend: number;
    nonConsumptionSpend: number;
    comparableCoveragePercent: number;
    methodologyLabel: string;
  };
  householdIndicators: HouseholdIndicators;
  purchasingPower: PurchasingPowerAnalysis;
  budgetDecomposition: BudgetDecomposition;
  groupContributions: GroupContribution[];
  topVillains: Array<{
    name: string;
    group: string;
    weightPercent: number;
    priceChangePercent: number | null;
    weightedContribution: number;
  }>;
  activeStrategies: {
    planATotalMonthly: number;
    planBTotalMonthly: number;
    totalMonthlyPotential: number;
    planCNetProjection36M: number;
    planCConsidered: boolean;
    itemsCountA: number;
    itemsCountB: number;
  };
  premises: string[];
  limitations: string[];
  sources: string[];
}

export interface MonthlyClosure {
  id: string;
  profileId: string;
  monthKey: string; // 'YYYY-MM'
  monthLabel: string; // 'Nov/26'
  profileMode?: ProfileMode;
  totalMonthlySpend: number;
  comparableBaseCost: number;
  ipcaCasaPercent: number;
  ipcaOficialPercent: number;
  spreadPP: number;
  itemsCount: number;
  eligibleItemsCount: number;
  monthlyIncome?: number | null;
  monthlyBalance?: number | null;
  topCategory?: string;
  topDriverName?: string;
  topDriverChangePercent?: number | null;
  priceEffectReais?: number;
  quantityEffectReais?: number;
  mixEffectReais?: number;
  ibgeSourceMode?: 'live' | 'cached_live' | 'contingency';
  ibgeReferenceMonth?: string;
  dataOrigin?: DataOrigin;
  notes?: string;
  closedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComparablePriceAlert {
  itemId: string;
  itemName: string;
  group: string;
  unit: string;
  oldPrice: number;
  currentPrice: number;
  absoluteChangeReais: number;
  percentChange: number;
  monthlyImpactReais: number;
  thresholdUsed: number;
  isEstimatedConversion?: boolean;
}

export interface StructuredRecommendation {
  id: string;
  driverType: 'preco' | 'quantidade' | 'composicao' | 'equilibrio' | 'insuficiente';
  title: string;
  summary: string;
  effectDetail: string;
  itemName?: string;
  categoryName?: string;
  amountReais?: number;
  percentValue?: number;
  actionLabel?: string;
  targetTab?: string;
}

