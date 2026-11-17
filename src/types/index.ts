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

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  authProvider?: 'local' | 'google' | 'password' | 'email';
  emailVerified?: boolean;
  createdAt: string;
  lastLoginAt: string;
  profileId: string;
}

export interface AuthSession {
  user: UserAccount;
}

export type ProfileMode = 'pessoal' | 'negocio' | 'estudante';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export type SurplusFrequency =
  | 'quase_sempre'
  | 'as_vezes'
  | 'raramente'
  | 'nunca'
  | 'sem_renda_propria'
  | 'nao_sei';

export type IncomeRole = 'renda_familiar' | 'faturamento_negocio' | 'renda_estudantil';

export type IncomePredictability =
  | 'fixa'
  | 'variavel'
  | 'sazonal'
  | 'mista'
  | 'sem_renda_propria';

export interface DashboardPreferences {
  basketSetupChoice: 'demonstracao' | 'propria';
  compareIncomeVsInflation: boolean;
  trackMonthlyBudgetImpact: boolean;
  trackCostDrivers?: boolean;
}

export interface QuestionnaireItemEntry {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  currentPrice: number | null;
  oldPrice: number | null;
  supplierName?: string;
  isMajorDriver?: boolean;
  approximateSharePercent?: number | null;
}

export interface PessoalQuestionnaireAnswers {
  // Etapa 1 — Identificação do domicílio (P1-P4)
  membersCount: number;
  contributorsCount: number;
  dependentsCount: number;
  primaryIncomeComposition: string;
  // Etapa 2 — Renda familiar atual e histórica (P5-P9)
  currentMonthlyIncome: number | null;
  unknownCurrentIncome: boolean;
  incomeOneYearAgo: number | null;
  unknownIncomeOneYearAgo: boolean;
  incomePredictability: 'Fixa' | 'Variável' | 'Combinação fixa e variável';
  incomeTrend12M: 'Aumentou' | 'Diminuiu' | 'Permaneceu igual' | 'Não sei informar';
  incomeEarnersCount: number;
  // Etapa 3 — Sobra mensal e despesas (P10-P16)
  surplusFrequency: SurplusFrequency;
  reportedMonthlySurplus: number | null;
  shortfallBehavior: string;
  estimatedMonthlyExpenses: number | null;
  selectedExpenseCategories: string[];
  categoryEstimates: Record<string, number>;
  expenseStability: 'Estáveis' | 'Variam pouco' | 'Variam bastante' | 'Não sei informar';
  // Etapa 4 — Cesta de consumo familiar (P17-P22)
  selectedRegularProducts: string[];
  shoppingFrequency: 'Diariamente' | 'Semanalmente' | 'Quinzenalmente' | 'Mensalmente' | 'Sem frequência definida';
  itemEntries: QuestionnaireItemEntry[];
  knowsOldPrices: 'Sim' | 'Não' | 'Apenas alguns';
  majorBudgetDrivers: string[];
  // Etapa 5 — Configuração final (P23-P25)
  basketSetupChoice: 'demonstracao' | 'propria';
  compareIncomeVsInflation: boolean;
  trackMonthlyBudgetImpact: boolean;
}

