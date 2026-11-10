/**
 * IPCA-Casa: Camada de Persistência e Repositório Local
 * Suporte a múltiplos perfis familiares, isolamento por usuário, histórico de preços
 * e integridade referencial dos registros.
 */

import { BasketItem, ConsumptionGroup, FamilyProfile, IncomeRecord, PriceRecord, SubstitutePlanA, EfficiencyPlanB, OpportunityPlanC } from '../types';

const STORAGE_KEYS = {
  PROFILES: 'ipca_casa_profiles_v1',
  ACTIVE_PROFILE: 'ipca_casa_active_profile_v1',
  BASKET_ITEMS: 'ipca_casa_basket_items_v1',
  PRICE_HISTORY: 'ipca_casa_price_history_v1',
  INCOME_HISTORY: 'ipca_casa_income_history_v1',
  GROUPS: 'ipca_casa_groups_v1',
  PLANS_A: 'ipca_casa_plans_a_v1',
  PLANS_B: 'ipca_casa_plans_b_v1',
  PLANS_C: 'ipca_casa_plans_c_v1',
};

export const DEFAULT_GROUPS: ConsumptionGroup[] = [
  { id: 'grp-1', name: 'Alimentação e bebidas', description: 'Gêneros alimentícios, carnes, hortifrúti e refeições', color: '#000000', icon: 'restaurant', nationalWeightIBGE: 21.0 },
  { id: 'grp-2', name: 'Habitação', description: 'Aluguel, condomínio, energia elétrica, gás e água', color: '#497cff', icon: 'home', nationalWeightIBGE: 15.0 },
  { id: 'grp-3', name: 'Transportes', description: 'Combustíveis, transporte público, manutenção veicular', color: '#006a61', icon: 'directions_car', nationalWeightIBGE: 20.0 },
  { id: 'grp-4', name: 'Saúde e cuidados pessoais', description: 'Planos de saúde, farmácia, consultas e higiene', color: '#86f2e4', icon: 'health_and_safety', nationalWeightIBGE: 13.5 },
  { id: 'grp-5', name: 'Educação', description: 'Mensalidades escolares, cursos, livros e material didático', color: '#bec6e0', icon: 'school', nationalWeightIBGE: 6.0 },
  { id: 'grp-6', name: 'Despesas pessoais', description: 'Lazer, serviços pessoais, vestuário e recreação', color: '#d3e4fe', icon: 'person', nationalWeightIBGE: 10.0 },
  { id: 'grp-7', name: 'Comunicação', description: 'Telefonia celular, internet banda larga e streaming', color: '#7c839b', icon: 'wifi', nationalWeightIBGE: 5.5 },
  { id: 'grp-8', name: 'Vestuário', description: 'Roupas, calçados e acessórios', color: '#3f465c', icon: 'checkroom', nationalWeightIBGE: 4.5 },
  { id: 'grp-9', name: 'Artigos de residência', description: 'Mobiliário, eletrodomésticos e utensílios', color: '#565e74', icon: 'chair', nationalWeightIBGE: 4.5 },
];

export const DEMO_PROFILE_ID = 'profile-demo';
export const USER_DEFAULT_PROFILE_ID = 'profile-clean-slate';
export const EMPTY_PROFILE_ID = USER_DEFAULT_PROFILE_ID;

