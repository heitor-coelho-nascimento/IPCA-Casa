import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEMO_BASKET_ITEMS,
  DEMO_MONTHLY_CLOSURES,
  DEMO_PLANS_B,
  DEMO_PROFILE_ID,
  StorageService,
} from '../src/services/storage';
import type { BasketItem, MonthlyClosure } from '../src/types';

describe('Auditoria de Dados Demonstrativos, Deduplicação e Fechamentos Mensais (StorageService)', () => {
  beforeEach(() => {
    StorageService.resetToDemoData();
  });

  it('Corrige economia mensal de água nos dados demonstrativos: (18 - 15) * 9,16 = R$ 27,48', () => {
    const waterPlan = DEMO_PLANS_B.find((p) => p.id === 'eff-02');
    expect(waterPlan).toBeDefined();
    expect(waterPlan!.currentConsumption).toBe(18);
    expect(waterPlan!.targetConsumption).toBe(15);
    expect(waterPlan!.tariffPerUnit).toBe(9.16);
    expect(waterPlan!.estimatedMonthlySavings).toBe(27.48);

    const energyPlan = DEMO_PLANS_B.find((p) => p.id === 'eff-01');
    expect(energyPlan!.estimatedMonthlySavings).toBeCloseTo(
      (energyPlan!.currentConsumption - energyPlan!.targetConsumption) * energyPlan!.tariffPerUnit,
      2
    );

    const fuelPlan = DEMO_PLANS_B.find((p) => p.id === 'eff-03');
    expect(fuelPlan!.estimatedMonthlySavings).toBeCloseTo(
      (fuelPlan!.currentConsumption - fuelPlan!.targetConsumption) * fuelPlan!.tariffPerUnit,
      2
    );
  });

  it('Rotula explicitamente todos os registros demonstrativos com dataOrigin = demonstrativo', () => {
    expect(DEMO_BASKET_ITEMS.length).toBeGreaterThan(0);
    expect(DEMO_BASKET_ITEMS.every((item) => item.dataOrigin === 'demonstrativo')).toBe(true);
    expect(DEMO_MONTHLY_CLOSURES.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_MONTHLY_CLOSURES.every((c) => c.dataOrigin === 'demonstrativo')).toBe(true);
  });

  it('Impede duplicação de registros ao importar itens repetidos no StorageService', () => {
    const sample: BasketItem = {
      id: 'imp-unique-1',
      profileId: 'prof-test-dedup',
      name: 'Farinha Especial',
      group: 'Alimentação e bebidas',
      classification: 'Essencial',
      monthlySpend: 250,
      oldPrice: 20,
      currentPrice: 25,
      oldPriceDate: '2026-01-01',
      currentPriceDate: '2026-10-01',
      unit: 'kg',
      active: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-10-01',
    };

    const first = StorageService.importItems([sample, { ...sample, id: 'imp-unique-2' }], 'prof-test-dedup');
    expect(first.importedCount).toBe(1);
    expect(first.skippedDuplicates).toBe(1);

    const second = StorageService.importItems([{ ...sample, id: 'imp-unique-3' }], 'prof-test-dedup');
    expect(second.importedCount).toBe(0);
    expect(second.skippedDuplicates).toBe(1);
  });

  it('Exige confirmação explícita ao sobrescrever Fechamento Mensal e permite exclusão segura', () => {
    const closure: MonthlyClosure = {
      id: 'cls_test_2026_11',
      profileId: 'prof-test-cls',
      monthKey: '2026-11',
      monthLabel: 'Nov/26',
      profileMode: 'pessoal',
      totalMonthlySpend: 3100,
      comparableBaseCost: 2900,
      ipcaCasaPercent: 6.9,
      ipcaOficialPercent: 4.3,
      spreadPP: 2.6,
      itemsCount: 10,
      eligibleItemsCount: 10,
      dataOrigin: 'usuario',
      closedAt: '2026-11-12',
    };

    const created = StorageService.saveMonthlyClosure(closure, false);
    expect(created.success).toBe(true);

    const blocked = StorageService.saveMonthlyClosure({ ...closure, totalMonthlySpend: 3250 }, false);
    expect(blocked.success).toBe(false);
    expect(blocked.requiresOverwriteConfirmation).toBe(true);

    const overwritten = StorageService.saveMonthlyClosure(
      { ...closure, totalMonthlySpend: 3250 },
      true
    );
    expect(overwritten.success).toBe(true);
    const stored = StorageService.getMonthlyClosures('prof-test-cls');
    expect(stored.length).toBe(1);
    expect(stored[0].totalMonthlySpend).toBe(3250);

    StorageService.deleteMonthlyClosure(stored[0].id);
    expect(StorageService.getMonthlyClosures('prof-test-cls').length).toBe(0);
    expect(StorageService.getMonthlyClosures(DEMO_PROFILE_ID).length).toBeGreaterThanOrEqual(2);
  });
});
