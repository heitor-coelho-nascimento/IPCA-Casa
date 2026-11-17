import {
  BasketItem,
  ConsumptionFrequency,
  ConsumptionGroup,
  DashboardPreferences,
  EstudanteQuestionnaireAnswers,
  FamilyProfile,
  IncomePredictability,
  IncomeRecord,
  IncomeRole,
  NegocioQuestionnaireAnswers,
  PessoalQuestionnaireAnswers,
  PriceRecord,
  ProfileMode,
  QuestionnaireDataPayload,
  QuestionnaireItemEntry,
  SurplusFrequency,
} from '../types';
import {
  QUESTIONNAIRE_VERSION,
  isEssentialCategoryForMode,
  mapQuestionnaireCategoryToGroup,
} from '../config/questionnaires';

export interface QuestionnaireValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PrefillBundleResult {
  profile: FamilyProfile;
  incomeRecords: IncomeRecord[];
  consumptionGroups: ConsumptionGroup[];
  items: BasketItem[];
  priceRecords: PriceRecord[];
  useDemoBasket: boolean;
  demoSegment?: string;
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function oneYearAgoIso(baseDate: Date): string {
  const d = new Date(baseDate);
  d.setFullYear(d.getFullYear() - 1);
  return toIsoDate(d);
}

function sanitizeSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function mapFrequencyToConsumption(raw?: string): ConsumptionFrequency {
  switch (raw) {
    case 'Diariamente':
      return 'diaria';
    case 'Semanalmente':
      return 'semanal';
    case 'Quinzenalmente':
      return 'quinzenal';
    case 'Mensalmente':
    default:
      return 'mensal';
  }
}

function mapPredictability(
  mode: ProfileMode,
  raw: string,
  hasNoOwnIncome?: boolean
): IncomePredictability {
  if (hasNoOwnIncome || raw === 'Não possuo renda própria') return 'sem_renda_propria';
  if (raw === 'Fixa' || raw === 'Fixo') return 'fixa';
  if (raw === 'Variável') return 'variavel';
  if (raw === 'Sazonal') return 'sazonal';
  return 'mista';
}

function getIncomeRoleForMode(mode: ProfileMode): IncomeRole {
  if (mode === 'negocio') return 'faturamento_negocio';
  if (mode === 'estudante') return 'renda_estudantil';
  return 'renda_familiar';
}

export function validateQuestionnaireStep(
  mode: ProfileMode,
  step: number,
  answers:
    | PessoalQuestionnaireAnswers
    | NegocioQuestionnaireAnswers
    | EstudanteQuestionnaireAnswers
): QuestionnaireValidationResult {
  const errors: string[] = [];

  if (mode === 'pessoal') {
    const a = answers as PessoalQuestionnaireAnswers;
    if (step === 1) {
      if (!Number.isFinite(a.membersCount) || a.membersCount < 1) {
        errors.push('Informe quantas pessoas moram na casa (mínimo 1).');
      }
      if (!Number.isFinite(a.contributorsCount) || a.contributorsCount < 0) {
        errors.push('Informe um número válido de contribuintes financeiros.');
      }
      if (!Number.isFinite(a.dependentsCount) || a.dependentsCount < 0) {
        errors.push('Informe um número válido de dependentes financeiros.');
      }
      if (!a.primaryIncomeComposition) {
        errors.push('Selecione como a renda da casa é composta principalmente.');
      }
    } else if (step === 2) {
      if (!a.unknownCurrentIncome && (a.currentMonthlyIncome === null || a.currentMonthlyIncome <= 0)) {
        errors.push('Informe a renda mensal atual da casa ou marque "Não sei informar".');
      }
      if (a.incomeEarnersCount < 0 || !Number.isFinite(a.incomeEarnersCount)) {
        errors.push('Informe quantas pessoas possuem alguma fonte de renda.');
      }
    } else if (step === 3) {
      if (
        a.surplusFrequency !== 'nunca' &&
        a.surplusFrequency !== 'nao_sei' &&
        a.surplusFrequency !== 'sem_renda_propria' &&
        a.reportedMonthlySurplus !== null &&
        a.reportedMonthlySurplus < 0
      ) {
        errors.push('O valor aproximado que sobra por mês não pode ser negativo.');
      }
      if (a.estimatedMonthlyExpenses !== null && a.estimatedMonthlyExpenses < 0) {
        errors.push('O gasto mensal aproximado não pode ser negativo.');
      }
      if (a.selectedExpenseCategories.length === 0) {
        errors.push('Selecione ao menos uma categoria principal de despesa da casa.');
      }
    } else if (step === 4) {
      if (a.selectedRegularProducts.length === 0 && a.itemEntries.length === 0) {
        errors.push('Selecione ou adicione ao menos um item regular para acompanhar na cesta.');
      }
    }
  } else if (mode === 'negocio') {
    const a = answers as NegocioQuestionnaireAnswers;
    if (step === 1) {
      if (!a.businessName.trim()) {
        errors.push('Informe o nome do seu negócio.');
      }
      if (!a.businessSegment) {
        errors.push('Selecione o segmento de atuação da empresa.');
      }
      if (!Number.isFinite(a.workersCount) || a.workersCount < 1) {
        errors.push('Informe quantas pessoas trabalham no negócio (mínimo 1).');
      }
    } else if (step === 2) {
      if (
        !a.unknownCurrentRevenue &&
        (a.currentMonthlyRevenue === null || a.currentMonthlyRevenue <= 0)
      ) {
        errors.push('Informe o faturamento mensal atual ou marque "Não sei informar".');
      }
    } else if (step === 3) {
      if (a.estimatedMonthlyOperatingSpend !== null && a.estimatedMonthlyOperatingSpend < 0) {
        errors.push('O gasto mensal operacional não pode ser negativo.');
      }
      if (a.selectedCostCategories.length === 0) {
        errors.push('Selecione ao menos uma categoria principal de custo do negócio.');
      }
    } else if (step === 4) {
      if (a.wantsToRegisterSuppliers && a.suppliers.length === 0) {
        errors.push('Adicione pelo menos um fornecedor ou marque que não deseja cadastrar agora.');
      }
    }
  } else {
    const a = answers as EstudanteQuestionnaireAnswers;
    if (step === 1) {
      if (!a.educationLevel || !a.institutionType || !a.livingSituation) {
        errors.push('Complete os dados básicos do seu momento de estudo.');
      }
    } else if (step === 2) {
      if (
        !a.hasNoOwnIncome &&
        (a.currentMonthlyIncome === null || a.currentMonthlyIncome <= 0)
      ) {
        errors.push('Informe sua renda mensal atual ou marque "Não possuo renda própria".');
      }
      if (!a.hasNoOwnIncome && a.incomeSources.length === 0) {
        errors.push('Selecione ao menos uma origem para sua renda ou auxílio.');
      }
    } else if (step === 3) {
      if (a.estimatedMonthlyExpenses !== null && a.estimatedMonthlyExpenses < 0) {
        errors.push('O gasto mensal aproximado não pode ser negativo.');
      }
      if (a.selectedExpenseCategories.length === 0) {
        errors.push('Selecione ao menos uma categoria de gasto.');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

const GROUP_PALETTE = [
  { color: '#006a61', icon: 'ShoppingCart' },
  { color: '#497cff', icon: 'Home' },
  { color: '#b45309', icon: 'Zap' },
  { color: '#7c3aed', icon: 'Car' },
  { color: '#0f766e', icon: 'Package' },
  { color: '#be123c', icon: 'HeartPulse' },
  { color: '#2563eb', icon: 'GraduationCap' },
  { color: '#059669', icon: 'Smartphone' },
];

export function buildPrefillBundleFromQuestionnaire(params: {
  mode: ProfileMode;
  baseProfile: FamilyProfile;
  answers:
    | PessoalQuestionnaireAnswers
    | NegocioQuestionnaireAnswers
    | EstudanteQuestionnaireAnswers;
  existingGroups: ConsumptionGroup[];
  existingItems?: BasketItem[];
  existingIncomeRecords?: IncomeRecord[];
  existingPriceRecords?: PriceRecord[];
  defaultGroupsForMode: ConsumptionGroup[];
  isUpdateFromSettings?: boolean;
}): PrefillBundleResult {
  const {
    mode,
    baseProfile,
    answers,
    existingGroups,
    existingItems = [],
    existingIncomeRecords = [],
    existingPriceRecords = [],
    defaultGroupsForMode,
    isUpdateFromSettings = false,
  } = params;

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const todayDate = toIsoDate(nowDate);
  const yearAgoDate = oneYearAgoIso(nowDate);
  const profileId = baseProfile.id;

  // 1. Extrair variáveis específicas conforme modalidade
  let profileName = baseProfile.name;
  let membersCount = baseProfile.membersCount || 1;
  let hasNoOwnIncome = false;
  let currentIncome: number | null = null;
  let historicalIncome: number | null = null;
  let incomePredictability: IncomePredictability = 'fixa';
  let incomeSourceText = '';
  let estimatedMonthlyExpenses: number | null = null;
  let surplusFrequency: SurplusFrequency = 'nao_sei';
  let reportedMonthlySurplus: number | null = null;
  let suppliers: string[] = baseProfile.suppliers || [];
  let selectedCategories: string[] = [];
  let categoryEstimates: Record<string, number> = {};
  let fixedCategories: string[] = [];
  let variableCategories: string[] = [];
  let directPaidCategories: string[] = [];
  let recurringDefault = true;
  let itemEntries: QuestionnaireItemEntry[] = [];
  let purchaseFreqRaw = 'Mensalmente';
  let budgetDrivers: string[] = [];
  let demoSegment: string | undefined;
  let dashboardPreferences: DashboardPreferences;

  if (mode === 'pessoal') {
    const a = answers as PessoalQuestionnaireAnswers;
    membersCount = Math.max(1, Math.min(50, Math.round(a.membersCount || 1)));
    currentIncome = a.unknownCurrentIncome ? null : a.currentMonthlyIncome;
    historicalIncome = a.unknownIncomeOneYearAgo ? null : a.incomeOneYearAgo;
    incomePredictability = mapPredictability(mode, a.incomePredictability);
    incomeSourceText = a.primaryIncomeComposition;
    estimatedMonthlyExpenses = a.estimatedMonthlyExpenses;
    surplusFrequency = a.surplusFrequency;
    reportedMonthlySurplus =
      a.surplusFrequency === 'nunca' || a.surplusFrequency === 'nao_sei'
        ? null
        : a.reportedMonthlySurplus;
    selectedCategories = a.selectedExpenseCategories;
    categoryEstimates = a.categoryEstimates;
    itemEntries = a.itemEntries;
    purchaseFreqRaw = a.shoppingFrequency;
    budgetDrivers = a.majorBudgetDrivers;
    dashboardPreferences = {
      basketSetupChoice: a.basketSetupChoice,
      compareIncomeVsInflation: a.compareIncomeVsInflation,
      trackMonthlyBudgetImpact: a.trackMonthlyBudgetImpact,
    };
  } else if (mode === 'negocio') {
    const a = answers as NegocioQuestionnaireAnswers;
    profileName = a.businessName.trim() || baseProfile.name || 'Meu Negócio';
    membersCount = Math.max(1, Math.min(50, Math.round(a.workersCount || 1)));
    currentIncome = a.unknownCurrentRevenue ? null : a.currentMonthlyRevenue;
    historicalIncome = a.unknownRevenueOneYearAgo ? null : a.revenueOneYearAgo;
    incomePredictability = mapPredictability(mode, a.revenuePattern);
    incomeSourceText = `${a.primaryRevenueSource} (${a.businessSegment})`;
    estimatedMonthlyExpenses = a.estimatedMonthlyOperatingSpend;
    surplusFrequency = a.surplusFrequency;
    reportedMonthlySurplus =
      a.surplusFrequency === 'nunca' || a.surplusFrequency === 'nao_sei'
        ? null
        : a.reportedMonthlySurplus;
    suppliers = Array.from(new Set(a.suppliers.map((s) => s.trim()).filter(Boolean)));
    selectedCategories = a.selectedCostCategories;
    categoryEstimates = a.categoryEstimates;
    fixedCategories = a.fixedCostCategories;
    variableCategories = a.variableCostCategories;
    itemEntries = a.itemEntries;
    purchaseFreqRaw = a.purchaseFrequency;
    demoSegment = a.businessSegment;
    dashboardPreferences = {
      basketSetupChoice: a.basketSetupChoice,
      compareIncomeVsInflation: a.compareCostsVsRevenue,
      trackMonthlyBudgetImpact: a.trackCostDrivers,
      trackCostDrivers: a.trackCostDrivers,
    };
  } else {
    const a = answers as EstudanteQuestionnaireAnswers;
    hasNoOwnIncome = Boolean(a.hasNoOwnIncome);
    currentIncome = hasNoOwnIncome ? null : a.currentMonthlyIncome;
    historicalIncome =
      a.incomeOneYearAgoStatus === 'informado' ? a.incomeOneYearAgo : null;
    incomePredictability = mapPredictability(mode, a.incomePattern, hasNoOwnIncome);
    incomeSourceText = hasNoOwnIncome
      ? 'Sem renda própria'
      : a.incomeSources.filter((s) => s !== 'Não possuo renda própria').join(', ') || 'Renda estudantil';
    estimatedMonthlyExpenses = a.estimatedMonthlyExpenses;
    surplusFrequency = hasNoOwnIncome ? 'sem_renda_propria' : a.surplusFrequency;
    reportedMonthlySurplus =
      hasNoOwnIncome ||
      a.surplusFrequency === 'nunca' ||
      a.surplusFrequency === 'nao_sei' ||
      a.surplusFrequency === 'sem_renda_propria'
        ? null
        : a.reportedMonthlySurplus;
    selectedCategories = a.selectedExpenseCategories;
    categoryEstimates = a.categoryEstimates;
    directPaidCategories = a.directPaidCategories;
    recurringDefault = Boolean(a.hasRecurringExpenses);
    itemEntries = a.itemEntries;
    purchaseFreqRaw = a.purchaseFrequency;
    budgetDrivers = a.majorBudgetDrivers;
    if (!baseProfile.name || baseProfile.name === 'Minha Família') {
      profileName = `Perfil Estudante (${a.educationLevel})`;
    }
    dashboardPreferences = {
      basketSetupChoice: a.basketSetupChoice,
      compareIncomeVsInflation: a.compareIncomeVsInflation,
      trackMonthlyBudgetImpact: a.trackMonthlyBudgetImpact,
    };
  }

  // 2. Montar payload do questionário no perfil
  const questionnaireData: QuestionnaireDataPayload = {
    mode,
    version: QUESTIONNAIRE_VERSION,
    completedAt: baseProfile.onboardingCompletedAt || nowIso,
    updatedAt: nowIso,
    currentStep: 5,
    ...(mode === 'pessoal' ? { pessoal: answers as PessoalQuestionnaireAnswers } : {}),
    ...(mode === 'negocio' ? { negocio: answers as NegocioQuestionnaireAnswers } : {}),
    ...(mode === 'estudante' ? { estudante: answers as EstudanteQuestionnaireAnswers } : {}),
  };

  const updatedProfile: FamilyProfile = {
    ...baseProfile,
    name: profileName,
    profileMode: mode,
    onboardingStatus: 'completed',
    onboardingStep: 5,
    onboardingCompletedAt: baseProfile.onboardingCompletedAt || nowIso,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    membersCount,
    hasNoOwnIncome,
    reportedMonthlySurplus,
    surplusFrequency,
    estimatedMonthlyExpenses,
    suppliers: suppliers.length > 0 ? suppliers : undefined,
    dashboardPreferences,
    questionnaireData,
    updatedAt: nowIso,
  };

  // 3. Configurar grupos de consumo adequados à modalidade sem apagar categorias do usuário
  const groupsMap = new Map<string, ConsumptionGroup>();
  for (const g of defaultGroupsForMode) {
    groupsMap.set(g.name.toLowerCase(), { ...g, profileMode: mode });
  }
  for (const g of existingGroups) {
    if (!g.profileMode || g.profileMode === mode) {
      groupsMap.set(g.name.toLowerCase(), { ...g, profileMode: mode });
    }
  }
  // Garantir que categorias selecionadas tenham grupo correspondente
  let paletteIdx = 0;
  for (const rawCat of selectedCategories) {
    const mappedGroup = mapQuestionnaireCategoryToGroup(mode, rawCat);
    if (!groupsMap.has(mappedGroup.toLowerCase())) {
      const style = GROUP_PALETTE[paletteIdx % GROUP_PALETTE.length];
      paletteIdx += 1;
      groupsMap.set(mappedGroup.toLowerCase(), {
        id: `grp_${mode}_${sanitizeSlug(mappedGroup)}`,
        name: mappedGroup,
        description: `Categoria configurada via questionário (${mode}).`,
        color: style.color,
        icon: style.icon,
        profileMode: mode,
        isCustom: true,
        active: true,
      });
    }
  }
  const consumptionGroups = Array.from(groupsMap.values());

  // 4. Alimentar referências de renda (preservando registros efetivos anteriores em edições)
  const incomeRole = getIncomeRoleForMode(mode);
  const preservedIncomes = isUpdateFromSettings
    ? existingIncomeRecords.filter(
        (rec) =>
          rec.profileId === profileId &&
          !rec.id.startsWith(`inc_q_${mode}_`) &&
          rec.dataOrigin !== 'estimado'
      )
    : existingIncomeRecords.filter((rec) => rec.profileId !== profileId);

  const questionnaireIncomes: IncomeRecord[] = [];
  if (historicalIncome !== null && historicalIncome > 0) {
    questionnaireIncomes.push({
      id: `inc_q_${mode}_hist`,
      profileId,
      profileMode: mode,
      referenceDate: yearAgoDate,
      nominalIncome: historicalIncome,
      source: incomeSourceText,
      incomeRole,
      incomePredictability,
      dataOrigin: 'estimado',
      notes: `Referência histórica (há ~1 ano) informada no questionário (${mode}).`,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  if (!hasNoOwnIncome && currentIncome !== null && currentIncome > 0) {
    questionnaireIncomes.push({
      id: `inc_q_${mode}_curr`,
      profileId,
      profileMode: mode,
      referenceDate: todayDate,
      nominalIncome: currentIncome,
      source: incomeSourceText,
      incomeRole,
      incomePredictability,
      dataOrigin: 'estimado',
      notes: `Referência mensal atual informada no questionário (${mode}).`,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  const incomeRecords = [...preservedIncomes, ...questionnaireIncomes];

  // 5. Alimentar cesta de produtos e referências de despesas sem duplicar itens já cadastrados
  const useDemoBasket = dashboardPreferences.basketSetupChoice === 'demonstracao';
  const preservedItems = isUpdateFromSettings
    ? existingItems.filter((item) => !item.id.startsWith(`item_q_${mode}_`))
    : [];
  const preservedPrices = isUpdateFromSettings
    ? existingPriceRecords.filter((rec) => !rec.id.startsWith(`pr_q_${mode}_`))
    : [];

  const generatedItems: BasketItem[] = [];
  const generatedPrices: PriceRecord[] = [];
  const coveredGroups = new Set<string>();

  if (!useDemoBasket) {
    const freqValue = mapFrequencyToConsumption(purchaseFreqRaw);

    for (let idx = 0; idx < itemEntries.length; idx += 1) {
      const entry = itemEntries[idx];
      const mappedGroup = mapQuestionnaireCategoryToGroup(mode, entry.category);
      coveredGroups.add(mappedGroup.toLowerCase());

      const slug = sanitizeSlug(entry.name || `item_${idx + 1}`);
      const itemId = `item_q_${mode}_${slug}_${idx + 1}`;
      const qty = Math.max(0.01, Number(entry.quantity) || 1);
      const currPrice =
        entry.currentPrice !== null && entry.currentPrice > 0 ? Number(entry.currentPrice) : 0;
      const oldPrice =
        entry.oldPrice !== null && entry.oldPrice > 0 ? Number(entry.oldPrice) : 0;

      const catEstimate = categoryEstimates[entry.category] || 0;
      const estimatedSpend =
        currPrice > 0
          ? Number((currPrice * qty).toFixed(2))
          : catEstimate > 0
            ? Number(catEstimate.toFixed(2))
            : 0;

      const isFixed = fixedCategories.includes(entry.category);
      const isVariable = variableCategories.includes(entry.category);
      const expenseNature = isFixed ? 'Fixa' : isVariable ? 'Variável' : 'Variável';
      const paidDirectly =
        mode === 'estudante'
          ? directPaidCategories.length === 0 || directPaidCategories.includes(entry.category)
          : undefined;
      const isMajor =
        Boolean(entry.isMajorDriver) ||
        budgetDrivers.includes(entry.name) ||
        budgetDrivers.includes(entry.category);

      const newItem: BasketItem = {
        id: itemId,
        profileId,
        profileMode: mode,
        name: entry.name.trim(),
        description: isMajor
          ? 'Apontado no questionário inicial como um dos itens de maior peso no orçamento.'
          : 'Cadastrado via questionário inicial.',
        group: mappedGroup,
        subcategory: entry.category,
        classification: isEssentialCategoryForMode(mode, entry.category)
          ? 'Essencial'
          : 'Supérfluo',
        monthlySpend: estimatedSpend,
        oldPrice,
        currentPrice: currPrice,
        oldPriceDate: oldPrice > 0 ? yearAgoDate : todayDate,
        currentPriceDate: todayDate,
        unit: entry.unit || 'un',
        quantity: qty,
        baseQuantity: qty,
        consumptionFrequency: freqValue,
        expenseNature,
        recurrenceType: recurringDefault ? 'Recorrente' : 'Eventual',
        accountingType: 'Consumo',
        ...(entry.supplierName ? { supplierName: entry.supplierName } : {}),
        ...(typeof paidDirectly === 'boolean' ? { paidDirectly } : {}),
        dataOrigin: currPrice > 0 ? 'usuario' : 'estimado',
        notes:
          oldPrice > 0
            ? 'Preço atual e referência histórica informados no questionário inicial.'
            : 'Iniciado a partir da data do questionário (sem histórico anterior informado).',
        active: true,
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      generatedItems.push(newItem);

      if (oldPrice > 0) {
        generatedPrices.push({
          id: `pr_q_${mode}_${slug}_${idx + 1}_old`,
          profileId,
          itemId,
          itemName: newItem.name,
          price: oldPrice,
          referenceDate: yearAgoDate,
          unit: newItem.unit,
          supplierName: entry.supplierName,
          source: 'Questionário inicial (há 1 ano)',
          dataOrigin: 'estimado',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
      if (currPrice > 0) {
        generatedPrices.push({
          id: `pr_q_${mode}_${slug}_${idx + 1}_curr`,
          profileId,
          itemId,
          itemName: newItem.name,
          price: currPrice,
          referenceDate: todayDate,
          unit: newItem.unit,
          supplierName: entry.supplierName,
          source: 'Questionário inicial (preço atual)',
          dataOrigin: 'usuario',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    // Criar referências estimadas apenas para categorias com valor mensal informado que ainda não têm itens detalhados
    for (const rawCat of selectedCategories) {
      const estimateVal = Number(categoryEstimates[rawCat] || 0);
      if (estimateVal <= 0) continue;

      const mappedGroup = mapQuestionnaireCategoryToGroup(mode, rawCat);
      const alreadyHasItemInCat =
        coveredGroups.has(mappedGroup.toLowerCase()) ||
        preservedItems.some(
          (item) =>
            item.group.toLowerCase() === mappedGroup.toLowerCase() ||
            (item.subcategory || '').toLowerCase() === rawCat.toLowerCase()
        );
      if (alreadyHasItemInCat) continue;

      const slug = sanitizeSlug(rawCat);
      const itemId = `item_q_${mode}_cat_${slug}`;
      const isFixed = fixedCategories.includes(rawCat);
      const paidDirectly =
        mode === 'estudante'
          ? directPaidCategories.length === 0 || directPaidCategories.includes(rawCat)
          : undefined;

      generatedItems.push({
        id: itemId,
        profileId,
        profileMode: mode,
        name: `Estimativa mensal: ${rawCat}`,
        description: 'Estimativa inicial informada por categoria no questionário (sem preço unitário histórico).',
        group: mappedGroup,
        subcategory: rawCat,
        classification: isEssentialCategoryForMode(mode, rawCat) ? 'Essencial' : 'Supérfluo',
        monthlySpend: Number(estimateVal.toFixed(2)),
        oldPrice: 0,
        currentPrice: 0,
        oldPriceDate: todayDate,
        currentPriceDate: todayDate,
        unit: 'mês',
        quantity: 1,
        baseQuantity: 1,
        consumptionFrequency: 'mensal',
        expenseNature: isFixed ? 'Fixa' : 'Variável',
        recurrenceType: recurringDefault ? 'Recorrente' : 'Eventual',
        accountingType: 'Consumo',
        ...(typeof paidDirectly === 'boolean' ? { paidDirectly } : {}),
        dataOrigin: 'estimado',
        notes: 'Referência de orçamento por categoria informada no questionário.',
        active: true,
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  return {
    profile: updatedProfile,
    incomeRecords,
    consumptionGroups,
    items: useDemoBasket ? preservedItems : [...preservedItems, ...generatedItems],
    priceRecords: useDemoBasket ? preservedPrices : [...preservedPrices, ...generatedPrices],
    useDemoBasket,
    demoSegment,
  };
}