export const INITIAL_PROFILES: FamilyProfile[] = [
  {
    id: DEMO_PROFILE_ID,
    name: 'Perfil Demonstrativo (Exemplo)',
    membersCount: 4,
    referenceRegion: 'Brasil',
    currency: 'BRL',
    isDemo: true,
    createdAt: '2023-03-01T00:00:00.000Z',
    updatedAt: '2024-03-15T12:00:00.000Z',
  },
  {
    id: USER_DEFAULT_PROFILE_ID,
    name: 'Meu Orçamento Familiar',
    membersCount: 2,
    referenceRegion: 'Brasil',
    currency: 'BRL',
    isDemo: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

/**
 * Cesta demonstrativa de exemplo com itens variados de consumo doméstico
 * Valores didáticos para demonstração de cálculos e gráficos
 */
export const DEMO_BASKET_ITEMS: BasketItem[] = [
  {
    id: 'item-01',
    profileId: DEMO_PROFILE_ID,
    name: 'Aluguel Residencial (Locação)',
    description: 'Imóvel residencial 3 dormitórios',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 1537.90,
    oldPrice: 3100.00,
    currentPrice: 3385.20,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mensalidade',
    notes: 'Reajuste anual pelo IGP-M/IPCA negociado',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-02',
    profileId: DEMO_PROFILE_ID,
    name: 'Plano de Saúde Familiar Copart.',
    description: 'Unimed Nacional • Cobertura Quarto (4 vidas)',
    group: 'Saúde e cuidados pessoais',
    classification: 'Essencial',
    monthlySpend: 1250.00,
    oldPrice: 1090.00,
    currentPrice: 1250.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mensalidade',
    notes: 'Reajuste regulado pela ANS + faixa etária',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-03',
    profileId: DEMO_PROFILE_ID,
    name: 'Gasolina Comum',
    description: 'Consumo aproximado: ~116 litros / mês',
    group: 'Transportes',
    classification: 'Essencial',
    monthlySpend: 680.00,
    oldPrice: 5.20,
    currentPrice: 5.85,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'litro',
    notes: 'Posto habitual da Av. Jabaquara',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-04',
    profileId: DEMO_PROFILE_ID,
    name: 'Mensalidade Escolar Infantil',
    description: 'Colégio Fundamental I (2 filhos)',
    group: 'Educação',
    classification: 'Essencial',
    monthlySpend: 718.25,
    oldPrice: 1550.00,
    currentPrice: 1644.55,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mensalidade',
    notes: 'Rematrícula e apostilas didáticas',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-05',
    profileId: DEMO_PROFILE_ID,
    name: 'Energia Elétrica Residencial',
    description: 'Média mensal 460 kWh • Enel SP',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 410.00,
    oldPrice: 0.78,
    currentPrice: 0.89,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'kWh',
    notes: 'Incidência de bandeira amarela nos últimos ciclos',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-06',
    profileId: DEMO_PROFILE_ID,
    name: 'Carnes Bovinas (Média da Cesta)',
    description: 'Cortes para consumo semanal (~12 kg/mês)',
    group: 'Alimentação e bebidas',
    classification: 'Essencial',
    monthlySpend: 490.10,
    oldPrice: 42.00,
    currentPrice: 47.96,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'kg',
    notes: 'Acém, patinho e coxão mole',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-07',
    profileId: DEMO_PROFILE_ID,
    name: 'Taxa Condominial Ordinária',
    description: 'Condomínio Residencial Edifício Flamboyant',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 456.30,
    oldPrice: 780.00,
    currentPrice: 826.80,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mensalidade',
    notes: 'Dissídio coletivo dos porteiros e zelador',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-08',
    profileId: DEMO_PROFILE_ID,
    name: 'Azeite de Oliva Extra Virgem 500ml',
    description: 'Vidro 500ml • Consumo: 1 unidade/mês',
    group: 'Alimentação e bebidas',
    classification: 'Supérfluo',
    monthlySpend: 48.00,
    oldPrice: 29.90,
    currentPrice: 46.90,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'unidade',
    notes: 'Choque de safra e seca na bacia do Mediterrâneo',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-09',
    profileId: DEMO_PROFILE_ID,
    name: 'Café Torrado e Moído 500g',
    description: 'Café tradicional marca líder • 2 pct/mês',
    group: 'Alimentação e bebidas',
    classification: 'Essencial',
    monthlySpend: 43.80,
    oldPrice: 16.80,
    currentPrice: 21.90,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'unidade',
    notes: 'Alta mundial da saca do grão conilon e arábica',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-10',
    profileId: DEMO_PROFILE_ID,
    name: 'Arroz Branco Tipo 1 5kg',
    description: 'Pacote 5kg • Marca Camil (2 pcts/mês)',
    group: 'Alimentação e bebidas',
    classification: 'Essencial',
    monthlySpend: 63.80,
    oldPrice: 24.50,
    currentPrice: 31.90,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'unidade',
    notes: 'Pressão climática e exportações',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-11',
    profileId: DEMO_PROFILE_ID,
    name: 'Leite UHT Integral (Litro)',
    description: 'Caixa cartonada 1L • Caixa com 12 unidades',
    group: 'Alimentação e bebidas',
    classification: 'Essencial',
    monthlySpend: 63.48,
    oldPrice: 5.80,
    currentPrice: 5.29,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'litro',
    notes: 'Queda de safra e importação do Mercosul (deflação alívio)',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-12',
    profileId: DEMO_PROFILE_ID,
    name: 'Internet Fibra 500 Mbps',
    description: 'Vivo Fibra Residencial',
    group: 'Comunicação',
    classification: 'Essencial',
    monthlySpend: 150.00,
    oldPrice: 145.00,
    currentPrice: 150.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mensalidade',
    notes: 'Reajuste anual contratual',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-13',
    profileId: DEMO_PROFILE_ID,
    name: 'Água e Esgoto Residencial',
    description: 'Sabesp SP • Consumo médio 18 m³/mês',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 165.00,
    oldPrice: 150.00,
    currentPrice: 165.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'm³',
    notes: 'Tarifa básica + excedente esgoto',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-14',
    profileId: DEMO_PROFILE_ID,
    name: 'Gás de Cozinha Encanado (GLP)',
    description: 'Comgás Residencial • Média 14 m³/mês',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 112.00,
    oldPrice: 104.00,
    currentPrice: 112.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'm³',
    notes: 'Fatura mensal de consumo de gás',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-15',
    profileId: DEMO_PROFILE_ID,
    name: 'Supermercado e Hortifrúti Complementar',
    description: 'Frutas, legumes, verduras, laticínios e limpeza',
    group: 'Alimentação e bebidas',
    classification: 'Essencial',
    monthlySpend: 1395.00,
    oldPrice: 1300.00,
    currentPrice: 1395.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'cesta',
    notes: 'Feira livre e supermercado quinzenal',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-16',
    profileId: DEMO_PROFILE_ID,
    name: 'Farmácia de Uso Contínuo e Higiene',
    description: 'Antialérgicos, hipertensão e artigos de higiene',
    group: 'Saúde e cuidados pessoais',
    classification: 'Essencial',
    monthlySpend: 230.00,
    oldPrice: 215.00,
    currentPrice: 230.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mês',
    notes: 'Reajuste anual de medicamentos CMED',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-17',
    profileId: DEMO_PROFILE_ID,
    name: 'Streaming e Serviços Digitais',
    description: 'Netflix, Spotify Família, Prime e iCloud',
    group: 'Comunicação',
    classification: 'Supérfluo',
    monthlySpend: 110.00,
    oldPrice: 95.00,
    currentPrice: 110.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mensalidade',
    notes: 'Ajuste de assinaturas de entretenimento',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-18',
    profileId: DEMO_PROFILE_ID,
    name: 'Lazer e Refeições Fora de Casa',
    description: 'Pizzaria aos finais de semana e lanches',
    group: 'Despesas pessoais',
    classification: 'Supérfluo',
    monthlySpend: 480.00,
    oldPrice: 440.00,
    currentPrice: 480.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mês',
    notes: 'Restaurantes e deliverys',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-19',
    profileId: DEMO_PROFILE_ID,
    name: 'Seguro Auto e IPVA Proporcional',
    description: 'Seguro cobertura total sedan familiar',
    group: 'Transportes',
    classification: 'Essencial',
    monthlySpend: 280.00,
    oldPrice: 260.00,
    currentPrice: 280.00,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mensalidade',
    notes: 'Renovação apólice anual',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'item-20',
    profileId: DEMO_PROFILE_ID,
    name: 'Artigos de Vestuário e Calçados',
    description: 'Reposição de roupas infantis e tênis escolares',
    group: 'Vestuário',
    classification: 'Supérfluo',
    monthlySpend: 215.37,
    oldPrice: 200.00,
    currentPrice: 215.37,
    oldPriceDate: '2023-03-01',
    currentPriceDate: '2024-03-01',
    unit: 'mês',
    notes: 'Compras sazonais',
    active: true,
    createdAt: '2023-03-01',
    updatedAt: '2024-03-01',
  },
];

export const DEMO_PLANS_A: SubstitutePlanA[] = [
  {
    id: 'sub-01',
    profileId: DEMO_PROFILE_ID,
    originalItemId: 'item-08',
    originalItemName: 'Azeite de Oliva Extra Virgem 500ml',
    originalPrice: 46.90,
    substituteName: 'Óleo Girassol Especial + Azeite Composto',
    substitutePrice: 18.50,
    monthlySavings: 28.40,
    qualitativeTradeoff: 'Excelente custo-benefício: óleo neutro para cocção térmica e azeite reservado para finalização em saladas.',
    applied: true,
  },
  {
    id: 'sub-02',
    profileId: DEMO_PROFILE_ID,
    originalItemId: 'item-09',
    originalItemName: 'Café Torrado Premium 500g',
    originalPrice: 28.90,
    substituteName: 'Café Marca Própria de Qualidade 500g (Selo ABIC Superior)',
    substitutePrice: 18.90,
    monthlySavings: 10.00,
    qualitativeTradeoff: 'Mesmo padrão sensorial 100% Arábica sem o prêmio de marca líder na gôndola.',
    applied: true,
  },
  {
    id: 'sub-03',
    profileId: DEMO_PROFILE_ID,
    originalItemId: 'item-06',
    originalItemName: 'Cortes Nobres Bovinos (Alcatra / Filé)',
    originalPrice: 225.00,
    substituteName: 'Cortes Selecionados Frango + Ovos Caipiras (Sobrecoxa desossada)',
    substitutePrice: 105.00,
    monthlySavings: 120.00,
    qualitativeTradeoff: 'Preservação integral da cota proteica diária com preparo versátil e menor teor de gordura saturada.',
    applied: true,
  },
];

export const DEMO_PLANS_B: EfficiencyPlanB[] = [
  {
    id: 'eff-01',
    profileId: DEMO_PROFILE_ID,
    resourceName: 'Energia Elétrica Residencial',
    unit: 'kWh',
    tariffPerUnit: 0.89,
    currentConsumption: 460,
    targetConsumption: 400,
    currentSpend: 409.40,
    estimatedMonthlySavings: 53.40,
    progressPercent: 45,
    applied: true,
    notes: 'Foco em banhos de 6 minutos, termostato do ar-condicionado em 23°C e eliminação de standby.',
  },
  {
    id: 'eff-02',
    profileId: DEMO_PROFILE_ID,
    resourceName: 'Água & Esgoto',
    unit: 'm³',
    tariffPerUnit: 9.16,
    currentConsumption: 18,
    targetConsumption: 15,
    currentSpend: 165.00,
    estimatedMonthlySavings: 38.00,
    progressPercent: 62,
    applied: true,
    notes: 'Arejadores de torneira instalados e revisão de estanqueidade nas caixas acopladas.',
  },
  {
    id: 'eff-03',
    profileId: DEMO_PROFILE_ID,
    resourceName: 'Transporte Urbano (Gasolina)',
    unit: 'Litros',
    tariffPerUnit: 5.85,
    currentConsumption: 116,
    targetConsumption: 96,
    currentSpend: 680.00,
    estimatedMonthlySavings: 117.00,
    progressPercent: 80,
    applied: true,
    notes: 'Rodízio solidário de carona escolar e adoção de metrô 2x por semana em trajetos ao centro.',
  },
];

export const DEMO_PLAN_C: OpportunityPlanC = {
  id: 'opp-01',
  profileId: DEMO_PROFILE_ID,
  monthlyInvestment: 420.00,
  nominalAnnualRate: 10.50,
  expectedAnnualInflation: 4.00,
  realAnnualYield: 6.25,
  projection12Months: 5324.80,
  projection24Months: 11236.15,
  projection36Months: 17801.90,
};

// ==========================================
// UNIVERSAL KEY-VALUE STORAGE (Browser + Node)
// ==========================================
const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStore.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    memoryStore.set(key, value);
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    memoryStore.delete(key);
  },
  clear: (): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    memoryStore.clear();
  },
};

