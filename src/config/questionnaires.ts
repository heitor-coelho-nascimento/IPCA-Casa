import {
  EstudanteQuestionnaireAnswers,
  NegocioQuestionnaireAnswers,
  PessoalQuestionnaireAnswers,
  ProfileMode,
  QuestionnaireItemEntry,
  SurplusFrequency,
} from '../types';

export const QUESTIONNAIRE_VERSION = '2.0.0';

// ==========================================
// OPÇÕES E CATEGORIAS — QUESTIONÁRIO 1 (PESSOAL / FAMILIAR)
// ==========================================
export const PESSOAL_INCOME_COMPOSITIONS = [
  'Salários',
  'Aposentadorias ou pensões',
  'Trabalho autônomo',
  'Benefícios sociais',
  'Renda empresarial',
  'Outras fontes',
  'Combinação de diferentes fontes',
] as const;

export const PESSOAL_SHORTFALL_BEHAVIORS = [
  'A renda é totalmente utilizada nas despesas',
  'É necessário utilizar reservas',
  'A família precisa recorrer ao crédito ou empréstimos',
  'A família acumula contas pendentes',
  'Outra situação',
] as const;

export const PESSOAL_EXPENSE_CATEGORIES = [
  'Alimentação',
  'Moradia e aluguel',
  'Água',
  'Energia elétrica',
  'Gás',
  'Transporte',
  'Saúde',
  'Educação',
  'Internet e telefone',
  'Higiene e limpeza',
  'Lazer',
  'Vestuário',
  'Outros',
] as const;

export const PESSOAL_REGULAR_PRODUCTS: Array<{
  name: string;
  category: string;
  defaultUnit: string;
  defaultQty: number;
}> = [
  { name: 'Arroz', category: 'Alimentação', defaultUnit: 'kg', defaultQty: 5 },
  { name: 'Feijão', category: 'Alimentação', defaultUnit: 'kg', defaultQty: 3 },
  { name: 'Açúcar', category: 'Alimentação', defaultUnit: 'kg', defaultQty: 2 },
  { name: 'Óleo', category: 'Alimentação', defaultUnit: 'un', defaultQty: 2 },
  { name: 'Café', category: 'Alimentação', defaultUnit: '500g', defaultQty: 2 },
  { name: 'Leite', category: 'Alimentação', defaultUnit: 'litro', defaultQty: 12 },
  { name: 'Carnes', category: 'Alimentação', defaultUnit: 'kg', defaultQty: 4 },
  { name: 'Frango', category: 'Alimentação', defaultUnit: 'kg', defaultQty: 4 },
  { name: 'Ovos', category: 'Alimentação', defaultUnit: 'dúzia', defaultQty: 3 },
  { name: 'Pão', category: 'Alimentação', defaultUnit: 'kg', defaultQty: 4 },
  { name: 'Frutas', category: 'Alimentação', defaultUnit: 'kg', defaultQty: 8 },
  { name: 'Verduras e legumes', category: 'Alimentação', defaultUnit: 'kg', defaultQty: 8 },
  { name: 'Produtos de limpeza', category: 'Higiene e limpeza', defaultUnit: 'un', defaultQty: 6 },
  { name: 'Produtos de higiene', category: 'Higiene e limpeza', defaultUnit: 'un', defaultQty: 6 },
  { name: 'Gás de cozinha', category: 'Gás', defaultUnit: 'botijão', defaultQty: 1 },
];

// ==========================================
// OPÇÕES E CATEGORIAS — QUESTIONÁRIO 2 (NEGÓCIO / PEQUENA EMPRESA)
// ==========================================
export const NEGOCIO_SEGMENTS = [
  'Alimentação',
  'Comércio varejista',
  'Serviços',
  'Beleza e estética',
  'Saúde',
  'Educação',
  'Construção',
  'Tecnologia',
  'Indústria',
  'Outro',
] as const;

export const NEGOCIO_SIZES = [
  'MEI',
  'Microempresa',
  'Empresa de Pequeno Porte',
  'Médio porte',
  'Não sei informar',
] as const;

