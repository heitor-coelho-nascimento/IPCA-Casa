import { describe, it, expect } from 'vitest';
import {
  calculatePriceVariation,
  calculateItemWeight,
  calculateWeightedContribution,
  calculateIpcaCasa,
  calculateNominalIncomeGrowth,
  calculateRealPurchasingPowerChange,
  calculateTotalMonthlySpend,
  calculateAccumulatedInflation,
  calculateNeededSalary,
  calculateEstimatedMonthlyImpact,
  calculateEstimatedAnnualImpact,
  calculateRealIncomeDifference,
  processBasketEconomics,
  calculateFisherRealYield,
  calculateFutureProjection,
  resolveEffectiveMonthlySpend,
  simulatePlanA,
  simulatePlanB,
  simulatePlanC,
  calculateWorkingDaysEquivalence,
} from '../src/services/economics';
import { compareNormalizedUnitPrices, areUnitsCompatible, frequencyToMonthlyMultiplier } from '../src/services/units';
import { CalculatedItem, BasketItem } from '../src/types';

describe('Testes Obrigatórios de Regras Econômicas (IPCA-Casa)', () => {
  // Teste A — Preço estável
  it('Teste A — Preço estável: Preço antigo: R$ 100,00; Preço atual: R$ 100,00; Variação esperada: 0%', () => {
    const variation = calculatePriceVariation(100.0, 100.0);
    expect(variation).toBe(0);
  });

  // Teste B — Aumento de preço
  it('Teste B — Aumento de preço: Preço antigo: R$ 100,00; Preço atual: R$ 110,00; Variação esperada: 10%', () => {
    const variation = calculatePriceVariation(100.0, 110.0);
    expect(variation).toBe(10);
  });

  // Teste C — Redução de preço
  it('Teste C — Redução de preço: Preço antigo: R$ 100,00; Preço atual: R$ 90,00; Variação esperada: -10%', () => {
    const variation = calculatePriceVariation(100.0, 90.0);
    expect(variation).toBe(-10);
  });

  // Teste D — Peso orçamentário
  it('Teste D — Peso orçamentário: Gasto mensal total: R$ 1.000,00; Gasto com um item: R$ 200,00; Peso esperado: 20%', () => {
    const weight = calculateItemWeight(200.0, 1000.0);
    expect(weight).toBe(20);
  });

  // Teste E — Inflação ponderada
  it('Teste E — Inflação ponderada: Item A (peso 60%, variação 10%), Item B (peso 40%, variação 0%); Inflação esperada: 6%', () => {
    const itemA: Partial<CalculatedItem> = {
      priceChangePercent: 10,
      weightedContribution: calculateWeightedContribution(60, 10), // 60/100 * 10 = 6.0
    };
    const itemB: Partial<CalculatedItem> = {
      priceChangePercent: 0,
      weightedContribution: calculateWeightedContribution(40, 0), // 40/100 * 0 = 0.0
    };

    const totalInflation = calculateIpcaCasa([itemA as CalculatedItem, itemB as CalculatedItem]);
    expect(totalInflation).toBe(6.0);
  });

  // Teste F — Poder de compra
  it('Teste F — Poder de compra: Renda inicial R$ 2.000, Renda final R$ 2.100, Inflação 10%; Variação nominal 5%; Variação real aprox. -4,55%', () => {
    const nominalGrowth = calculateNominalIncomeGrowth(2000.0, 2100.0);
    expect(nominalGrowth).toBe(5.0);

    const realGrowth = calculateRealPurchasingPowerChange(nominalGrowth, 10.0);
    expect(realGrowth).not.toBeNull();
    // Formula: ((1 + 0.05) / (1 + 0.10) - 1) * 100 = (1.05 / 1.10 - 1) * 100 = -4.545454...%
    expect(realGrowth!).toBeCloseTo(-4.54545, 3);
  });

  // Teste G — Entradas inválidas
  it('Teste G — Entradas inválidas: Preço inicial zero ou negativo, gasto total zero, divisões por zero tratadas', () => {
    // Preço inicial igual a zero
    const zeroOldPrice = calculatePriceVariation(0, 100);
    expect(zeroOldPrice).toBeNull();

    // Preço inicial negativo
    const negativeOldPrice = calculatePriceVariation(-50, 100);
    expect(negativeOldPrice).toBeNull();

    // Gasto total igual a zero
    const weightWithZeroTotal = calculateItemWeight(150, 0);
    expect(weightWithZeroTotal).toBe(0);

    // Gasto do item negativo
    const weightWithNegativeSpend = calculateItemWeight(-50, 1000);
    expect(weightWithNegativeSpend).toBe(0);

    // Inflação de 100% deflacionária severa (-100% ou mais que tornaria denominador <= 0)
    const impossibleInflation = calculateRealPurchasingPowerChange(10, -100);
    expect(impossibleInflation).toBeNull();

    // Gasto total com lista vazia ou valores inválidos
    expect(calculateTotalMonthlySpend([])).toBe(0);
    const mockInvalidItems = [
      { monthlySpend: 500, active: true },
      { monthlySpend: -200, active: true },
      { monthlySpend: NaN, active: true },
    ] as BasketItem[];
    expect(calculateTotalMonthlySpend(mockInvalidItems)).toBe(500);
  });

  // Teste H — Acumulação Geométrica IBGE
  it('Teste H — Acumulação oficial não é soma aritmética, mas sim produtório composto', () => {
    // 2 meses com 1% cada: (1.01 * 1.01 - 1) * 100 = 2.01%, e não 2.00%
    const accumulated = calculateAccumulatedInflation([1.0, 1.0]);
    expect(accumulated).toBeCloseTo(2.01, 2);
  });

  // Teste I — Salário necessário para recomposição
  it('Teste I — Salário necessário para recomposição de poder de compra', () => {
    // Salário base 10.000, inflação 6.85% -> 10.685,00
    const needed = calculateNeededSalary(10000, 6.85, 0);
    expect(needed).toBe(10685);
  });

  // Teste J — Tratamento de Dados Ausentes
  it('Teste J — Dados ausentes não são convertidos em 0% de variação e são contabilizados como ignorados', () => {
    const items: BasketItem[] = [
      {
        id: '1',
        profileId: 'p1',
        name: 'Arroz',
        group: 'Alimentação e bebidas',
        classification: 'Essencial',
        monthlySpend: 200,
        oldPrice: 20,
        currentPrice: 25,
        oldPriceDate: '2023-03-01',
        currentPriceDate: '2024-03-01',
        unit: 'kg',
        active: true,
        createdAt: '2023-03-01',
        updatedAt: '2024-03-01',
      },
      {
        id: '2',
        profileId: 'p1',
        name: 'Produto sem preço antigo',
        group: 'Alimentação e bebidas',
        classification: 'Essencial',
        monthlySpend: 100,
        oldPrice: 0, // dado ausente/não informado
        currentPrice: 50,
        oldPriceDate: '',
        currentPriceDate: '2024-03-01',
        unit: 'un',
        active: true,
        createdAt: '2023-03-01',
        updatedAt: '2024-03-01',
      },
    ];

    const result = processBasketEconomics(items, 4.5, null, null);
    expect(result.totalMonthlySpend).toBe(300);
    expect(result.eligibleItemsCount).toBe(1);
    expect(result.ignoredItemsCount).toBe(1);
    expect(result.calculatedItems[1].priceChangePercent).toBeNull();
    expect(result.calculatedItems[1].isPriceChangeAvailable).toBe(false);

    // Renda não informada deve ter hasIncomeData = false
    expect(result.purchasingPower.hasIncomeData).toBe(false);
    expect(result.purchasingPower.nominalIncomeGrowthPercent).toBeNull();
    expect(result.purchasingPower.realPurchasingPowerChangePercent).toBeNull();
  });

  // Teste K — Impacto no Bolso em Reais (Exemplo do Usuário)
  it('Teste K — Impacto Financeiro no Bolso em Reais: Gasto R$ 3.000, Inflação 5% -> Impacto R$ 150/mês e R$ 1.800/ano', () => {
    const monthlyImpact = calculateEstimatedMonthlyImpact(3000, 5);
    expect(monthlyImpact).toBe(150.0);

    const annualImpact = calculateEstimatedAnnualImpact(3000, 5);
    expect(annualImpact).toBe(1800.0);
  });

  // Teste L — Renda Necessária e Diferença Real em Reais (Exemplo do Usuário)
  it('Teste L — Poder de Compra em Reais: Renda inicial R$ 2.000, Inflação 5%, Renda atual R$ 2.050 -> Diferença -R$ 50,00', () => {
    const result = calculateRealIncomeDifference(2000, 2050, 5);
    expect(result.neededIncome).toBe(2100);
    expect(result.differenceReais).toBe(-50);
    expect(result.hasLoss).toBe(true);
  });

  // Teste M — Deflação (Variação negativa)
  it('Teste M — Deflação tratada corretamente no acumulado e poder de compra', () => {
    const deflatedPrice = calculatePriceVariation(100, 95);
    expect(deflatedPrice).toBe(-5);

    // Produto composto com deflação: (1 - 0.02) * (1 - 0.03) - 1 = 0.98 * 0.97 - 1 = -0.0494 (-4.94%)
    const accDeflation = calculateAccumulatedInflation([-2.0, -3.0]);
    expect(accDeflation).toBeCloseTo(-4.94, 2);

    // Poder de compra com deflação: renda constante (0%) e deflação (-5%) resulta em ganho real
    const realGain = calculateRealPurchasingPowerChange(0, -5);
    expect(realGain).not.toBeNull();
    expect(realGain!).toBeGreaterThan(0);
    expect(realGain!).toBeCloseTo(5.263, 3);
  });

  // Teste N — Cesta Vazia
  it('Teste N — Cesta vazia tratada com segurança retornando totais zerados e status adequado', () => {
    const emptyResult = processBasketEconomics([], 4.5, null, null);
    expect(emptyResult.totalMonthlySpend).toBe(0);
    expect(emptyResult.eligibleItemsCount).toBe(0);
    expect(emptyResult.ipcaCasa12M).toBe(0);
    expect(emptyResult.methodology.methodology).toBe('insuficiente');
    expect(emptyResult.methodology.comparableCoveragePercent).toBe(0);
  });

  // Teste O — Equação de Fisher e Projeção Futura
  it('Teste O — Equação de Fisher (Rentabilidade Real) e Projeção Futura com juros compostos', () => {
    // CDI nominal 12% a.a., Inflação 5% a.a. -> r_real = (1.12 / 1.05 - 1) * 100 = 6.6667%
    const realYield = calculateFisherRealYield(12.0, 5.0);
    expect(realYield).toBeCloseTo(6.667, 3);

    // Despesa de R$ 1.000 sob inflação de 6% a.a. após 12 meses
    const futureExpense = calculateFutureProjection(1000, 6.0, 12);
    expect(futureExpense).toBeCloseTo(1060, 1);
  });

  // Teste P — Frequências de consumo e equivalência mensal
  it('Teste P — Frequências de consumo e conversão para equivalência mensal', () => {
    // Semanal: convenção explícita de 30 dias -> 30 / 7
    const weeklyFreq = frequencyToMonthlyMultiplier('semanal');
    expect(weeklyFreq.multiplierToMonthly).toBeCloseTo(30 / 7, 3);

    // Quinzenal: 30 / 15 = 2x ao mês
    const biweeklyFreq = frequencyToMonthlyMultiplier('quinzenal');
    expect(biweeklyFreq.multiplierToMonthly).toBe(2);

    // Anual: 1 / 12 ao mês
    const annualFreq = frequencyToMonthlyMultiplier('anual');
    expect(annualFreq.multiplierToMonthly).toBeCloseTo(1 / 12, 3);

    // Mensal: 1x ao mês
    const monthlyFreq = frequencyToMonthlyMultiplier('mensal');
    expect(monthlyFreq.multiplierToMonthly).toBe(1);

    // Teste com BasketItem: item quinzenal sem monthlySpend armazenado, mas com quantity 2 a R$ 50 cada
    // Equivalência mensal = 2 un * R$ 50 * 2 = R$ 200/mês
    const biweeklyItem = {
      quantity: 2,
      currentPrice: 50,
      monthlySpend: 0,
      consumptionFrequency: 'quinzenal',
    } as BasketItem;
    const effSpend = resolveEffectiveMonthlySpend(biweeklyItem);
    expect(effSpend.monthlySpend).toBe(200);
    expect(effSpend.isMonthlyEquivalence).toBe(true);
  });

  // Teste Q — Normalização e comparabilidade de unidades
  it('Teste Q — Normalização de unidades compatíveis e rejeição de incompatíveis', () => {
    // 500g a R$ 10,00 vs 1kg a R$ 18,00 -> Ambos na unidade canônica kg: R$ 20/kg vs R$ 18/kg
    expect(areUnitsCompatible('g', 'kg')).toBe(true);
    expect(areUnitsCompatible('kg', 'l')).toBe(false);

    const comparison = compareNormalizedUnitPrices(
      { price: 10, packageSize: 500, packageUnit: 'g' },
      { price: 18, packageSize: 1, packageUnit: 'kg' }
    );
    expect(comparison.comparable).toBe(true);
    expect(comparison.canonicalUnit).toBe('kg');
    expect(comparison.pricePerCanonicalA).toBe(20);
    expect(comparison.pricePerCanonicalB).toBe(18);
    expect(comparison.unitSavingsAbsolute).toBe(2); // economia de R$ 2,00 por kg

    // Incompatíveis (kg vs litros) não devem ser comparados
    const incompatible = compareNormalizedUnitPrices(
      { price: 10, packageSize: 1, packageUnit: 'kg' },
      { price: 10, packageSize: 1, packageUnit: 'l' }
    );
    expect(incompatible.comparable).toBe(false);
  });

  // Teste R — Simulações financeiras (Planos A, B e C)
  it('Teste R — Simulações de substituição (Plano A), eficiência (Plano B) e investimento (Plano C)', () => {
    // Plano A: 500g a R$ 10 substituído por 1kg a R$ 18, consumo mensal 4kg
    const planA = simulatePlanA({
      originalPrice: 10,
      originalPackageSize: 500,
      originalPackageUnit: 'g',
      substitutePrice: 18,
      substitutePackageSize: 1,
      substitutePackageUnit: 'kg',
      monthlyQuantity: 4,
    });
    expect(planA.comparable).toBe(true);
    expect(planA.monthlySavings).toBe(8); // R$ 2/kg * 4kg = R$ 8/mês
    expect(planA.annualEstimatedSavings).toBe(96);

    // Plano B: consumo de energia de 300 kWh para 250 kWh a R$ 0,90/kWh
    const planB = simulatePlanB({
      currentConsumption: 300,
      targetConsumption: 250,
      tariffPerUnit: 0.9,
    });
    expect(planB.valid).toBe(true);
    expect(planB.estimatedMonthlySavings).toBe(45); // (300 - 250) * 0.90 = R$ 45
    expect(planB.reductionPercent).toBeCloseTo(16.67, 1);

    // Plano C: Aporte mensal de R$ 500 a 12% a.a. por 12 meses
    const planC = simulatePlanC({
      monthlyDeposit: 500,
      termMonths: 12,
      nominalAnnualRatePercent: 12,
      expectedAnnualInflationPercent: 4.5,
      productType: 'cdb',
    });
    expect(planC.valid).toBe(true);
    expect(planC.totalContributed).toBe(6000);
    expect(planC.grossFutureValue).toBeGreaterThan(6000);
    expect(planC.realReturnPercent).toBeGreaterThan(0);
  });

  // Teste S — Equivalência de despesas em dias de trabalho
  it('Teste S — Equivalência de despesa em dias úteis com base na renda líquida', () => {
    // Renda R$ 4.400 / 22 dias úteis = R$ 200/dia. Despesa R$ 600 -> 3 dias de trabalho
    const workDays = calculateWorkingDaysEquivalence({
      monthlyIncome: 4400,
      expenseAmount: 600,
      workingDaysPerMonth: 22,
    });
    expect(workDays.valid).toBe(true);
    expect(workDays.dailyRate).toBe(200);
    expect(workDays.workingDaysNeeded).toBe(3);

    // Renda zero ou negativa deve retornar valid = false
    const invalidWorkDays = calculateWorkingDaysEquivalence({
      monthlyIncome: 0,
      expenseAmount: 600,
    });
    expect(invalidWorkDays.valid).toBe(false);
  });
});


