/**
 * IPCA-Casa: Tipos e Contratos do Sistema
 * Modelagem de dados para o Índice de Preços ao Consumidor Amplo Doméstico
 */

export type ItemClassification = 'Essencial' | 'Supérfluo' | 'Não classificado';

export type IBGEGroupName =
  | 'Alimentação e bebidas'
  | 'Habitação'
  | 'Transportes'
  | 'Saúde e cuidados pessoais'
  | 'Educação'
  | 'Despesas pessoais'
  | 'Comunicação'
  | 'Vestuário'
  | 'Artigos de residência'
  | (string & {});

export interface ConsumptionGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  nationalWeightIBGE?: number; // Peso médio na POF/IBGE para referência
  isCustom?: boolean;
  active?: boolean;
}

export interface PriceRecord {
  id: string;
  itemId: string;
  price: number;
  referenceDate: string; // YYYY-MM-DD
  unit?: string;
  source?: string; // ex: "Supermercado Habitual", "Nota Fiscal Paulista", "Boleto Enel"
  notes?: string;
  createdAt: string;
}

export type PriceHistory = PriceRecord;

export interface BasketItem {
  id: string;
  profileId: string;
  name: string;
  description?: string;
  group: string;
  classification: ItemClassification;
  monthlySpend: number; // Gasto mensal consolidado (R$)
  oldPrice: number; // Preço no início do período (R$)
  currentPrice: number; // Preço no final do período (R$)
  oldPriceDate: string;
  currentPriceDate: string;
  unit: string; // ex: "kg", "litro", "unidade", "kWh", "m³", "mensalidade"
  notes?: string;
  active: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalculatedItem extends BasketItem {
  weightPercent: number; // w_i (%) = (G_i / G_total) * 100
  priceChangePercent: number | null; // ΔP_i (%) = ((P_1 - P_0) / P_0) * 100 (null se não disponível)
  weightedContribution: number; // C_i (p.p.) = (w_i / 100) * ΔP_i
  impactLevel: 'Alívio' | 'Baixo' | 'Moderado' | 'Alto' | 'Crítico';
  isVillain: boolean; // Alto peso E alta variação
  isDataComplete: boolean;
  isPriceChangeAvailable: boolean;
}

export interface GroupContribution {
  group: string;
  totalSpend: number;
  weightPercent: number;
  weightedContribution: number; // soma dos C_i do grupo
  itemCount: number;
  color: string;
  icon: string;
}

export interface FamilyProfile {
  id: string;
  name: string;
  membersCount: number;
  referenceRegion: string; // ex: "São Paulo - SP", "Rio de Janeiro - RJ", "Brasil"
  currency: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeRecord {
  id: string;
  profileId: string;
  referenceDate: string;
  nominalIncome: number;
  source?: string;
  notes?: string;
  createdAt?: string;
}

export interface PurchasingPowerAnalysis {
  hasIncomeData: boolean;
  initialIncome: number | null;
  finalIncome: number | null;
  initialDate: string;
  finalDate: string;
  nominalIncomeGrowthPercent: number | null; // g (%)
  appliedInflationPercent: number; // π (%)
  inflationSource: 'IPCA-Casa' | 'IBGE';
  realPurchasingPowerChangePercent: number | null; // r (%)
  monthlyPurchasingDeficitOrGain: number | null; // em R$
  annualizedImpact: number | null; // em R$
  neededSalaryForBreakeven: number | null; // R$ para empate
  neededSalaryWithRealGain: (targetRealGainPercent: number) => number | null;
}

export interface SubstitutePlanA {
  id: string;
  profileId: string;
  originalItemId: string;
  originalItemName: string;
  originalPrice: number;
  substituteName: string;
  substitutePrice: number;
  monthlySavings: number;
  qualitativeTradeoff: string;
  applied: boolean;
  unit?: string;
  notes?: string;
}

export interface EfficiencyPlanB {
  id: string;
  profileId: string;
  resourceName: string;
  unit: string;
  tariffPerUnit: number;
  currentConsumption: number;
  targetConsumption: number;
  currentSpend: number;
  estimatedMonthlySavings: number;
  progressPercent: number;
  applied: boolean;
  notes?: string;
}

export interface OpportunityPlanC {
  id: string;
  profileId: string;
  monthlyInvestment: number;
  nominalAnnualRate: number; // ex: 10.5% (Selic/CDI)
  expectedAnnualInflation: number; // ex: 4.0%
  realAnnualYield: number; // rentabilidade real Fisher
  projection12Months: number;
  projection24Months: number;
  projection36Months: number;
  useLinkedSavings?: boolean;
  notes?: string;
  isSimulated?: boolean;
  updatedAt?: string;
}

export type TimeframeOption = '12M' | 'YTD' | '1M' | 'CUSTOM';

export interface EconomicCalculationSummary {
  totalMonthlySpend: number;
  totalItemsCount: number;
  eligibleItemsCount: number;
  ignoredItemsCount: number;
  essentialCount: number;
  superfluousCount: number;
  unclassifiedCount: number;
  ipcaCasa12M: number;
  ipcaIBGE12M: number;
  spreadPP: number; // IPCA-Casa - IPCA IBGE
  sumOfWeights: number;
  timeframeLabel: string;
  calculatedItems: CalculatedItem[];
  groupContributions: GroupContribution[];
  topIncreases: CalculatedItem[]; // Top maiores variações nominais
  topVillains: CalculatedItem[]; // Top maiores contribuições ponderadas em p.p.
  purchasingPower: PurchasingPowerAnalysis;
}

export interface IBGEHistoricalPoint {
  date: string; // YYYY-MM
  label: string; // "Mar/23", etc.
  monthlyRate: number; // variação percentual do mês
  accumulated12M: number; // acumulado 12 meses (%)
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: number;
}

// ==========================================
// AUTENTICAÇÃO E CONTA DE USUÁRIO
// ==========================================
export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  authProvider?: 'google' | 'password';
  emailVerified?: boolean;
  createdAt: string;
  lastLoginAt: string;
  profileId: string;
}

export interface AuthSession {
  user: UserAccount;
  token?: string;
}

// ==========================================
// DADOS DETALHADOS DO IBGE / SIDRA
// ==========================================
export interface IBGEGroupDetail {
  code: string;
  name: string;
  monthlyRate: number;
  accumulatedYearRate?: number;
  accumulated12MRate?: number;
  weightPercent?: number;
}

export interface IBGERegionalItem {
  id: string;
  name: string;
  state: string;
  monthlyRate: number;
  accumulated12MRate?: number;
}

// ==========================================
// IMPACTO DA INFLAÇÃO NO BOLSO
// ==========================================
export type PocketImpactPerspective = 'ipca-oficial' | 'ipca-casa' | 'variacao-cesta';

export interface PocketImpactMetrics {
  monthlySpendReference: number; // G
  inflationRatePercent: number; // π (%)
  estimatedMonthlyImpact: number; // G * (π / 100)
  estimatedAnnualImpact: number; // estimatedMonthlyImpact * 12 (sem dupla contagem)
  initialIncome: number; // R_inicial
  currentIncome: number; // R_atual
  neededIncomeForBreakeven: number; // R_inicial * (1 + π/100)
  realDifferenceReais: number; // R_atual - R_necessária
  nominalIncomeGrowthPercent: number;
  realPurchasingPowerPercent: number;
  hasLoss: boolean;
  perspective: PocketImpactPerspective;
  observedBasketDifferenceReais?: number;
}