// ==========================================
// MÉTODOS DE ACESSO E PERSISTÊNCIA
// ==========================================

export class StorageService {
  // ==========================================
  // PERFIS FAMILIARES
  // ==========================================
  static getProfiles(): FamilyProfile[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.PROFILES);
    if (!raw) {
      safeStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(INITIAL_PROFILES));
      return INITIAL_PROFILES;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_PROFILES;
    } catch {
      return INITIAL_PROFILES;
    }
  }

  static getActiveProfileId(): string {
    return safeStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE) || DEMO_PROFILE_ID;
  }

  static setActiveProfileId(profileId: string): void {
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
  }

  static getActiveProfile(): FamilyProfile {
    const profiles = this.getProfiles();
    const activeId = this.getActiveProfileId();
    return profiles.find((p) => p.id === activeId) || profiles[0];
  }

  static getProfile(): FamilyProfile {
    return this.getActiveProfile();
  }

  static saveProfile(profile: FamilyProfile): void {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = { ...profile, updatedAt: new Date().toISOString() };
    } else {
      profiles.push({
        ...profile,
        createdAt: profile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    safeStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  static deleteProfile(profileId: string): { success: boolean; message: string } {
    const profiles = this.getProfiles();
    if (profiles.length <= 1) {
      return { success: false, message: 'Não é possível excluir o único perfil existente no sistema.' };
    }
    const filtered = profiles.filter((p) => p.id !== profileId);
    safeStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(filtered));

    // Se o perfil excluído era o ativo, muda para o primeiro da lista
    if (this.getActiveProfileId() === profileId) {
      this.setActiveProfileId(filtered[0].id);
    }

    // Limpa dados associados a esse perfil
    const allItems = this.getAllStoredItems().filter((i) => i.profileId !== profileId);
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(allItems));

    const allIncome = this.getAllStoredIncome().filter((inc) => inc.profileId !== profileId);
    safeStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(allIncome));

    return { success: true, message: 'Perfil e registros associados excluídos com sucesso.' };
  }

  // ==========================================
  // GRUPOS DE CONSUMO E CATEGORIAS
  // ==========================================
  static getGroups(): ConsumptionGroup[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.GROUPS);
    if (!raw) {
      safeStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(DEFAULT_GROUPS));
      return DEFAULT_GROUPS;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_GROUPS;
    } catch {
      return DEFAULT_GROUPS;
    }
  }

  static saveGroup(group: ConsumptionGroup): void {
    const groups = this.getGroups();
    const idx = groups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      groups[idx] = group;
    } else {
      groups.push(group);
    }
    safeStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  }

  static deleteGroup(groupId: string): { success: boolean; message: string } {
    const groups = this.getGroups();
    const target = groups.find((g) => g.id === groupId);
    if (!target) return { success: false, message: 'Categoria não encontrada.' };

    const allItems = this.getAllStoredItems();
    const usingItems = allItems.filter((i) => i.group === target.name);

    // Se houver itens na categoria, reatribui para 'Outros / Despesas pessoais'
    if (usingItems.length > 0) {
      const reallocated = allItems.map((item) =>
        item.group === target.name ? { ...item, group: 'Despesas pessoais' } : item
      );
      safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(reallocated));
    }

    const filtered = groups.filter((g) => g.id !== groupId);
    safeStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(filtered));
    return {
      success: true,
      message: usingItems.length > 0
        ? `Categoria excluída. ${usingItems.length} itens foram transferidos para "Despesas pessoais".`
        : 'Categoria excluída com sucesso.',
    };
  }

  // ==========================================
  // ITENS DA CESTA FAMILIAR
  // ==========================================
  static getAllStoredItems(): BasketItem[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.BASKET_ITEMS);
    if (!raw) return DEMO_BASKET_ITEMS;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : DEMO_BASKET_ITEMS;
    } catch {
      return DEMO_BASKET_ITEMS;
    }
  }

  static getItems(profileId?: string, includeArchived = false): BasketItem[] {
    const targetProfileId = profileId || this.getActiveProfileId();
    const allItems = this.getAllStoredItems();
    return allItems.filter((item) => {
      const matchesProfile = item.profileId === targetProfileId;
      if (!matchesProfile) return false;
      return includeArchived ? true : !item.isArchived;
    });
  }

  static saveItem(item: Omit<BasketItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): BasketItem {
    const raw = safeStorage.getItem(STORAGE_KEYS.BASKET_ITEMS);
    let allItems: BasketItem[] = raw ? JSON.parse(raw) : DEMO_BASKET_ITEMS;
    const now = new Date().toISOString();

    let savedItem: BasketItem;
    if (item.id) {
      const idx = allItems.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        savedItem = {
          ...allItems[idx],
          ...item,
          id: item.id,
          updatedAt: now,
        };
        allItems[idx] = savedItem;
      } else {
        savedItem = {
          ...item,
          id: item.id,
          createdAt: now,
          updatedAt: now,
        };
        allItems.push(savedItem);
      }
    } else {
      savedItem = {
        ...item,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        createdAt: now,
        updatedAt: now,
      };
      allItems.push(savedItem);
    }

    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(allItems));

    // Grava também no histórico de preços para rastreabilidade
    if (savedItem.currentPrice > 0) {
      this.recordPrice({
        itemId: savedItem.id,
        price: savedItem.currentPrice,
        referenceDate: savedItem.currentPriceDate || now.substring(0, 10),
        unit: savedItem.unit,
        source: savedItem.notes || 'Atualização da Cesta',
      });
    }

    return savedItem;
  }

  static archiveItem(itemId: string): void {
    const allItems = this.getAllStoredItems();
    const updated = allItems.map((i) => (i.id === itemId ? { ...i, isArchived: true, active: false } : i));
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(updated));
  }

  static restoreItem(itemId: string): void {
    const allItems = this.getAllStoredItems();
    const updated = allItems.map((i) => (i.id === itemId ? { ...i, isArchived: false, active: true } : i));
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(updated));
  }

  static deleteItem(itemId: string, permanent = false): void {
    const allItems = this.getAllStoredItems();
    if (permanent) {
      const filtered = allItems.filter((i) => i.id !== itemId);
      safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(filtered));

      // Limpa histórico associado
      const rawPrices = safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY);
      if (rawPrices) {
        const prices: PriceRecord[] = JSON.parse(rawPrices);
        safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(prices.filter((p) => p.itemId !== itemId)));
      }
    } else {
      // Padrão seguro: arquivar mantendo histórico auditável
      this.archiveItem(itemId);
    }
  }

  // ==========================================
  // HISTÓRICO DE PREÇOS
  // ==========================================
  static getPriceHistory(itemId?: string): PriceRecord[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY);
    let prices: PriceRecord[] = [];
    if (raw) {
      try {
        prices = JSON.parse(raw);
      } catch {
        prices = [];
      }
    }
    if (itemId) {
      return prices.filter((p) => p.itemId === itemId).sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
    }
    return prices;
  }

  static getAllPrices(): PriceRecord[] {
    return this.getPriceHistory();
  }

  static recordPrice(priceData: Omit<PriceRecord, 'id' | 'createdAt'>): PriceRecord {
    const raw = safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY);
    const prices: PriceRecord[] = raw ? JSON.parse(raw) : [];
    const newRecord: PriceRecord = {
      ...priceData,
      id: `price-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    prices.push(newRecord);
    safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(prices));
    return newRecord;
  }

  static addPriceRecord(record: {
    itemId: string;
    price: number;
    referenceDate: string;
    unit?: string;
    origin?: string;
  }): PriceRecord {
    return this.recordPrice({
      itemId: record.itemId,
      price: record.price,
      referenceDate: record.referenceDate,
      unit: record.unit,
      source: record.origin,
    });
  }

  static updatePriceRecord(id: string, updated: Partial<PriceRecord>): PriceRecord | null {
    const raw = safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY);
    if (!raw) return null;
    const prices: PriceRecord[] = JSON.parse(raw);
    const idx = prices.findIndex((p) => p.id === id);
    if (idx < 0) return null;

    prices[idx] = { ...prices[idx], ...updated };
    safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(prices));

    // Se o preço alterado for o mais recente do item, atualiza também a cesta
    const itemId = prices[idx].itemId;
    const itemPrices = prices.filter((p) => p.itemId === itemId).sort((a, b) => b.referenceDate.localeCompare(a.referenceDate));
    if (itemPrices[0]?.id === id && updated.price !== undefined) {
      const allItems = this.getAllStoredItems();
      const itemIdx = allItems.findIndex((i) => i.id === itemId);
      if (itemIdx >= 0) {
        allItems[itemIdx].currentPrice = updated.price;
        if (updated.referenceDate) allItems[itemIdx].currentPriceDate = updated.referenceDate;
        safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(allItems));
      }
    }

    return prices[idx];
  }

  static deletePriceRecord(id: string): void {
    const raw = safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY);
    if (!raw) return;
    const prices: PriceRecord[] = JSON.parse(raw);
    const filtered = prices.filter((p) => p.id !== id);
    safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(filtered));
  }

  // ==========================================
  // HISTÓRICO DE RENDA FAMILIAR
  // ==========================================
  static getAllStoredIncome(): IncomeRecord[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.INCOME_HISTORY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static getIncomeHistory(profileId?: string): IncomeRecord[] {
    const targetId = profileId || this.getActiveProfileId();
    const raw = safeStorage.getItem(STORAGE_KEYS.INCOME_HISTORY);

    // Se for o perfil de demonstração e a chave de renda ainda não existir, inicializa com o modelo
    if (!raw && targetId === DEMO_PROFILE_ID) {
      const initial: IncomeRecord[] = [
        { id: 'inc-1', profileId: DEMO_PROFILE_ID, referenceDate: '2023-03-01', nominalIncome: 10000, source: 'Salário CLT', notes: 'Salário base março/2023' },
        { id: 'inc-2', profileId: DEMO_PROFILE_ID, referenceDate: '2024-03-01', nominalIncome: 10500, source: 'Salário CLT', notes: 'Ajuste de dissídio coletivo (+5%)' },
      ];
      safeStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(initial));
      return initial;
    }

    const allIncome = this.getAllStoredIncome();
    return allIncome
      .filter((i) => i.profileId === targetId)
      .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
  }

  static addIncomeRecord(record: Omit<IncomeRecord, 'id'>): IncomeRecord {
    const all = this.getAllStoredIncome();
    const newRecord: IncomeRecord = {
      ...record,
      id: `inc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    all.push(newRecord);
    safeStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(all));
    return newRecord;
  }

  static updateIncomeRecord(id: string, updated: Partial<IncomeRecord>): void {
    const all = this.getAllStoredIncome();
    const idx = all.findIndex((i) => i.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updated };
      safeStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(all));
    }
  }

  static deleteIncomeRecord(id: string): void {
    const all = this.getAllStoredIncome();
    const filtered = all.filter((i) => i.id !== id);
    safeStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(filtered));
  }

  static saveIncome(initialOrRecord: number | Omit<IncomeRecord, 'id'>, maybeFinal?: number): IncomeRecord | void {
    if (typeof initialOrRecord === 'number') {
      const initial = initialOrRecord;
      const final = maybeFinal || initial;
      const profileId = this.getActiveProfileId();
      const existing = this.getAllStoredIncome().filter((i) => i.profileId !== profileId);
      const records: IncomeRecord[] = [
        ...existing,
        { id: `inc-1-${Date.now()}`, profileId, referenceDate: '2023-03-01', nominalIncome: initial, notes: 'Salário base inicial' },
        { id: `inc-2-${Date.now()}`, profileId, referenceDate: '2024-03-01', nominalIncome: final, notes: 'Salário após reajustes' },
      ];
      safeStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(records));
      return;
    }
    return this.addIncomeRecord(initialOrRecord);
  }

  // ==========================================
  // ESTRATÉGIAS DE ECONOMIA (PLANOS A, B E C)
  // ==========================================
  static getPlansA(profileId?: string): SubstitutePlanA[] {
    const targetId = profileId || this.getActiveProfileId();
    const raw = safeStorage.getItem(STORAGE_KEYS.PLANS_A);
    if (!raw) {
      if (targetId === DEMO_PROFILE_ID) {
        safeStorage.setItem(STORAGE_KEYS.PLANS_A, JSON.stringify(DEMO_PLANS_A));
        return DEMO_PLANS_A;
      }
      return [];
    }
    try {
      const parsed: SubstitutePlanA[] = JSON.parse(raw);
      const scoped = parsed.filter((p) => p.profileId === targetId);
      if (scoped.length === 0 && targetId === DEMO_PROFILE_ID) {
        return DEMO_PLANS_A;
      }
      return scoped;
    } catch {
      return targetId === DEMO_PROFILE_ID ? DEMO_PLANS_A : [];
    }
  }

  static savePlanA(plan: SubstitutePlanA): void {
    const raw = safeStorage.getItem(STORAGE_KEYS.PLANS_A);
    const plans: SubstitutePlanA[] = raw ? JSON.parse(raw) : DEMO_PLANS_A;
    const idx = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan;
    else plans.push(plan);
    safeStorage.setItem(STORAGE_KEYS.PLANS_A, JSON.stringify(plans));
  }

  static deletePlanA(planId: string): void {
    const raw = safeStorage.getItem(STORAGE_KEYS.PLANS_A);
    if (!raw) return;
    const plans: SubstitutePlanA[] = JSON.parse(raw);
    const filtered = plans.filter((p) => p.id !== planId);
    safeStorage.setItem(STORAGE_KEYS.PLANS_A, JSON.stringify(filtered));
  }

  static getPlansB(profileId?: string): EfficiencyPlanB[] {
    const targetId = profileId || this.getActiveProfileId();
    const raw = safeStorage.getItem(STORAGE_KEYS.PLANS_B);
    if (!raw) {
      if (targetId === DEMO_PROFILE_ID) {
        safeStorage.setItem(STORAGE_KEYS.PLANS_B, JSON.stringify(DEMO_PLANS_B));
        return DEMO_PLANS_B;
      }
      return [];
    }
    try {
      const parsed: EfficiencyPlanB[] = JSON.parse(raw);
      const scoped = parsed.filter((p) => p.profileId === targetId);
      if (scoped.length === 0 && targetId === DEMO_PROFILE_ID) {
        return DEMO_PLANS_B;
      }
      return scoped;
    } catch {
      return targetId === DEMO_PROFILE_ID ? DEMO_PLANS_B : [];
    }
  }

  static savePlanB(plan: EfficiencyPlanB): void {
    const raw = safeStorage.getItem(STORAGE_KEYS.PLANS_B);
    const plans: EfficiencyPlanB[] = raw ? JSON.parse(raw) : DEMO_PLANS_B;
    const idx = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan;
    else plans.push(plan);
    safeStorage.setItem(STORAGE_KEYS.PLANS_B, JSON.stringify(plans));
  }

  static deletePlanB(planId: string): void {
    const raw = safeStorage.getItem(STORAGE_KEYS.PLANS_B);
    if (!raw) return;
    const plans: EfficiencyPlanB[] = JSON.parse(raw);
    const filtered = plans.filter((p) => p.id !== planId);
    safeStorage.setItem(STORAGE_KEYS.PLANS_B, JSON.stringify(filtered));
  }

  static getPlanC(profileId?: string): OpportunityPlanC {
    const targetId = profileId || this.getActiveProfileId();
    const raw = safeStorage.getItem(STORAGE_KEYS.PLANS_C);
    if (!raw) {
      const plan = { ...DEMO_PLAN_C, profileId: targetId };
      return plan;
    }
    try {
      const parsed = JSON.parse(raw);
      return { ...parsed, profileId: targetId };
    } catch {
      return { ...DEMO_PLAN_C, profileId: targetId };
    }
  }

  static savePlanC(plan: OpportunityPlanC): void {
    safeStorage.setItem(STORAGE_KEYS.PLANS_C, JSON.stringify(plan));
  }

  // ==========================================
  // RESET, LIMPEZA E CENÁRIOS
  // ==========================================
  static resetToDemoData(): void {
    safeStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(INITIAL_PROFILES));
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, DEMO_PROFILE_ID);
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(DEMO_BASKET_ITEMS));
    safeStorage.setItem(STORAGE_KEYS.PLANS_A, JSON.stringify(DEMO_PLANS_A));
    safeStorage.setItem(STORAGE_KEYS.PLANS_B, JSON.stringify(DEMO_PLANS_B));
    safeStorage.setItem(STORAGE_KEYS.PLANS_C, JSON.stringify(DEMO_PLAN_C));
    safeStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(DEFAULT_GROUPS));
  }

  static clearToEmptyBasket(): void {
    this.setActiveProfileId(EMPTY_PROFILE_ID);
    const existing = this.getAllStoredItems().filter((i) => i.profileId !== EMPTY_PROFILE_ID);
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(existing));
  }

  static loadDemoBasket(): void {
    this.resetToDemoData();
  }

  static importItems(imported: BasketItem[]): void {
    const activeId = this.getActiveProfileId();
    const existing = this.getAllStoredItems().filter((i) => i.profileId !== activeId);
    const stamped = imported.map((it) => ({
      ...it,
      profileId: activeId,
      id: it.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    }));
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify([...existing, ...stamped]));
  }

  // ==========================================
  // BACKUP GERAL & RESTAURAÇÃO
  // ==========================================
  static exportFullBackup() {
    return {
      version: '2.4.0',
      exportedAt: new Date().toISOString(),
      activeProfileId: this.getActiveProfileId(),
      profiles: this.getProfiles(),
      groups: this.getGroups(),
      items: this.getAllStoredItems(),
      prices: this.getAllPrices(),
      income: this.getAllStoredIncome(),
      plansA: this.getPlansA(),
      plansB: this.getPlansB(),
      planC: this.getPlanC(),
    };
  }

  static restoreFullBackup(data: any, mode: 'merge' | 'replace'): { success: boolean; message: string } {
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Arquivo de backup inválido ou ilegível.' };
    }

    if (mode === 'replace') {
      if (Array.isArray(data.profiles)) safeStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(data.profiles));
      if (data.activeProfileId) safeStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, data.activeProfileId);
      if (Array.isArray(data.groups)) safeStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(data.groups));
      if (Array.isArray(data.items)) safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(data.items));
      if (Array.isArray(data.prices)) safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(data.prices));
      if (Array.isArray(data.income)) safeStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(data.income));
      if (Array.isArray(data.plansA)) safeStorage.setItem(STORAGE_KEYS.PLANS_A, JSON.stringify(data.plansA));
      if (Array.isArray(data.plansB)) safeStorage.setItem(STORAGE_KEYS.PLANS_B, JSON.stringify(data.plansB));
      if (data.planC) safeStorage.setItem(STORAGE_KEYS.PLANS_C, JSON.stringify(data.planC));
    } else {
      // Merge
      if (Array.isArray(data.items)) {
        this.importItems(data.items);
      }
      if (Array.isArray(data.prices)) {
        const currentPrices = this.getAllPrices();
        const combined = [...currentPrices, ...data.prices.filter((p: any) => !currentPrices.some((cp) => cp.id === p.id))];
        safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(combined));
      }
      if (Array.isArray(data.groups)) {
        const currentGroups = this.getGroups();
        const combined = [...currentGroups, ...data.groups.filter((g: any) => !currentGroups.some((cg) => cg.id === g.id || cg.name === g.name))];
        safeStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(combined));
      }
    }

    return { success: true, message: 'Backup restaurado com sucesso!' };
  }



  /**
   * Gera o DDL SQL com a modelagem relacional para MySQL
   */
  static getMySQLSchemaDDL(): string {
    return `-- ===================================================
-- IPCA-Casa: Esquema Relacional de Dados para MySQL
-- Modelagem de Entidades e Integridade Referencial
-- ===================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    auth_provider ENUM('local', 'google') NOT NULL DEFAULT 'local',
    google_sub VARCHAR(128) NULL UNIQUE,
    avatar_url TEXT NULL,
    password_hash VARCHAR(255) NULL,
    profile_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    members_count INT UNSIGNED NOT NULL DEFAULT 1,
    reference_region VARCHAR(128) NOT NULL DEFAULT 'Brasil',
    currency VARCHAR(8) NOT NULL DEFAULT 'BRL',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_profiles_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consumption_groups (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(16) NOT NULL,
    icon VARCHAR(64) NOT NULL,
    national_weight_ibge DECIMAL(5,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS basket_items (
    id VARCHAR(64) PRIMARY KEY,
    profile_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_name VARCHAR(128) NOT NULL,
    classification ENUM('Essencial', 'Supérfluo', 'Não classificado') NOT NULL DEFAULT 'Não classificado',
    monthly_spend DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    old_price DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    current_price DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    old_price_date DATE NOT NULL,
    current_price_date DATE NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'unidade',
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_basket_profile FOREIGN KEY (profile_id) REFERENCES family_profiles(id) ON DELETE CASCADE,
    INDEX idx_basket_profile_group (profile_id, group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS price_history (
    id VARCHAR(64) PRIMARY KEY,
    item_id VARCHAR(64) NOT NULL,
    price DECIMAL(12,4) NOT NULL,
    reference_date DATE NOT NULL,
    unit VARCHAR(32),
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_price_item FOREIGN KEY (item_id) REFERENCES basket_items(id) ON DELETE CASCADE,
    INDEX idx_price_item_date (item_id, reference_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS income_history (
    id VARCHAR(64) PRIMARY KEY,
    profile_id VARCHAR(64) NOT NULL,
    reference_date DATE NOT NULL,
    nominal_income DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_income_profile FOREIGN KEY (profile_id) REFERENCES family_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saving_strategies (
    id VARCHAR(64) PRIMARY KEY,
    profile_id VARCHAR(64) NOT NULL,
    plan_type ENUM('PLAN_A', 'PLAN_B', 'PLAN_C') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_monthly_savings DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    applied BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_strategy_profile FOREIGN KEY (profile_id) REFERENCES family_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;
  }
}