export interface NegocioQuestionnaireAnswers {
  // Etapa 1 — Identificação do negócio (N1-N6)
  businessName: string;
  businessSegment: string;
  businessActivityDescription: string;
  businessSize: 'MEI' | 'Microempresa' | 'Empresa de Pequeno Porte' | 'Médio porte' | 'Não sei informar';
  workersCount: number;
  operatingTenure: 'Menos de 1 ano' | 'De 1 a 3 anos' | 'De 3 a 5 anos' | 'Mais de 5 anos';
  // Etapa 2 — Faturamento atual e histórico (N7-N11)
  currentMonthlyRevenue: number | null;
  unknownCurrentRevenue: boolean;
  revenueOneYearAgo: number | null;
  unknownRevenueOneYearAgo: boolean;
  revenuePattern: 'Fixo' | 'Variável' | 'Sazonal' | 'Combinação dessas opções';
  revenueTrend12M: 'Aumentou' | 'Diminuiu' | 'Permaneceu igual' | 'Grandes oscilações' | 'Não sei informar';
  primaryRevenueSource: 'Venda de produtos' | 'Prestação de serviços' | 'Produtos e serviços' | 'Outra';
  // Etapa 3 — Custos, despesas e sobra (N12-N21)
  estimatedMonthlyOperatingSpend: number | null;
  surplusFrequency: SurplusFrequency;
  reportedMonthlySurplus: number | null;
  shortfallReason: string;
  selectedCostCategories: string[];
  categoryEstimates: Record<string, number>;
  fixedCostCategories: string[];
  variableCostCategories: string[];
  operationalCostsIncreased12M: 'Sim' | 'Não' | 'Misto' | 'Não sei informar';
  operationalCostIncreaseAmount: string;
  // Etapa 4 — Produtos, insumos e fornecedores (N22-N28)
  itemEntries: QuestionnaireItemEntry[];
  knowsOldPrices: 'Sim' | 'Não' | 'Apenas alguns';
  buysFromSameSuppliers: 'Sim' | 'Não' | 'Depende do produto';
  wantsToRegisterSuppliers: boolean;
  suppliers: string[];
  purchaseFrequency: 'Diariamente' | 'Semanalmente' | 'Quinzenalmente' | 'Mensalmente' | 'Conforme a necessidade';
  // Etapa 5 — Configuração final (N29-N31)
  basketSetupChoice: 'demonstracao' | 'propria';
  compareCostsVsRevenue: boolean;
  trackCostDrivers: boolean;
}

export interface EstudanteQuestionnaireAnswers {
  // Etapa 1 — Identificação do estudante (E1-E4)
  educationLevel:
    | 'Ensino Fundamental'
    | 'Ensino Médio'
    | 'Ensino Técnico'
    | 'Ensino Superior'
    | 'Pós-graduação'
    | 'Outro';
  institutionType: 'Pública' | 'Particular' | 'Ambas' | 'Outra modalidade';
  studyPeriod: 'Matutino' | 'Vespertino' | 'Noturno' | 'Integral' | 'Flexível';
  livingSituation:
    | 'Com pais ou responsáveis'
    | 'Sozinho'
    | 'Com outros familiares'
    | 'República ou moradia estudantil'
    | 'Outra situação';
  // Etapa 2 — Renda atual e histórica (E5-E9)
  hasNoOwnIncome: boolean;
  currentMonthlyIncome: number | null;
  incomeSources: string[];
  incomeOneYearAgo: number | null;
  incomeOneYearAgoStatus: 'informado' | 'nao_sei' | 'nao_possuia_renda';
  incomePattern: 'Fixa' | 'Variável' | 'Combinação das duas' | 'Não possuo renda própria';
  incomeTrend12M:
    | 'Aumentou'
    | 'Diminuiu'
    | 'Permaneceu igual'
    | 'Comecei recentemente'
    | 'Não sei informar';
  // Etapa 3 — Gastos e sobra mensal (E10-E17)
  estimatedMonthlyExpenses: number | null;
  surplusFrequency: SurplusFrequency;
  reportedMonthlySurplus: number | null;
  selectedExpenseCategories: string[];
  categoryEstimates: Record<string, number>;
  directPaidCategories: string[];
  hasRecurringExpenses: boolean;
  expensesIncreased12M: 'Sim' | 'Não' | 'Misto' | 'Não sei informar';
  // Etapa 4 — Cesta de consumo estudantil (E18-E24)
  selectedConsumptionCategories: string[];
  itemEntries: QuestionnaireItemEntry[];
  knowsOldPrices: 'Sim' | 'Não' | 'Apenas alguns';
  majorBudgetDrivers: string[];
  purchaseFrequency: 'Diariamente' | 'Semanalmente' | 'Quinzenalmente' | 'Mensalmente' | 'Conforme a necessidade';
  // Etapa 5 — Configuração final (E25-E27)
  basketSetupChoice: 'demonstracao' | 'propria';
  compareIncomeVsInflation: boolean;
  trackMonthlyBudgetImpact: boolean;
}

export interface QuestionnaireDataPayload {
  mode: ProfileMode;
  version: string;
  completedAt?: string;
  updatedAt: string;
  currentStep?: number;
  pessoal?: PessoalQuestionnaireAnswers;
  negocio?: NegocioQuestionnaireAnswers;
  estudante?: EstudanteQuestionnaireAnswers;
}

