import { beforeEach, describe, expect, it } from 'vitest';
import {
  ESTUDANTE_CONSUMPTION_CATEGORIES,
  ESTUDANTE_EXPENSE_CATEGORIES,
  ESTUDANTE_INCOME_SOURCES,
  NEGOCIO_COST_CATEGORIES,
  NEGOCIO_SEGMENTS,
  PESSOAL_EXPENSE_CATEGORIES,
  PESSOAL_REGULAR_PRODUCTS,
  SURPLUS_FREQUENCY_LABELS,
  createDefaultEstudanteAnswers,
  createDefaultNegocioAnswers,
  createDefaultPessoalAnswers,
} from '../src/config/questionnaires';
import {
  buildPrefillBundleFromQuestionnaire,
  validateQuestionnaireStep,
} from '../src/services/questionnairePrefill';
import { processBasketEconomics } from '../src/services/economics';
import { StorageService, getDefaultGroupsForMode } from '../src/services/storage';
import { parseCsvForPreview } from '../src/utils/csvImport';
import { getProfileModeCopy, resolveProfileMode } from '../src/utils/profileMode';
import type { BasketItem, FamilyProfile, IncomeRecord, PriceRecord } from '../src/types';

function makeBaseProfile(id: string, mode: 'pessoal' | 'negocio' | 'estudante'): FamilyProfile {
  return {
    id,
    name: mode === 'negocio' ? 'Padaria Modelo' : mode === 'estudante' ? 'Perfil Estudante' : 'Casa Silva',
    membersCount: mode === 'pessoal' ? 3 : mode === 'negocio' ? 4 : 1,
    referenceRegion: 'Brasil',
    currency: 'BRL',
    profileMode: mode,
    isDemo: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('Modalidades Pessoal, Negócio e Estudante — Questionários, Pré-preenchimento e Motor Econômico', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('Inicializa estruturas padrão completas de Q1 Pessoal, Q2 Negócio e Q3 Estudante e catálogos de categorias', () => {
    const p = createDefaultPessoalAnswers(4);
    const n = createDefaultNegocioAnswers('Padaria do João');
    const e = createDefaultEstudanteAnswers();

    expect(p.membersCount).toBe(4);
    expect(PESSOAL_EXPENSE_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    expect(PESSOAL_REGULAR_PRODUCTS.length).toBeGreaterThanOrEqual(12);

    expect(n.businessName).toBe('Padaria do João');
    expect(NEGOCIO_SEGMENTS.length).toBeGreaterThanOrEqual(8);
    expect(NEGOCIO_COST_CATEGORIES.length).toBeGreaterThanOrEqual(12);

    expect(e.hasNoOwnIncome).toBe(false);
    expect(ESTUDANTE_INCOME_SOURCES).toContain('Não possuo renda própria');
    expect(ESTUDANTE_EXPENSE_CATEGORIES.length).toBeGreaterThanOrEqual(12);
    expect(ESTUDANTE_CONSUMPTION_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(SURPLUS_FREQUENCY_LABELS.sem_renda_propria).toBe('Não possuo renda própria');
  });

  it('Valida fluxos condicionais de "Não sei informar" e "Não possuo renda própria" por etapa', () => {
    const pAnswers = createDefaultPessoalAnswers(2);
    expect(validateQuestionnaireStep('pessoal', 2, pAnswers).valid).toBe(false);
    pAnswers.unknownCurrentIncome = true;
    expect(validateQuestionnaireStep('pessoal', 2, pAnswers).valid).toBe(true);

    const nAnswers = createDefaultNegocioAnswers('');
    expect(validateQuestionnaireStep('negocio', 1, nAnswers).valid).toBe(false);
    nAnswers.businessName = 'Padaria João';
    expect(validateQuestionnaireStep('negocio', 1, nAnswers).valid).toBe(true);
    expect(validateQuestionnaireStep('negocio', 2, nAnswers).valid).toBe(false);
    nAnswers.unknownCurrentRevenue = true;
    expect(validateQuestionnaireStep('negocio', 2, nAnswers).valid).toBe(true);

    const eAnswers = createDefaultEstudanteAnswers();
    expect(validateQuestionnaireStep('estudante', 2, eAnswers).valid).toBe(false);
    eAnswers.hasNoOwnIncome = true;
    expect(validateQuestionnaireStep('estudante', 2, eAnswers).valid).toBe(true);
  });

  it('Pré-preenche Pessoal sem inventar histórico de preços ausente e preserva lançamentos existentes ao atualizar via Configurações', () => {
    const baseProfile = makeBaseProfile('prof_pessoal_1', 'pessoal');
    const answers = {
      ...createDefaultPessoalAnswers(3),
      currentMonthlyIncome: 6500,
      incomeOneYearAgo: 6000,
      estimatedMonthlyExpenses: 4800,
      surplusFrequency: 'as_vezes' as const,
      reportedMonthlySurplus: 900,
      selectedExpenseCategories: ['Alimentação', 'Moradia e aluguel'],
      categoryEstimates: { 'Alimentação': 1500, 'Moradia e aluguel': 1900 },
      itemEntries: [
        {
          id: 'q1',
          name: 'Arroz',
          category: 'Alimentação',
          unit: 'pct 5kg',
          quantity: 2,
          currentPrice: 28,
          oldPrice: null, // Não informado -> não deve inventar histórico!
        },
      ],
    };

    const initialBundle = buildPrefillBundleFromQuestionnaire({
      mode: 'pessoal',
      baseProfile,
      answers,
      existingGroups: getDefaultGroupsForMode('pessoal'),
      defaultGroupsForMode: getDefaultGroupsForMode('pessoal'),
    });

    expect(initialBundle.profile.onboardingStatus).toBe('completed');
    expect(initialBundle.profile.reportedMonthlySurplus).toBe(900);
    expect(initialBundle.profile.estimatedMonthlyExpenses).toBe(4800);
    expect(initialBundle.incomeRecords.length).toBe(2);
    expect(initialBundle.incomeRecords.every((r) => r.dataOrigin === 'estimado')).toBe(true);

    const arrozItem = initialBundle.items.find((it) => it.name === 'Arroz');
    expect(arrozItem).toBeDefined();
    expect(arrozItem?.oldPrice).toBe(0);
    expect(arrozItem?.currentPrice).toBe(28);
    expect(initialBundle.priceRecords.filter((p) => p.itemId === arrozItem?.id)).toHaveLength(1);

    // Agora simula atualização via Configurações preservando um item manual do usuário e uma renda manual
    const userManualItem: BasketItem = {
      id: 'item_manual_cafe',
      profileId: 'prof_pessoal_1',
      profileMode: 'pessoal',
      name: 'Café Manual',
      group: 'Alimentação e bebidas',
      classification: 'Essencial',
      monthlySpend: 90,
      oldPrice: 20,
      currentPrice: 30,
      oldPriceDate: '2025-01-01',
      currentPriceDate: '2026-01-01',
      unit: 'kg',
      active: true,
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const userManualIncome: IncomeRecord = {
      id: 'inc_manual_real',
      profileId: 'prof_pessoal_1',
      profileMode: 'pessoal',
      referenceDate: '2026-02-01',
      nominalIncome: 7100,
      dataOrigin: 'usuario',
    };
    const userManualPrice: PriceRecord = {
      id: 'price_manual_1',
      profileId: 'prof_pessoal_1',
      itemId: 'item_manual_cafe',
      price: 30,
      referenceDate: '2026-02-01',
      dataOrigin: 'usuario',
    };

    const updatedBundle = buildPrefillBundleFromQuestionnaire({
      mode: 'pessoal',
      baseProfile: initialBundle.profile,
      answers: { ...answers, reportedMonthlySurplus: 1100 },
      existingGroups: initialBundle.consumptionGroups,
      existingItems: [...initialBundle.items, userManualItem],
      existingIncomeRecords: [...initialBundle.incomeRecords, userManualIncome],
      existingPriceRecords: [...initialBundle.priceRecords, userManualPrice],
      defaultGroupsForMode: getDefaultGroupsForMode('pessoal'),
      isUpdateFromSettings: true,
    });

    expect(updatedBundle.profile.reportedMonthlySurplus).toBe(1100);
    expect(updatedBundle.items.some((i) => i.id === 'item_manual_cafe')).toBe(true);
    expect(updatedBundle.incomeRecords.some((i) => i.id === 'inc_manual_real')).toBe(true);
    expect(updatedBundle.priceRecords.some((p) => p.id === 'price_manual_1')).toBe(true);
    // Sem duplicar item do questionário
    expect(updatedBundle.items.filter((i) => i.name === 'Arroz')).toHaveLength(1);
  });

  it('Configura Negócio com fornecedores, classificação fixa/variável e grupos operacionais sem alterar Pessoal', () => {
    const baseProfile = makeBaseProfile('prof_negocio_1', 'negocio');
    const answers = {
      ...createDefaultNegocioAnswers('Padaria Central'),
      currentMonthlyRevenue: 28000,
      revenueOneYearAgo: 25000,
      estimatedMonthlyOperatingSpend: 18500,
      suppliers: ['Moinho Paulista', 'EmbalaSul'],
      selectedCostCategories: ['Matéria-prima', 'Aluguel', 'Energia elétrica'],
      fixedCostCategories: ['Aluguel'],
      variableCostCategories: ['Matéria-prima', 'Energia elétrica'],
      itemEntries: [
        {
          id: 'qn1',
          name: 'Farinha de Trigo 50kg',
          category: 'Matéria-prima',
          unit: 'saco 50kg',
          quantity: 30,
          currentPrice: 175,
          oldPrice: 150,
          supplierName: 'Moinho Paulista',
        },
      ],
    };

    const bundle = buildPrefillBundleFromQuestionnaire({
      mode: 'negocio',
      baseProfile,
      answers,
      existingGroups: getDefaultGroupsForMode('negocio'),
      defaultGroupsForMode: getDefaultGroupsForMode('negocio'),
    });

    expect(bundle.profile.name).toBe('Padaria Central');
    expect(bundle.profile.suppliers).toEqual(['Moinho Paulista', 'EmbalaSul']);
    expect(bundle.incomeRecords[0].incomeRole).toBe('faturamento_negocio');
    const farinha = bundle.items.find((i) => i.name === 'Farinha de Trigo 50kg');
    expect(farinha?.supplierName).toBe('Moinho Paulista');
    expect(farinha?.expenseNature).toBe('Variável');
    expect(farinha?.monthlySpend).toBe(5250);
  });

  it('Protege Estudante sem renda própria contra divisão por zero e mantém paidDirectly nas despesas', () => {
    const baseProfile = makeBaseProfile('prof_est_1', 'estudante');
    const answers = {
      ...createDefaultEstudanteAnswers(),
      hasNoOwnIncome: true,
      currentMonthlyIncome: null,
      estimatedMonthlyExpenses: 1100,
      selectedExpenseCategories: ['Moradia estudantil', 'Alimentação'],
      directPaidCategories: ['Alimentação'],
      categoryEstimates: { 'Moradia estudantil': 700, 'Alimentação': 400 },
      itemEntries: [
        {
          id: 'qe1',
          name: 'Aluguel República',
          category: 'Moradia estudantil',
          unit: 'mês',
          quantity: 1,
          currentPrice: 700,
          oldPrice: 650,
        },
        {
          id: 'qe2',
          name: 'Restaurante Universitário',
          category: 'Alimentação',
          unit: 'refeição',
          quantity: 40,
          currentPrice: 6,
          oldPrice: 5,
        },
      ],
    };

    const bundle = buildPrefillBundleFromQuestionnaire({
      mode: 'estudante',
      baseProfile,
      answers,
      existingGroups: getDefaultGroupsForMode('estudante'),
      defaultGroupsForMode: getDefaultGroupsForMode('estudante'),
    });

    expect(bundle.profile.hasNoOwnIncome).toBe(true);
    expect(bundle.incomeRecords).toHaveLength(0);

    const aluguel = bundle.items.find((i) => i.name === 'Aluguel República');
    const bandeco = bundle.items.find((i) => i.name === 'Restaurante Universitário');
    expect(aluguel?.paidDirectly).toBe(false);
    expect(bandeco?.paidDirectly).toBe(true);

    const summary = processBasketEconomics(bundle.items, 4.5, null, null, '2025-11-01', '2026-11-01', '12M', {
      priceHistory: bundle.priceRecords,
      incomeRecords: bundle.incomeRecords,
      profile: bundle.profile,
      profileMode: 'estudante',
    });

    expect(summary.hasNoOwnIncome).toBe(true);
    expect(summary.purchasingPower.hasIncomeData).toBe(false);
    expect(summary.purchasingPower.realPurchasingPowerChangePercent).toBeNull();
    expect(summary.householdIndicators.monthlyBalance).toBeNull();
    expect(Number.isFinite(summary.ipcaCasa12M)).toBe(true);
    expect(summary.surplusBreakdown?.hasNoOwnIncome).toBe(true);
    expect(summary.surplusBreakdown?.effectiveCalculatedBalance).toBeNull();
  });

  it('Distingue corretamente sobra informada, sobra estimada e saldo efetivo calculado no surplusBreakdown', () => {
    const profile: FamilyProfile = {
      ...makeBaseProfile('prof_surplus', 'pessoal'),
      reportedMonthlySurplus: 1200,
      surplusFrequency: 'as_vezes',
      estimatedMonthlyExpenses: 4000,
    };
    const items: BasketItem[] = [
      {
        id: 'i1',
        profileId: 'prof_surplus',
        profileMode: 'pessoal',
        name: 'Mercado',
        group: 'Alimentação e bebidas',
        classification: 'Essencial',
        monthlySpend: 2500,
        oldPrice: 2300,
        currentPrice: 2500,
        oldPriceDate: '2025-11-01',
        currentPriceDate: '2026-11-01',
        unit: 'mês',
        active: true,
        isArchived: false,
        createdAt: '2025-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    ];

    const summary = processBasketEconomics(items, 4.5, 5500, 6000, '2025-11-01', '2026-11-01', '12M', {
      profile,
      profileMode: 'pessoal',
    });

    expect(summary.surplusBreakdown?.reportedMonthlySurplus).toBe(1200);
    expect(summary.surplusBreakdown?.surplusFrequency).toBe('as_vezes');
    expect(summary.surplusBreakdown?.estimatedMonthlySurplus).toBe(2000); // 6000 - 4000
    expect(summary.surplusBreakdown?.effectiveCalculatedBalance).toBe(3500); // 6000 - 2500
  });

  it('Isola cenários demonstrativos, rascunhos locais e categorias padrão por modalidade', () => {
    StorageService.loadDemoBasket('pessoal');
    StorageService.loadDemoBasket('negocio');
    StorageService.loadDemoBasket('estudante');

    const profiles = StorageService.getProfiles();
    expect(profiles.some((p) => p.id === 'profile-demo')).toBe(true);
    expect(profiles.some((p) => p.id === 'profile-demo-negocio')).toBe(true);
    expect(profiles.some((p) => p.id === 'profile-demo-estudante')).toBe(true);

    expect(StorageService.getItems('profile-demo').length).toBeGreaterThan(0);
    expect(StorageService.getItems('profile-demo-negocio').length).toBeGreaterThan(0);
    expect(StorageService.getItems('profile-demo-estudante').length).toBeGreaterThan(0);

    // Rascunho local isolado por (userId, profileId)
    StorageService.saveQuestionnaireDraftLocal('u1', 'p_est', {
      mode: 'estudante',
      version: '2.0.0',
      updatedAt: '2026-11-16T00:00:00.000Z',
      currentStep: 3,
      estudante: createDefaultEstudanteAnswers(),
    });
    const loadedDraft = StorageService.loadQuestionnaireDraftLocal('u1', 'p_est');
    expect(loadedDraft?.mode).toBe('estudante');
    expect(loadedDraft?.currentStep).toBe(3);

    // Restaurar categorias padrão mantendo customizadas
    StorageService.saveGroup({
      id: 'grp_custom_biz',
      name: 'Manutenção de Fornos',
      description: 'Customizada',
      color: '#000000',
      icon: 'Wrench',
      profileMode: 'negocio',
      isCustom: true,
      active: true,
    });
    const restoredBiz = StorageService.restoreDefaultGroupsForMode('negocio');
    expect(restoredBiz.some((g) => g.name === 'Manutenção de Fornos')).toBe(true);
    expect(restoredBiz.some((g) => g.name === 'Matéria-prima e Insumos')).toBe(true);

    // Copy amigável por modalidade
    expect(resolveProfileMode('estudante')).toBe('estudante');
    expect(getProfileModeCopy('negocio').surplusNotice).toContain('não é lucro contábil');
    expect(getProfileModeCopy('estudante').incomeTermSingular).toContain('Renda / Auxílio');
  });

  it('Importa CSV preservando supplierName e validando profileMode por modalidade', () => {
    const csv = [
      'id;produto;grupo;classificacao;gasto_mensal;preco_antigo;data_antiga;preco_atual;data_atual;unidade;observacoes;fornecedor;modalidade',
      ';Farinha Especial;Matéria-prima;Essencial;1800,00;150,00;2025-11-01;180,00;2026-11-01;saco 50kg;Compra mensal;Moinho Paulista;negocio',
      ';Item Errado;Alimentação;Essencial;200,00;10,00;2025-11-01;12,00;2026-11-01;kg;Outra modalidade;;pessoal',
    ].join('\n');

    const preview = parseCsvForPreview({
      text: csv,
      existingItems: [],
      targetProfileId: 'prof_negocio',
      profileMode: 'negocio',
    });

    expect(preview.summary.validCount).toBe(1);
    expect(preview.summary.invalidCount).toBe(1);
    expect(preview.rows[0].itemPayload?.supplierName).toBe('Moinho Paulista');
    expect(preview.rows[0].itemPayload?.profileMode).toBe('negocio');
  });
});