export const NEGOCIO_TENURES = [
  'Menos de 1 ano',
  'De 1 a 3 anos',
  'De 3 a 5 anos',
  'Mais de 5 anos',
] as const;

export const NEGOCIO_SHORTFALL_REASONS = [
  'Custos elevados',
  'Despesas fixas elevadas',
  'Baixo faturamento',
  'Aumento dos preços dos fornecedores',
  'Endividamento',
  'Outros fatores',
  'Não sei informar',
] as const;

export const NEGOCIO_COST_CATEGORIES = [
  'Matéria-prima',
  'Insumos',
  'Mercadorias para revenda',
  'Embalagens',
  'Fornecedores',
  'Serviços terceirizados',
  'Aluguel',
  'Energia elétrica',
  'Água',
  'Internet e telefone',
  'Logística e frete',
  'Combustível',
  'Manutenção',
  'Equipamentos',
  'Outros',
] as const;

export const NEGOCIO_SUGGESTED_ITEMS_BY_SEGMENT: Record<
  string,
  Array<{ name: string; category: string; unit: string; quantity: number }>
> = {
  Alimentação: [
    { name: 'Farinha / Base de preparo', category: 'Matéria-prima', unit: 'kg', quantity: 50 },
    { name: 'Óleo / Gordura culinária', category: 'Insumos', unit: 'litro', quantity: 20 },
    { name: 'Embalagens descartáveis', category: 'Embalagens', unit: 'cento', quantity: 5 },
    { name: 'Energia elétrica comercial', category: 'Energia elétrica', unit: 'kWh', quantity: 600 },
  ],
  'Comércio varejista': [
    { name: 'Mercadorias principais para revenda', category: 'Mercadorias para revenda', unit: 'un', quantity: 100 },
    { name: 'Sacolas e caixas', category: 'Embalagens', unit: 'cento', quantity: 4 },
    { name: 'Frete e entregas', category: 'Logística e frete', unit: 'mês', quantity: 1 },
  ],
  Serviços: [
    { name: 'Materiais de atendimento', category: 'Insumos', unit: 'un', quantity: 20 },
    { name: 'Internet e telefonia', category: 'Internet e telefone', unit: 'mês', quantity: 1 },
    { name: 'Deslocamento / Combustível', category: 'Combustível', unit: 'litro', quantity: 60 },
  ],
  'Beleza e estética': [
    { name: 'Cosméticos e descartáveis', category: 'Insumos', unit: 'un', quantity: 25 },
    { name: 'Energia elétrica do salão', category: 'Energia elétrica', unit: 'kWh', quantity: 350 },
    { name: 'Aluguel da sala', category: 'Aluguel', unit: 'mês', quantity: 1 },
  ],
};

// ==========================================
// OPÇÕES E CATEGORIAS — QUESTIONÁRIO 3 (ESTUDANTE)
// ==========================================
export const ESTUDANTE_EDUCATION_LEVELS = [
  'Ensino Fundamental',
  'Ensino Médio',
  'Ensino Técnico',
  'Ensino Superior',
  'Pós-graduação',
  'Outro',
] as const;

export const ESTUDANTE_INSTITUTION_TYPES = [
  'Pública',
  'Particular',
  'Ambas',
  'Outra modalidade',
] as const;

export const ESTUDANTE_STUDY_PERIODS = [
  'Matutino',
  'Vespertino',
  'Noturno',
  'Integral',
  'Flexível',
] as const;

export const ESTUDANTE_LIVING_SITUATIONS = [
  'Com pais ou responsáveis',
  'Sozinho',
  'Com outros familiares',
  'República ou moradia estudantil',
  'Outra situação',
] as const;

export const ESTUDANTE_INCOME_SOURCES = [
  'Mesada',
  'Bolsa de estudos',
  'Auxílio estudantil',
  'Estágio',
  'Jovem Aprendiz',
  'Emprego',
  'Trabalho autônomo',
  'Ajuda familiar',
  'Outras fontes',
  'Não possuo renda própria',
] as const;

