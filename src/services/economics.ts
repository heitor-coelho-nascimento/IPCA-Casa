/**
 * IPCA-Casa: Motor de Cálculos Econômicos e Financeiros
 * Funções puras, auditáveis e rigorosamente testadas.
 */

import {
  BasketItem,
  CalculatedItem,
  GroupContribution,
  PurchasingPowerAnalysis,
  EconomicCalculationSummary,
  TimeframeOption,
} from '../types';

/**
 * 6.1 Gasto Mensal Total
 * G_total = SUM(G_i)
 */
export function calculateTotalMonthlySpend(items: BasketItem[]): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((acc, item) => {
    if (!item.active || item.isArchived) return acc;
    const spend = Number(item.monthlySpend);
    return acc + (isNaN(spend) || spend < 0 ? 0 : spend);
  }, 0);
}

/**
 * 6.2 Peso Orçamentário de um Item
 * w_i = G_i / G_total (como fração 0..1)
 * w_i(%) = (G_i / G_total) * 100
 */
export function calculateItemWeight(itemSpend: number, totalSpend: number): number {
  if (totalSpend <= 0 || isNaN(totalSpend)) return 0;
  if (itemSpend < 0 || isNaN(itemSpend)) return 0;
  return (itemSpend / totalSpend) * 100;
}

/**
 * 6.3 Variação Nominal Individual de Preços
 * ΔP_i = ((P_1 - P_0) / P_0) * 100
 * Retorna null se P_0 <= 0 (preço antigo inválido ou zero)
 */
export function calculatePriceVariation(oldPrice: number | null | undefined, currentPrice: number | null | undefined): number | null {
  if (oldPrice === null || oldPrice === undefined || currentPrice === null || currentPrice === undefined) {
    return null;
  }
  const p0 = Number(oldPrice);
  const p1 = Number(currentPrice);
  if (isNaN(p0) || isNaN(p1) || p0 <= 0 || p1 < 0) {
    return null;
  }
  return ((p1 - p0) / p0) * 100;
}

/**
 * 6.4 Contribuição Ponderada de um Item
 * C_i = (w_i / 100) * ΔP_i  (expresso em pontos percentuais p.p.)
 */
export function calculateWeightedContribution(weightPercent: number, priceChangePercent: number | null): number {
  if (priceChangePercent === null || isNaN(priceChangePercent) || isNaN(weightPercent)) {
    return 0;
  }
  return (weightPercent / 100) * priceChangePercent;
}

/**
 * Determina o nível de impacto qualitativo de um item na inflação familiar
 */
