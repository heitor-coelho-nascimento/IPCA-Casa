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
} from '../src/services/economics';
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
});