export const ESTUDANTE_EXPENSE_CATEGORIES = [
  'Alimentação',
  'Lanches',
  'Transporte',
  'Material escolar',
  'Livros e apostilas',
  'Cursos',
  'Internet e telefone',
  'Tecnologia',
  'Assinaturas digitais',
  'Lazer',
  'Roupas',
  'Higiene pessoal',
  'Saúde',
  'Moradia',
  'Outros',
] as const;

export const ESTUDANTE_CONSUMPTION_CATEGORIES: Array<{
  name: string;
  category: string;
  unit: string;
  quantity: number;
}> = [
  { name: 'Lanches / Refeição fora de casa', category: 'Alimentação e lanches', unit: 'un', quantity: 20 },
  { name: 'Passagem / Transporte diário', category: 'Transporte', unit: 'viagem', quantity: 40 },
  { name: 'Cadernos, canetas e papelaria', category: 'Material escolar', unit: 'kit', quantity: 1 },
  { name: 'Livros, cópias e apostilas', category: 'Livros e apostilas', unit: 'un', quantity: 2 },
  { name: 'Mensalidade de curso / preparatório', category: 'Cursos e mensalidades', unit: 'mês', quantity: 1 },
  { name: 'Plano de celular / internet', category: 'Internet e telefonia', unit: 'mês', quantity: 1 },
  { name: 'Assinaturas de estudo / software', category: 'Assinaturas digitais', unit: 'mês', quantity: 1 },
  { name: 'Periféricos / acessórios de estudo', category: 'Tecnologia e acessórios', unit: 'un', quantity: 1 },
];

export const SURPLUS_FREQUENCY_LABELS: Record<SurplusFrequency, string> = {
  quase_sempre: 'Sim, quase sempre',
  as_vezes: 'Sim, às vezes',
  raramente: 'Raramente',
  nunca: 'Nunca',
  sem_renda_propria: 'Não possuo renda própria',
  nao_sei: 'Não sei informar',
};

// ==========================================
// MAPEAMENTO DE CATEGORIAS DO QUESTIONÁRIO -> GRUPOS ECONÔMICOS DO SISTEMA
// ==========================================
export function mapQuestionnaireCategoryToGroup(
  mode: ProfileMode,
  rawCategory: string
): string {
  const normalized = rawCategory.trim();
  if (mode === 'pessoal') {
    const map: Record<string, string> = {
      Alimentação: 'Alimentação e bebidas',
      'Moradia e aluguel': 'Habitação',
      Água: 'Habitação',
      'Energia elétrica': 'Habitação',
      Gás: 'Habitação',
      Transporte: 'Transportes',
      Saúde: 'Saúde e cuidados pessoais',
      Educação: 'Educação',
      'Internet e telefone': 'Comunicação',
      'Higiene e limpeza': 'Artigos de residência',
      Lazer: 'Despesas pessoais',
      Vestuário: 'Vestuário',
      Outros: 'Despesas pessoais',
    };
    return map[normalized] || normalized;
  }

  if (mode === 'negocio') {
    const map: Record<string, string> = {
      'Matéria-prima': 'Matéria-prima e Insumos',
      Insumos: 'Matéria-prima e Insumos',
      'Mercadorias para revenda': 'Mercadorias para Revenda',
      Embalagens: 'Embalagens e Descartáveis',
      Fornecedores: 'Fornecedores e Terceirizados',
      'Serviços terceirizados': 'Fornecedores e Terceirizados',
      Aluguel: 'Estrutura, Aluguel e Energia',
      'Energia elétrica': 'Estrutura, Aluguel e Energia',
      Água: 'Estrutura, Aluguel e Energia',
      'Internet e telefone': 'Comunicação e Sistemas',
      'Logística e frete': 'Logística e Combustível',
      Combustível: 'Logística e Combustível',
      Manutenção: 'Manutenção e Equipamentos',
      Equipamentos: 'Manutenção e Equipamentos',
      Outros: 'Despesas Operacionais Gerais',
    };
    return map[normalized] || normalized;
  }

  // estudante
  const map: Record<string, string> = {
    Alimentação: 'Alimentação e Lanches',
    'Alimentação e lanches': 'Alimentação e Lanches',
    Lanches: 'Alimentação e Lanches',
    Transporte: 'Transporte Estudantil',
    'Material escolar': 'Material Escolar e Papelaria',
    'Livros e apostilas': 'Livros e Apostilas',
    Cursos: 'Cursos e Mensalidades',
    'Cursos e mensalidades': 'Cursos e Mensalidades',
    'Internet e telefone': 'Internet e Assinaturas',
    Tecnologia: 'Tecnologia e Acessórios',
    'Tecnologia e acessórios': 'Tecnologia e Acessórios',
    'Assinaturas digitais': 'Internet e Assinaturas',
    'Internet e telefonia': 'Internet e Assinaturas',
    Lazer: 'Lazer e Vida Acadêmica',
    Roupas: 'Vestuário e Higiene',
    Vestuário: 'Vestuário e Higiene',
    'Higiene pessoal': 'Vestuário e Higiene',
    Saúde: 'Saúde e Bem-estar',
    Moradia: 'Moradia Estudantil',
    Outros: 'Outros Gastos Estudantis',
  };
  return map[normalized] || normalized;
}