export function determineImpactLevel(priceChangePercent: number | null, weightedContribution: number): CalculatedItem['impactLevel'] {
  if (priceChangePercent === null) {
    return 'Baixo';
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
  return 'Baixo';
}

/**
 * 6.5 Cálculo Consolidado do IPCA-Casa (Índice de Laspeyres Ponderado)
 * IPCA_Casa = SUM(C_i)
 */
export function calculateIpcaCasa(calculatedItems: CalculatedItem[]): number {
  if (!calculatedItems || calculatedItems.length === 0) return 0;
  return calculatedItems.reduce((acc, item) => {
    if (item.priceChangePercent === null) return acc;
    return acc + item.weightedContribution;
  }, 0);
}

/**
 * 6.6 Acumulação Geométrica de Taxas Mensais do IBGE
 * pi_acum = [ PRODUCT(1 + pi_t / 100) - 1 ] * 100
 */
export function calculateAccumulatedInflation(monthlyRates: number[]): number {
  if (!monthlyRates || monthlyRates.length === 0) return 0;
  const product = monthlyRates.reduce((acc, rate) => acc * (1 + rate / 100), 1);
  return (product - 1) * 100;
}

/**
 * 6.6 Diferença (Spread) em pontos percentuais
 * D = IPCA_Casa - IPCA_Oficial
 */
export function calculateSpreadPP(ipcaCasa: number, ipcaOfficial: number): number {
  return ipcaCasa - ipcaOfficial;
}

/**
 * 6.7 Variação Nominal da Renda
 * g = ((R_1 - R_0) / R_0) * 100
 */
export function calculateNominalIncomeGrowth(initialIncome: number | null | undefined, finalIncome: number | null | undefined): number | null {
  if (
    initialIncome === null ||
    initialIncome === undefined ||
    finalIncome === null ||
    finalIncome === undefined ||
    initialIncome <= 0 ||
    isNaN(initialIncome) ||
    isNaN(finalIncome) ||
    finalIncome < 0
  ) {
    return null;
  }
  return ((finalIncome - initialIncome) / initialIncome) * 100;
}

/**
 * 6.7 Variação Real do Poder de Compra
 * r = [ (1 + g/100) / (1 + pi/100) - 1 ] * 100
 */
export function calculateRealPurchasingPowerChange(
  nominalIncomeGrowthPercent: number | null,
  inflationPercent: number
): number | null {
  if (nominalIncomeGrowthPercent === null || isNaN(nominalIncomeGrowthPercent) || isNaN(inflationPercent)) {
    return null;
  }
  const denominator = 1 + inflationPercent / 100;
  if (denominator <= 0) {
    return null;
  }
  const numerator = 1 + nominalIncomeGrowthPercent / 100;
  return (numerator / denominator - 1) * 100;
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
  if (initialIncome === null || initialIncome === undefined || initialIncome <= 0 || isNaN(initialIncome)) {
    return null;
  }
  const inflationFactor = 1 + inflationPercent / 100;
  const realGainFactor = 1 + targetRealGainPercent / 100;
  return initialIncome * inflationFactor * realGainFactor;
}

/**
 * Plano B: Redução física do consumo
 * Reducao(%) = ((Q_0 - Q_1) / Q_0) * 100
 */
export function calculateConsumptionReduction(initialConsumption: number, targetConsumption: number): number | null {
  if (initialConsumption <= 0 || isNaN(initialConsumption) || targetConsumption < 0 || isNaN(targetConsumption)) {
    return null;
  }
  return ((initialConsumption - targetConsumption) / initialConsumption) * 100;
}

/**
 * Plano C: Rentabilidade Real Anual (Equação de Fisher)
 * r_real = [ (1 + i_nominal / 100) / (1 + pi_inflacao / 100) - 1 ] * 100
 */
export function calculateFisherRealYield(nominalAnnualRate: number, expectedInflation: number): number {
  const nominalFactor = 1 + nominalAnnualRate / 100;
  const inflationFactor = 1 + expectedInflation / 100;
  if (inflationFactor <= 0) return 0;
  return (nominalFactor / inflationFactor - 1) * 100;
}

/**
 * Plano C: Projeção de Acumulação com Aportes Mensais e Juros Compostos
 * Montante = P * [ ((1 + i_mensal)^n - 1) / i_mensal ]
 */
export function calculateCompoundAnnuity(monthlyDeposit: number, nominalAnnualRatePercent: number, months: number): number {
  if (monthlyDeposit <= 0 || months <= 0) return 0;
  if (nominalAnnualRatePercent <= 0) return monthlyDeposit * months;
  // Taxa mensal equivalente: (1 + i_ano)^(1/12) - 1
  const monthlyRate = Math.pow(1 + nominalAnnualRatePercent / 100, 1 / 12) - 1;
  return monthlyDeposit * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

/**
 * 6.8 Impacto Mensal Estimado no Bolso
 * Impacto = G * (pi / 100)
 */
export function calculateEstimatedMonthlyImpact(monthlySpend: number, inflationPercent: number): number {
  if (monthlySpend <= 0 || isNaN(monthlySpend) || isNaN(inflationPercent)) return 0;
  return monthlySpend * (inflationPercent / 100);
}

/**
 * 6.9 Impacto Anual Estimado no Bolso (12 meses sob a hipótese de manutenção do gasto mensal, sem dupla contagem)
 * Impacto_12M = Impacto_mensal * 12
 */
export function calculateEstimatedAnnualImpact(monthlySpend: number, inflationPercent: number): number {
  return calculateEstimatedMonthlyImpact(monthlySpend, inflationPercent) * 12;
}

/**
 * 6.10 Poder de Compra: Renda Necessária e Diferença Real em R$
 * R_necessaria = R_inicial * (1 + pi / 100)
 * Diferenca = R_atual - R_necessaria
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
  const neededIncome = initialIncome * (1 + inflationPercent / 100);
  const differenceReais = currentIncome - neededIncome;
  return {
    neededIncome,
    differenceReais,
    hasLoss: differenceReais < 0,
  };
}

/**
 * 6.11 Impacto Efetivamente Observado na Cesta
 * Calcula a diferença em R$ entre o custo da cesta com preços atuais vs preços antigos:
 * Diferenca = SUM( (P_1,i - P_0,i) * Q_i ) onde Q_i = G_i / P_1,i
 */
export function calculateObservedBasketDifference(items: BasketItem[]): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((acc, item) => {
    if (!item.active || item.isArchived) return acc;
    if (item.oldPrice > 0 && item.currentPrice > 0 && item.monthlySpend > 0) {
      const qty = item.monthlySpend / item.currentPrice;
      const priceDiff = item.currentPrice - item.oldPrice;
      return acc + priceDiff * qty;
    }
    return acc;
  }, 0);
}


/**
 * Motor Completo: Processa itens da cesta, calcula pesos, variações, contribuições
 * e gera o sumário executivo da inflação familiar sem supor dados ausentes.
 */
export function processBasketEconomics(
  items: BasketItem[],
  officialIBGE12M = 4.50,
  incomeInitial: number | null = null,
  incomeFinal: number | null = null,
  dateInitial = '2023-03-01',
  dateFinal = '2024-03-01',
  timeframe: TimeframeOption = '12M'
): EconomicCalculationSummary {
  const activeItems = items.filter((i) => i.active && !i.isArchived);
  const totalMonthlySpend = calculateTotalMonthlySpend(activeItems);

  // Calcula cada item individualmente respeitando a integridade dos dados
  const calculatedItems: CalculatedItem[] = activeItems.map((item) => {
    const weightPercent = calculateItemWeight(item.monthlySpend, totalMonthlySpend);
    const priceChangePercent = calculatePriceVariation(item.oldPrice, item.currentPrice);
    const isPriceChangeAvailable = priceChangePercent !== null;
    const isDataComplete =
      Boolean(item.name) &&
      Boolean(item.group) &&
      item.monthlySpend > 0 &&
      isPriceChangeAvailable;

    const weightedContribution = calculateWeightedContribution(weightPercent, priceChangePercent);
    const impactLevel = determineImpactLevel(priceChangePercent, weightedContribution);

    // Vilão do orçamento: alto peso (>= 4%) E variação positiva relevante (>= 7%) ou contribuição expressiva (>= 0.7 p.p.)
    const isVillain = isPriceChangeAvailable && ((weightPercent >= 4.0 && (priceChangePercent ?? 0) >= 7.0) || weightedContribution >= 0.7);

    return {
      ...item,
      weightPercent,
      priceChangePercent,
      weightedContribution,
      impactLevel,
      isVillain,
      isDataComplete,
      isPriceChangeAvailable,
    };
  });

  const eligibleItemsCount = calculatedItems.filter((i) => i.isPriceChangeAvailable).length;
  const ignoredItemsCount = calculatedItems.filter((i) => !i.isPriceChangeAvailable).length;

  const ipcaCasa12M = calculateIpcaCasa(calculatedItems);
  const spreadPP = calculateSpreadPP(ipcaCasa12M, officialIBGE12M);
  const sumOfWeights = calculatedItems.reduce((acc, item) => acc + item.weightPercent, 0);

  // Agrupamento por Grupo de Consumo (suporta categorias oficiais e personalizadas)
  const groupMap = new Map<string, { totalSpend: number; weightedContribution: number; itemCount: number }>();
  for (const item of calculatedItems) {
    const grp = item.group || 'Outros';
    const current = groupMap.get(grp) || { totalSpend: 0, weightedContribution: 0, itemCount: 0 };
    current.totalSpend += item.monthlySpend;
    current.weightedContribution += item.weightedContribution;
    current.itemCount += 1;
    groupMap.set(grp, current);
  }

  const groupColors: Record<string, { color: string; icon: string }> = {
    'Alimentação e bebidas': { color: '#000000', icon: 'restaurant' },
    'Habitação': { color: '#497cff', icon: 'home' },
    'Transportes': { color: '#006a61', icon: 'directions_car' },
    'Saúde e cuidados pessoais': { color: '#86f2e4', icon: 'health_and_safety' },
    'Educação': { color: '#bec6e0', icon: 'school' },
    'Despesas pessoais': { color: '#d3e4fe', icon: 'person' },
    'Comunicação': { color: '#7c839b', icon: 'wifi' },
    'Vestuário': { color: '#3f465c', icon: 'checkroom' },
    'Artigos de residência': { color: '#565e74', icon: 'chair' },
  };

  const groupContributions: GroupContribution[] = Array.from(groupMap.entries())
    .map(([group, data]) => ({
      group,
      totalSpend: data.totalSpend,
      weightPercent: totalMonthlySpend > 0 ? (data.totalSpend / totalMonthlySpend) * 100 : 0,
      weightedContribution: data.weightedContribution,
      itemCount: data.itemCount,
      color: groupColors[group]?.color || '#565e74',
      icon: groupColors[group]?.icon || 'category',
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  // Maiores Variações Nominais de Preço (apenas itens com variação calculável)
  const topIncreases = [...calculatedItems]
    .filter((i) => i.priceChangePercent !== null)
    .sort((a, b) => (b.priceChangePercent ?? 0) - (a.priceChangePercent ?? 0))
    .slice(0, 5);

  // Vilões Ponderados (Maiores contribuições em p.p.)
  const topVillains = [...calculatedItems]
    .filter((i) => i.priceChangePercent !== null)
    .sort((a, b) => b.weightedContribution - a.weightedContribution)
    .slice(0, 5);

  // Análise de Poder de Compra: Somente se renda for fornecida
  const hasIncomeData = incomeInitial !== null && incomeInitial > 0 && incomeFinal !== null && incomeFinal >= 0;
  const nominalIncomeGrowthPercent = hasIncomeData ? calculateNominalIncomeGrowth(incomeInitial, incomeFinal) : null;
  const realPurchasingPowerChangePercent = hasIncomeData ? calculateRealPurchasingPowerChange(nominalIncomeGrowthPercent, ipcaCasa12M) : null;
  const neededSalaryForBreakeven = hasIncomeData ? calculateNeededSalary(incomeInitial, ipcaCasa12M, 0) : null;
  const monthlyPurchasingDeficitOrGain = hasIncomeData && neededSalaryForBreakeven !== null && incomeFinal !== null ? incomeFinal - neededSalaryForBreakeven : null;
  const annualizedImpact = monthlyPurchasingDeficitOrGain !== null ? monthlyPurchasingDeficitOrGain * 12 : null;

  const purchasingPower: PurchasingPowerAnalysis = {
    hasIncomeData,
    initialIncome: incomeInitial,
    finalIncome: incomeFinal,
    initialDate: dateInitial,
    finalDate: dateFinal,
    nominalIncomeGrowthPercent,
    appliedInflationPercent: ipcaCasa12M,
    inflationSource: 'IPCA-Casa',
    realPurchasingPowerChangePercent,
    monthlyPurchasingDeficitOrGain,
    annualizedImpact,
    neededSalaryForBreakeven,
    neededSalaryWithRealGain: (target) => (hasIncomeData ? calculateNeededSalary(incomeInitial, ipcaCasa12M, target) : null),
  };

  const timeframeLabels: Record<TimeframeOption, string> = {
    '12M': 'Últimos 12 meses',
    'YTD': 'Ano corrente (YTD)',
    '1M': 'Último mês',
    'CUSTOM': 'Período personalizado',
  };

  return {
    totalMonthlySpend,
    totalItemsCount: calculatedItems.length,
    eligibleItemsCount,
    ignoredItemsCount,
    essentialCount: calculatedItems.filter((i) => i.classification === 'Essencial').length,
    superfluousCount: calculatedItems.filter((i) => i.classification === 'Supérfluo').length,
    unclassifiedCount: calculatedItems.filter((i) => i.classification === 'Não classificado').length,
    ipcaCasa12M,
    ipcaIBGE12M: officialIBGE12M,
    spreadPP,
    sumOfWeights,
    timeframeLabel: timeframeLabels[timeframe] || 'Últimos 12 meses',
    calculatedItems,
    groupContributions,
    topIncreases,
    topVillains,
    purchasingPower,
  };
}