export interface SurplusBreakdown {
  reportedMonthlySurplus: number | null;
  surplusFrequency: SurplusFrequency | null;
  estimatedMonthlySurplus: number | null;
  estimatedMonthlyExpenses: number | null;
  effectiveCalculatedBalance: number | null;
  hasNoOwnIncome?: boolean;
  isBusinessEstimateNotice?: boolean;
}

export interface ConsumptionGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  profileMode?: ProfileMode;
  nationalWeightIBGE?: number;
  isCustom?: boolean;
  active?: boolean;
}

export interface FamilyProfile {
  id: string;
  name: string;
  profileMode?: ProfileMode;
  onboardingStatus?: OnboardingStatus;
  onboardingStep?: number;
  onboardingCompletedAt?: string;
  questionnaireVersion?: string;
  priceAlertThresholdPercent?: number;
  membersCount: number;
  referenceRegion: string;
  currency: 'BRL' | string;
  hasNoOwnIncome?: boolean;
  reportedMonthlySurplus?: number | null;
  surplusFrequency?: SurplusFrequency;
  estimatedMonthlyExpenses?: number | null;
  suppliers?: string[];
  dashboardPreferences?: DashboardPreferences;
  questionnaireData?: QuestionnaireDataPayload;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BasketItem {
  id: string;
  profileId?: string;
  profileMode?: ProfileMode;
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
  supplierName?: string;
  paidDirectly?: boolean;
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
  supplierName?: string;
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
  profileMode?: ProfileMode;
  referenceDate: string;
  nominalIncome: number;
  source?: string;
  incomeRole?: IncomeRole;
  incomePredictability?: IncomePredictability;
  dataOrigin?: DataOrigin;
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
  surplusBreakdown?: SurplusBreakdown;
  estimatedMonthlyExpenses?: number | null;
  reportedMonthlySurplus?: number | null;
  surplusFrequency?: SurplusFrequency | null;
  hasNoOwnIncome?: boolean;
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

export interface ConsentCategories {
  essenciais: true;
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentPreferenceState {
  version: string;
  cmpVersion: string;
  anonymousConsentId: string;
  categories: ConsentCategories;
  decidedAt: string;
  source: 'banner' | 'modal' | 'privacy_page' | 'settings' | 'revocation';
}

export interface ConsentRecord {
  id: string;
  userId?: string;
  anonymousConsentId: string;
  essenciais: true;
  analytics: boolean;
  marketing: boolean;
  cmpVersion: string;
  policyVersion: string;
  source: 'banner' | 'modal' | 'privacy_page' | 'settings' | 'revocation';
  decidedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TermsAcceptanceRecord {
  id: string;
  userId?: string;
  termsVersion: string;
  policyVersion: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptanceMethod: 'email_register' | 'google_signin' | 'post_login_gate';
  acceptedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PrivacyRightType =
  | 'confirmacao_acesso'
  | 'correcao'
  | 'anonimizacao_eliminacao'
  | 'portabilidade'
  | 'revogacao_consentimento'
  | 'informacao_compartilhamento'
  | 'revisao_oposicao';

export type PrivacyRequestStatus =
  | 'registrada'
  | 'em_analise'
  | 'atendida'
  | 'cancelada';

export interface PrivacyRequestRecord {
  id: string;
  userId?: string;
  requestType: PrivacyRightType;
  status: PrivacyRequestStatus;
  details: string;
  resolutionNote?: string;
  requestedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPrivacyExportBundle {
  exportedAt: string;
  exportVersion: string;
  policyVersion: string;
  termsVersion: string;
  account: {
    userId: string;
    email: string;
    displayName: string;
    authProvider?: string;
    emailVerified?: boolean;
    defaultProfileId?: string;
    createdAt?: string;
    lastLoginAt?: string;
  };
  profiles: FamilyProfile[];
  consumptionGroups: ConsumptionGroup[];
  basketItems: BasketItem[];
  priceHistory: PriceRecord[];
  incomeHistory: IncomeRecord[];
  strategies: Array<SubstitutePlanA | EfficiencyPlanB | OpportunityPlanC | Record<string, unknown>>;
  monthlyClosures: MonthlyClosure[];
  consentRecords: ConsentRecord[];
  termsAcceptances: TermsAcceptanceRecord[];
  privacyRequests: PrivacyRequestRecord[];
}