export function isEssentialCategoryForMode(mode: ProfileMode, rawCategory: string): boolean {
  if (mode === 'negocio') {
    return ![
      'Outros',
      'Despesas Operacionais Gerais',
    ].includes(rawCategory);
  }
  if (mode === 'estudante') {
    return !['Lazer', 'Assinaturas digitais', 'Outros'].includes(rawCategory);
  }
  return !['Lazer', 'Vestuário', 'Outros'].includes(rawCategory);
}

// ==========================================
// DEFAULTS PARA NOVOS QUESTIONÁRIOS
// ==========================================
export function createDefaultPessoalAnswers(initialMembersCount = 3): PessoalQuestionnaireAnswers {
  return {
    membersCount: Math.max(1, initialMembersCount),
    contributorsCount: 1,
    dependentsCount: Math.max(0, initialMembersCount - 1),
    primaryIncomeComposition: 'Salários',
    currentMonthlyIncome: null,
    unknownCurrentIncome: false,
    incomeOneYearAgo: null,
    unknownIncomeOneYearAgo: false,
    incomePredictability: 'Fixa',
    incomeTrend12M: 'Permaneceu igual',
    incomeEarnersCount: 1,
    surplusFrequency: 'as_vezes',
    reportedMonthlySurplus: null,
    shortfallBehavior: 'A renda é totalmente utilizada nas despesas',
    estimatedMonthlyExpenses: null,
    selectedExpenseCategories: ['Alimentação', 'Moradia e aluguel', 'Energia elétrica', 'Transporte'],
    categoryEstimates: {},
    expenseStability: 'Variam pouco',
    selectedRegularProducts: ['Arroz', 'Feijão', 'Café', 'Leite'],
    shoppingFrequency: 'Mensalmente',
    itemEntries: [],
    knowsOldPrices: 'Apenas alguns',
    majorBudgetDrivers: ['Alimentação'],
    basketSetupChoice: 'propria',
    compareIncomeVsInflation: true,
    trackMonthlyBudgetImpact: true,
  };
}

export function createDefaultNegocioAnswers(initialName = ''): NegocioQuestionnaireAnswers {
  return {
    businessName: initialName,
    businessSegment: 'Alimentação',
    businessActivityDescription: '',
    businessSize: 'Microempresa',
    workersCount: 2,
    operatingTenure: 'De 1 a 3 anos',
    currentMonthlyRevenue: null,
    unknownCurrentRevenue: false,
    revenueOneYearAgo: null,
    unknownRevenueOneYearAgo: false,
    revenuePattern: 'Variável',
    revenueTrend12M: 'Permaneceu igual',
    primaryRevenueSource: 'Venda de produtos',
    estimatedMonthlyOperatingSpend: null,
    surplusFrequency: 'as_vezes',
    reportedMonthlySurplus: null,
    shortfallReason: 'Custos elevados',
    selectedCostCategories: ['Insumos', 'Aluguel', 'Energia elétrica'],
    categoryEstimates: {},
    fixedCostCategories: ['Aluguel'],
    variableCostCategories: ['Insumos', 'Energia elétrica'],
    operationalCostsIncreased12M: 'Sim',
    operationalCostIncreaseAmount: '',
    itemEntries: [],
    knowsOldPrices: 'Apenas alguns',
    buysFromSameSuppliers: 'Sim',
    wantsToRegisterSuppliers: false,
    suppliers: [],
    purchaseFrequency: 'Semanalmente',
    basketSetupChoice: 'propria',
    compareCostsVsRevenue: true,
    trackCostDrivers: true,
  };
}

export function createDefaultEstudanteAnswers(): EstudanteQuestionnaireAnswers {
  return {
    educationLevel: 'Ensino Superior',
    institutionType: 'Pública',
    studyPeriod: 'Matutino',
    livingSituation: 'Com pais ou responsáveis',
    hasNoOwnIncome: false,
    currentMonthlyIncome: null,
    incomeSources: ['Mesada'],
    incomeOneYearAgo: null,
    incomeOneYearAgoStatus: 'nao_sei',
    incomePattern: 'Fixa',
    incomeTrend12M: 'Permaneceu igual',
    estimatedMonthlyExpenses: null,
    surplusFrequency: 'as_vezes',
    reportedMonthlySurplus: null,
    selectedExpenseCategories: ['Alimentação', 'Transporte', 'Material escolar'],
    categoryEstimates: {},
    directPaidCategories: ['Alimentação', 'Transporte'],
    hasRecurringExpenses: true,
    expensesIncreased12M: 'Sim',
    selectedConsumptionCategories: ['Alimentação e lanches', 'Transporte', 'Material escolar'],
    itemEntries: [],
    knowsOldPrices: 'Apenas alguns',
    majorBudgetDrivers: ['Alimentação e lanches'],
    purchaseFrequency: 'Semanalmente',
    basketSetupChoice: 'propria',
    compareIncomeVsInflation: true,
    trackMonthlyBudgetImpact: true,
  };
}

export function buildItemEntriesFromSelection(
  selectedNames: string[],
  existingEntries: QuestionnaireItemEntry[],
  mode: ProfileMode
): QuestionnaireItemEntry[] {
  const byName = new Map(existingEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const result: QuestionnaireItemEntry[] = [];

  for (const name of selectedNames) {
    const existing = byName.get(name.toLowerCase());
    if (existing) {
      result.push(existing);
      continue;
    }

    if (mode === 'pessoal') {
      const preset = PESSOAL_REGULAR_PRODUCTS.find((p) => p.name === name);
      result.push({
        id: `qitem_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${result.length + 1}`,
        name,
        category: preset?.category || 'Alimentação',
        unit: preset?.defaultUnit || 'un',
        quantity: preset?.defaultQty || 1,
        currentPrice: null,
        oldPrice: null,
      });
    } else if (mode === 'estudante') {
      const preset = ESTUDANTE_CONSUMPTION_CATEGORIES.find(
        (p) => p.category === name || p.name === name
      );
      result.push({
        id: `qitem_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${result.length + 1}`,
        name: preset?.name || name,
        category: preset?.category || name,
        unit: preset?.unit || 'un',
        quantity: preset?.quantity || 1,
        currentPrice: null,
        oldPrice: null,
      });
    } else {
      result.push({
        id: `qitem_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${result.length + 1}`,
        name,
        category: name,
        unit: 'un',
        quantity: 1,
        currentPrice: null,
        oldPrice: null,
      });
    }
  }

  // Preservar itens customizados que não vieram da seleção padrão
  for (const entry of existingEntries) {
    if (!result.some((r) => r.id === entry.id || r.name.toLowerCase() === entry.name.toLowerCase())) {
      result.push(entry);
    }
  }

  return result;
}
