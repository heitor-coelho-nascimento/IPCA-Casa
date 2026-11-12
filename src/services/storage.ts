/**
 * IPCA-Casa: Camada de Persistência e Repositório Local
 * Suporte a múltiplos perfis familiares, isolamento por usuário, histórico de preços
 * e integridade referencial dos registros.
 */

import {
  BasketItem,
  ConsumptionGroup,
  EfficiencyPlanB,
  FamilyProfile,
  IncomeRecord,
  MonthlyClosure,
  OpportunityPlanC,
  PriceRecord,
  SubstitutePlanA,
} from '../types';
import { extractIsoDatePrefix, getMonthsAgoIsoDate, getTodayIsoDate } from '../utils/dates';
import { buildDuplicateSignature } from '../utils/csvImport';

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
  MONTHLY_CLOSURES: 'ipca_casa_monthly_closures_v1',
  DEMO_SEEDED_ITEMS: 'ipca_casa_demo_seeded_items_v1',
  DEMO_SEEDED_INCOME: 'ipca_casa_demo_seeded_income_v1',
  DEMO_SEEDED_PLANS_A: 'ipca_casa_demo_seeded_plans_a_v1',
  DEMO_SEEDED_PLANS_B: 'ipca_casa_demo_seeded_plans_b_v1',
  DEMO_SEEDED_CLOSURES: 'ipca_casa_demo_seeded_closures_v1',
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
    profileMode: 'pessoal',
    priceAlertThresholdPercent: 10,
    membersCount: 4,
    referenceRegion: 'Brasil',
    currency: 'BRL',
    isDemo: true,
    createdAt: '2025-11-01T00:00:00.000Z',
    updatedAt: '2026-11-12T12:00:00.000Z',
  },
  {
    id: USER_DEFAULT_PROFILE_ID,
    name: 'Meu Orçamento Familiar',
    profileMode: 'pessoal',
    priceAlertThresholdPercent: 10,
    membersCount: 2,
    referenceRegion: 'Brasil',
    currency: 'BRL',
    isDemo: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-12T12:00:00.000Z',
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
    description: 'Imóvel residencial 3 dormitórios (cota de rateio considerada no exemplo)',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 1537.90,
    oldPrice: 3100.00,
    currentPrice: 3385.20,
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mensalidade',
    dataOrigin: 'demonstrativo',
    notes: 'Reajuste anual pelo IGP-M/IPCA negociado; gasto mensal reflete cota parcial familiar (rateio).',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mensalidade',
    dataOrigin: 'demonstrativo',
    notes: 'Reajuste regulado pela ANS + faixa etária',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
  },
  {
    id: 'item-03',
    profileId: DEMO_PROFILE_ID,
    name: 'Gasolina Comum',
    description: 'Consumo aproximado: 116 litros / mês (116 × R$ 5,85)',
    group: 'Transportes',
    classification: 'Essencial',
    monthlySpend: 678.60,
    oldPrice: 5.20,
    currentPrice: 5.85,
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'litro',
    quantity: 116,
    baseQuantity: 116,
    consumptionFrequency: 'mensal',
    dataOrigin: 'demonstrativo',
    notes: 'Posto habitual da Av. Jabaquara (dado demonstrativo fictício)',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
  },
  {
    id: 'item-04',
    profileId: DEMO_PROFILE_ID,
    name: 'Mensalidade Escolar Infantil',
    description: 'Colégio Fundamental I (cota parcial considerada no orçamento do exemplo)',
    group: 'Educação',
    classification: 'Essencial',
    monthlySpend: 718.25,
    oldPrice: 1550.00,
    currentPrice: 1644.55,
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mensalidade',
    dataOrigin: 'demonstrativo',
    notes: 'Valor unitário referente a 2 filhos; gasto mensal reflete cota parcial neste perfil demonstrativo.',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
  },
  {
    id: 'item-05',
    profileId: DEMO_PROFILE_ID,
    name: 'Energia Elétrica Residencial',
    description: 'Média mensal 460 kWh × R$ 0,89/kWh • Enel SP',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 409.40,
    oldPrice: 0.78,
    currentPrice: 0.89,
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'kWh',
    quantity: 460,
    baseQuantity: 460,
    consumptionFrequency: 'mensal',
    dataOrigin: 'demonstrativo',
    notes: 'Incidência de bandeira amarela nos últimos ciclos (dado demonstrativo)',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
  },
  {
    id: 'item-06',
    profileId: DEMO_PROFILE_ID,
    name: 'Carnes Bovinas (Média da Cesta)',
    description: 'Cortes para consumo semanal (~10,2 kg/mês)',
    group: 'Alimentação e bebidas',
    classification: 'Essencial',
    monthlySpend: 490.10,
    oldPrice: 42.00,
    currentPrice: 47.96,
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'kg',
    dataOrigin: 'demonstrativo',
    notes: 'Acém, patinho e coxão mole',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
  },
  {
    id: 'item-07',
    profileId: DEMO_PROFILE_ID,
    name: 'Taxa Condominial Ordinária',
    description: 'Condomínio Residencial Edifício Flamboyant (cota de rateio no exemplo)',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 456.30,
    oldPrice: 780.00,
    currentPrice: 826.80,
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mensalidade',
    dataOrigin: 'demonstrativo',
    notes: 'Dissídio coletivo dos porteiros e zelador; gasto mensal reflete rateio no exemplo.',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
  },
  {
    id: 'item-08',
    profileId: DEMO_PROFILE_ID,
    name: 'Azeite de Oliva Extra Virgem 500ml',
    description: 'Vidro 500ml • Consumo: 1 unidade/mês',
    group: 'Alimentação e bebidas',
    classification: 'Supérfluo',
    monthlySpend: 46.90,
    oldPrice: 29.90,
    currentPrice: 46.90,
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'unidade',
    quantity: 1,
    baseQuantity: 1,
    consumptionFrequency: 'mensal',
    dataOrigin: 'demonstrativo',
    notes: 'Choque de safra e seca na bacia do Mediterrâneo',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'unidade',
    quantity: 2,
    baseQuantity: 2,
    consumptionFrequency: 'mensal',
    dataOrigin: 'demonstrativo',
    notes: 'Alta mundial da saca do grão conilon e arábica',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'unidade',
    quantity: 2,
    baseQuantity: 2,
    consumptionFrequency: 'mensal',
    dataOrigin: 'demonstrativo',
    notes: 'Pressão climática e exportações',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'litro',
    quantity: 12,
    baseQuantity: 12,
    consumptionFrequency: 'mensal',
    dataOrigin: 'demonstrativo',
    notes: 'Queda de safra e importação do Mercosul (deflação alívio)',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mensalidade',
    dataOrigin: 'demonstrativo',
    notes: 'Reajuste anual contratual',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
  },
  {
    id: 'item-13',
    profileId: DEMO_PROFILE_ID,
    name: 'Água e Esgoto Residencial',
    description: 'Sabesp SP • Consumo médio 18 m³/mês × R$ 9,16/m³',
    group: 'Habitação',
    classification: 'Essencial',
    monthlySpend: 164.88,
    oldPrice: 8.33,
    currentPrice: 9.16,
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'm³',
    quantity: 18,
    baseQuantity: 18,
    consumptionFrequency: 'mensal',
    dataOrigin: 'demonstrativo',
    notes: 'Tarifa demonstrativa por m³ (18 m³ × R$ 9,16 = R$ 164,88)',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'm³',
    dataOrigin: 'demonstrativo',
    notes: 'Fatura mensal de consumo de gás',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'cesta',
    dataOrigin: 'demonstrativo',
    notes: 'Feira livre e supermercado quinzenal',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mês',
    dataOrigin: 'demonstrativo',
    notes: 'Reajuste anual de medicamentos CMED',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mensalidade',
    dataOrigin: 'demonstrativo',
    notes: 'Ajuste de assinaturas de entretenimento',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mês',
    dataOrigin: 'demonstrativo',
    notes: 'Restaurantes e deliverys',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mensalidade',
    dataOrigin: 'demonstrativo',
    notes: 'Renovação apólice anual',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    oldPriceDate: '2025-11-01',
    currentPriceDate: '2026-11-01',
    unit: 'mês',
    dataOrigin: 'demonstrativo',
    notes: 'Compras sazonais',
    active: true,
    createdAt: '2025-11-01',
    updatedAt: '2026-11-01',
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
    resourceCategory: 'agua',
    unit: 'm³',
    tariffPerUnit: 9.16,
    currentConsumption: 18,
    targetConsumption: 15,
    currentSpend: 164.88,
    estimatedMonthlySavings: 27.48,
    progressPercent: 62,
    applied: true,
    notes: 'Arejadores de torneira instalados e revisão de estanqueidade nas caixas acopladas ((18 - 15) × R$ 9,16 = R$ 27,48/mês).',
  },
  {
    id: 'eff-03',
    profileId: DEMO_PROFILE_ID,
    resourceName: 'Transporte Urbano (Gasolina)',
    resourceCategory: 'combustivel',
    unit: 'Litros',
    tariffPerUnit: 5.85,
    currentConsumption: 116,
    targetConsumption: 96,
    currentSpend: 678.60,
    estimatedMonthlySavings: 117.00,
    progressPercent: 80,
    applied: true,
    notes: 'Rodízio solidário de carona escolar e adoção de metrô 2x por semana em trajetos ao centro ((116 - 96) × R$ 5,85 = R$ 117,00/mês).',
  },
];

export const DEMO_PLAN_C: OpportunityPlanC = {
  id: 'opp-01',
  profileId: DEMO_PROFILE_ID,
  monthlyInvestment: 420.00,
  nominalAnnualRate: 10.50,
  expectedAnnualInflation: 4.00,
  realAnnualYield: 6.25,
  projection12Months: 5278.19,
  projection24Months: 11110.58,
  projection36Months: 17555.38,
  isSimulated: true,
};

export const DEMO_MONTHLY_CLOSURES: MonthlyClosure[] = [
  {
    id: 'cls_demo_2026_09',
    profileId: DEMO_PROFILE_ID,
    monthKey: '2026-09',
    monthLabel: 'Set/26',
    profileMode: 'pessoal',
    totalMonthlySpend: 7698.40,
    comparableBaseCost: 7120.00,
    ipcaCasaPercent: 8.12,
    ipcaOficialPercent: 3.99,
    spreadPP: 4.13,
    itemsCount: 20,
    eligibleItemsCount: 20,
    monthlyIncome: 10500,
    monthlyBalance: 2801.60,
    topCategory: 'Habitação',
    topDriverName: 'Azeite de Oliva Extra Virgem 500ml',
    topDriverChangePercent: 52.84,
    priceEffectReais: 578.40,
    quantityEffectReais: 0,
    mixEffectReais: 0,
    ibgeSourceMode: 'contingency',
    ibgeReferenceMonth: 'Set/26',
    dataOrigin: 'demonstrativo',
    notes: 'Fechamento demonstrativo ilustrativo — não representa histórico real auditado.',
    closedAt: '2026-09-30',
  },
  {
    id: 'cls_demo_2026_10',
    profileId: DEMO_PROFILE_ID,
    monthKey: '2026-10',
    monthLabel: 'Out/26',
    profileMode: 'pessoal',
    totalMonthlySpend: 7937.18,
    comparableBaseCost: 7310.20,
    ipcaCasaPercent: 8.58,
    ipcaOficialPercent: 4.34,
    spreadPP: 4.24,
    itemsCount: 20,
    eligibleItemsCount: 20,
    monthlyIncome: 10500,
    monthlyBalance: 2562.82,
    topCategory: 'Habitação',
    topDriverName: 'Azeite de Oliva Extra Virgem 500ml',
    topDriverChangePercent: 56.86,
    priceEffectReais: 626.98,
    quantityEffectReais: 0,
    mixEffectReais: 0,
    ibgeSourceMode: 'contingency',
    ibgeReferenceMonth: 'Out/26',
    dataOrigin: 'demonstrativo',
    notes: 'Fechamento demonstrativo ilustrativo — não representa histórico real auditado.',
    closedAt: '2026-10-31',
  },
];

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
      try {
        const keysToRemove: string[] = [];
        const knownKeys = new Set(Object.values(STORAGE_KEYS));
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (k.startsWith('ipca_casa_') || k.startsWith('ipcacasa_') || knownKeys.has(k as any))) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          window.localStorage.removeItem(k);
        }
      } catch {
        // ignora falhas de acesso a storage
      }
    }
    memoryStore.clear();
  },
};

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeParseObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

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
      return INITIAL_PROFILES.map((p) => ({ ...p }));
    }
    const parsed = safeParseArray<FamilyProfile>(raw);
    return parsed.length > 0 ? parsed : INITIAL_PROFILES.map((p) => ({ ...p }));
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
    if (!profiles.some((p) => p.id === profileId)) {
      return { success: false, message: 'Perfil não encontrado.' };
    }

    const filtered = profiles.filter((p) => p.id !== profileId);
    safeStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(filtered));

    if (this.getActiveProfileId() === profileId) {
      this.setActiveProfileId(filtered[0].id);
    }

    // Coleta TODOS os itens (inclusive arquivados) do perfil para limpeza em cascata de preços
    const allItems = this.getAllStoredItems();
    const deletedItemIds = new Set(
      allItems.filter((i) => i.profileId === profileId).map((i) => i.id)
    );
    const remainingItems = allItems.filter((i) => i.profileId !== profileId);
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(remainingItems));

    if (deletedItemIds.size > 0) {
      const remainingPrices = this.getAllPrices().filter((p) => !deletedItemIds.has(p.itemId));
      safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(remainingPrices));
    }

    const allIncome = this.getAllStoredIncome().filter((inc) => inc.profileId !== profileId);
    safeStorage.setItem(STORAGE_KEYS.INCOME_HISTORY, JSON.stringify(allIncome));

    const allPlansA = safeParseArray<SubstitutePlanA>(
      safeStorage.getItem(STORAGE_KEYS.PLANS_A)
    ).filter((p) => p.profileId !== profileId);
    safeStorage.setItem(STORAGE_KEYS.PLANS_A, JSON.stringify(allPlansA));

    const allPlansB = safeParseArray<EfficiencyPlanB>(
      safeStorage.getItem(STORAGE_KEYS.PLANS_B)
    ).filter((p) => p.profileId !== profileId);
    safeStorage.setItem(STORAGE_KEYS.PLANS_B, JSON.stringify(allPlansB));

    this.deletePlanC(profileId);

    const allClosures = safeParseArray<MonthlyClosure>(
      safeStorage.getItem(STORAGE_KEYS.MONTHLY_CLOSURES)
    ).filter((c) => c.profileId !== profileId);
    safeStorage.setItem(STORAGE_KEYS.MONTHLY_CLOSURES, JSON.stringify(allClosures));

    return { success: true, message: 'Perfil e registros associados excluídos com sucesso.' };
  }

  // ==========================================
  // GRUPOS DE CONSUMO E CATEGORIAS
  // ==========================================
  static getGroups(): ConsumptionGroup[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.GROUPS);
    if (!raw) {
      safeStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(DEFAULT_GROUPS));
      return DEFAULT_GROUPS.map((g) => ({ ...g }));
    }
    const parsed = safeParseArray<ConsumptionGroup>(raw);
    return parsed.length > 0 ? parsed : DEFAULT_GROUPS.map((g) => ({ ...g }));
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
      message:
        usingItems.length > 0
          ? `Categoria excluída. ${usingItems.length} itens foram transferidos para "Despesas pessoais".`
          : 'Categoria excluída com sucesso.',
    };
  }

  // ==========================================
  // ITENS DA CESTA FAMILIAR
  // ==========================================
  static getAllStoredItems(): BasketItem[] {
    return safeParseArray<BasketItem>(safeStorage.getItem(STORAGE_KEYS.BASKET_ITEMS));
  }

  static getItems(profileId?: string, includeArchived = false): BasketItem[] {
    const targetProfileId = profileId || this.getActiveProfileId();
    const raw = safeStorage.getItem(STORAGE_KEYS.BASKET_ITEMS);

    if (
      targetProfileId === DEMO_PROFILE_ID &&
      !safeStorage.getItem(STORAGE_KEYS.DEMO_SEEDED_ITEMS)
    ) {
      const existingNonDemo = safeParseArray<BasketItem>(raw).filter(
        (i) => i.profileId !== DEMO_PROFILE_ID
      );
      const seeded = [...existingNonDemo, ...DEMO_BASKET_ITEMS];
      safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(seeded));
      safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_ITEMS, '1');
    }

    const allItems = this.getAllStoredItems();
    return allItems.filter((item) => {
      const matchesProfile = item.profileId === targetProfileId;
      if (!matchesProfile) return false;
      return includeArchived ? true : !item.isArchived;
    });
  }

  static saveItem(
    item: Omit<BasketItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): BasketItem {
    const allItems = this.getAllStoredItems();
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
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      allItems.push(savedItem);
    }

    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(allItems));

    // Grava no histórico apenas se ainda não houver leitura idêntica na mesma data e preço
    if (Number.isFinite(savedItem.currentPrice) && savedItem.currentPrice > 0) {
      const refDate = extractIsoDatePrefix(savedItem.currentPriceDate) || getTodayIsoDate();
      const alreadyRecorded = this.getPriceHistory(savedItem.id).some(
        (p) => p.referenceDate === refDate && Math.abs(p.price - savedItem.currentPrice) < 0.0001
      );
      if (!alreadyRecorded) {
        this.recordPrice({
          itemId: savedItem.id,
          price: savedItem.currentPrice,
          referenceDate: refDate,
          unit: savedItem.unit,
          packageSize: savedItem.packageSize,
          packageUnit: savedItem.packageUnit,
          dataOrigin: savedItem.dataOrigin || 'usuario',
          comparabilityBroken: savedItem.comparabilityBroken,
          source: savedItem.notes || 'Atualização da Cesta',
        });
      }
    }

    return savedItem;
  }

  static archiveItem(itemId: string): void {
    const allItems = this.getAllStoredItems();
    const updated = allItems.map((i) =>
      i.id === itemId ? { ...i, isArchived: true, active: false, updatedAt: new Date().toISOString() } : i
    );
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(updated));
  }

  static restoreItem(itemId: string): void {
    const allItems = this.getAllStoredItems();
    const updated = allItems.map((i) =>
      i.id === itemId ? { ...i, isArchived: false, active: true, updatedAt: new Date().toISOString() } : i
    );
    safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(updated));
  }

  static deleteItem(itemId: string, permanent = false): void {
    const allItems = this.getAllStoredItems();
    if (permanent) {
      const filtered = allItems.filter((i) => i.id !== itemId);
      safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(filtered));

      const prices = safeParseArray<PriceRecord>(
        safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY)
      );
      if (prices.length > 0) {
        safeStorage.setItem(
          STORAGE_KEYS.PRICE_HISTORY,
          JSON.stringify(prices.filter((p) => p.itemId !== itemId))
        );
      }
    } else {
      this.archiveItem(itemId);
    }
  }

  // ==========================================
  // HISTÓRICO DE PREÇOS
  // ==========================================
  static getPriceHistory(itemId?: string): PriceRecord[] {
    const prices = safeParseArray<PriceRecord>(safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY));
    if (itemId) {
      return prices
        .filter((p) => p.itemId === itemId)
        .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
    }
    return prices;
  }

  static getAllPrices(): PriceRecord[] {
    return this.getPriceHistory();
  }

  static recordPrice(priceData: Omit<PriceRecord, 'id' | 'createdAt'>): PriceRecord {
    const prices = safeParseArray<PriceRecord>(safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY));
    const newRecord: PriceRecord = {
      ...priceData,
      id: `price-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    prices.push(newRecord);
    safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(prices));
    return newRecord;
  }

  private static resyncItemPriceFromHistory(itemId: string): void {
    const prices = safeParseArray<PriceRecord>(safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY))
      .filter((p) => p.itemId === itemId && p.comparabilityBroken !== true && Number.isFinite(p.price) && p.price > 0)
      .sort((a, b) => {
        const cmp = b.referenceDate.localeCompare(a.referenceDate);
        if (cmp !== 0) return cmp;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
    if (prices.length === 0) return;

    const latest = prices[0];
    const allItems = this.getAllStoredItems();
    const itemIdx = allItems.findIndex((i) => i.id === itemId);
    if (itemIdx >= 0) {
      allItems[itemIdx].currentPrice = latest.price;
      allItems[itemIdx].currentPriceDate = latest.referenceDate;
      allItems[itemIdx].updatedAt = new Date().toISOString();
      safeStorage.setItem(STORAGE_KEYS.BASKET_ITEMS, JSON.stringify(allItems));
    }
  }

  static addPriceRecord(record: {
    itemId: string;
    price: number;
    referenceDate: string;
    unit?: string;
    origin?: string;
    source?: string;
    region?: string;
    packageSize?: number;
    packageUnit?: string;
    dataOrigin?: PriceRecord['dataOrigin'];
    comparabilityBroken?: boolean;
    notes?: string;
  }): PriceRecord {
    const created = this.recordPrice({
      itemId: record.itemId,
      price: record.price,
      referenceDate: record.referenceDate,
      unit: record.unit,
      source: record.source || record.origin,
      origin: record.origin,
      region: record.region,
      packageSize: record.packageSize,
      packageUnit: record.packageUnit,
      dataOrigin: record.dataOrigin || 'usuario',
      comparabilityBroken: record.comparabilityBroken,
      notes: record.notes,
    });
    this.resyncItemPriceFromHistory(record.itemId);
    return created;
  }

  static updatePriceRecord(id: string, updated: Partial<PriceRecord>): PriceRecord | null {
    const prices = safeParseArray<PriceRecord>(safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY));
    const idx = prices.findIndex((p) => p.id === id);
    if (idx < 0) return null;

    prices[idx] = { ...prices[idx], ...updated, updatedAt: new Date().toISOString() };
    safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(prices));
    this.resyncItemPriceFromHistory(prices[idx].itemId);

    return prices[idx];
  }

  static deletePriceRecord(id: string): void {
    const prices = safeParseArray<PriceRecord>(safeStorage.getItem(STORAGE_KEYS.PRICE_HISTORY));
    if (prices.length === 0) return;
    const target = prices.find((p) => p.id === id);
    const filtered = prices.filter((p) => p.id !== id);
    safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(filtered));
    if (target?.itemId) {
      this.resyncItemPriceFromHistory(target.itemId);
    }
  }

  // ==========================================
  // HISTÓRICO DE RENDA FAMILIAR
  // ==========================================
  static getAllStoredIncome(): IncomeRecord[] {
    return safeParseArray<IncomeRecord>(safeStorage.getItem(STORAGE_KEYS.INCOME_HISTORY));
  }

  static getIncomeHistory(profileId?: string): IncomeRecord[] {
    const targetId = profileId || this.getActiveProfileId();

    if (
      targetId === DEMO_PROFILE_ID &&
      !safeStorage.getItem(STORAGE_KEYS.DEMO_SEEDED_INCOME)
    ) {
      const existingNonDemo = this.getAllStoredIncome().filter(
        (i) => i.profileId !== DEMO_PROFILE_ID
      );
      const demoInitial: IncomeRecord[] = [
        {
          id: 'inc-1',
          profileId: DEMO_PROFILE_ID,
          referenceDate: '2025-11-01',
          nominalIncome: 10000,
          source: 'Salário CLT',
          notes: 'Salário base novembro/2025',
        },
        {
          id: 'inc-2',
          profileId: DEMO_PROFILE_ID,
          referenceDate: '2026-11-01',
          nominalIncome: 10500,
          source: 'Salário CLT',
          notes: 'Ajuste de dissídio coletivo (+5%)',
        },
      ];
      safeStorage.setItem(
        STORAGE_KEYS.INCOME_HISTORY,
        JSON.stringify([...existingNonDemo, ...demoInitial])
      );
      safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_INCOME, '1');
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
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

  static saveIncome(
    initialOrRecord: number | Omit<IncomeRecord, 'id'>,
    maybeFinal?: number,
    options?: {
      profileId?: string;
      initialDate?: string;
      finalDate?: string;
      grossIncome?: number;
      netIncome?: number;
      incomeType?: string;
      debtObligations?: number;
      financialApplications?: number;
      transfers?: number;
      availableReserve?: number;
      workingDaysPerMonth?: number;
    }
  ): IncomeRecord | void {
    if (typeof initialOrRecord === 'number') {
      const initial = Number.isFinite(initialOrRecord) ? Math.max(0, initialOrRecord) : 0;
      const final =
        typeof maybeFinal === 'number' && Number.isFinite(maybeFinal)
          ? Math.max(0, maybeFinal)
          : initial;
      const profileId = options?.profileId || this.getActiveProfileId();
      const initialDate =
        extractIsoDatePrefix(options?.initialDate) || getMonthsAgoIsoDate(12);
      const finalDate =
        extractIsoDatePrefix(options?.finalDate) || getTodayIsoDate();
      const existing = this.getAllStoredIncome().filter((i) => i.profileId !== profileId);
      const stamp = Date.now();
      const records: IncomeRecord[] = [
        ...existing,
        {
          id: `inc-1-${stamp}`,
          profileId,
          referenceDate: initialDate,
          nominalIncome: initial,
          notes: 'Salário base inicial',
        },
        {
          id: `inc-2-${stamp + 1}`,
          profileId,
          referenceDate: finalDate,
          nominalIncome: final,
          notes: 'Salário após reajustes',
          grossIncome: options?.grossIncome,
          netIncome: options?.netIncome,
          incomeType: options?.incomeType,
          debtObligations: options?.debtObligations,
          financialApplications: options?.financialApplications,
          transfers: options?.transfers,
          availableReserve: options?.availableReserve,
          workingDaysPerMonth: options?.workingDaysPerMonth,
        },
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

    if (
      targetId === DEMO_PROFILE_ID &&
      !safeStorage.getItem(STORAGE_KEYS.DEMO_SEEDED_PLANS_A)
    ) {
      const existingNonDemo = safeParseArray<SubstitutePlanA>(raw).filter(
        (p) => p.profileId !== DEMO_PROFILE_ID
      );
      safeStorage.setItem(
        STORAGE_KEYS.PLANS_A,
        JSON.stringify([...existingNonDemo, ...DEMO_PLANS_A])
      );
      safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_PLANS_A, '1');
    }

    return safeParseArray<SubstitutePlanA>(safeStorage.getItem(STORAGE_KEYS.PLANS_A)).filter(
      (p) => p.profileId === targetId
    );
  }

  static savePlanA(plan: SubstitutePlanA): void {
    const plans = safeParseArray<SubstitutePlanA>(safeStorage.getItem(STORAGE_KEYS.PLANS_A));
    const idx = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan;
    else plans.push(plan);
    safeStorage.setItem(STORAGE_KEYS.PLANS_A, JSON.stringify(plans));
  }

  static deletePlanA(planId: string): void {
    const plans = safeParseArray<SubstitutePlanA>(safeStorage.getItem(STORAGE_KEYS.PLANS_A));
    if (plans.length === 0) return;
    const filtered = plans.filter((p) => p.id !== planId);
    safeStorage.setItem(STORAGE_KEYS.PLANS_A, JSON.stringify(filtered));
  }

  static getPlansB(profileId?: string): EfficiencyPlanB[] {
    const targetId = profileId || this.getActiveProfileId();
    const raw = safeStorage.getItem(STORAGE_KEYS.PLANS_B);

    if (
      targetId === DEMO_PROFILE_ID &&
      !safeStorage.getItem(STORAGE_KEYS.DEMO_SEEDED_PLANS_B)
    ) {
      const existingNonDemo = safeParseArray<EfficiencyPlanB>(raw).filter(
        (p) => p.profileId !== DEMO_PROFILE_ID
      );
      safeStorage.setItem(
        STORAGE_KEYS.PLANS_B,
        JSON.stringify([...existingNonDemo, ...DEMO_PLANS_B])
      );
      safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_PLANS_B, '1');
    }

    return safeParseArray<EfficiencyPlanB>(safeStorage.getItem(STORAGE_KEYS.PLANS_B)).filter(
      (p) => p.profileId === targetId
    );
  }

  static savePlanB(plan: EfficiencyPlanB): void {
    const plans = safeParseArray<EfficiencyPlanB>(safeStorage.getItem(STORAGE_KEYS.PLANS_B));
    const idx = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan;
    else plans.push(plan);
    safeStorage.setItem(STORAGE_KEYS.PLANS_B, JSON.stringify(plans));
  }

  static deletePlanB(planId: string): void {
    const plans = safeParseArray<EfficiencyPlanB>(safeStorage.getItem(STORAGE_KEYS.PLANS_B));
    if (plans.length === 0) return;
    const filtered = plans.filter((p) => p.id !== planId);
    safeStorage.setItem(STORAGE_KEYS.PLANS_B, JSON.stringify(filtered));
  }

  static getAllPlansC(): Record<string, OpportunityPlanC> {
    const parsed = safeParseObject(safeStorage.getItem(STORAGE_KEYS.PLANS_C));
    if (!parsed) return {};

    // Migra formato legado de objeto único associando estritamente ao seu próprio profileId
    if (
      'profileId' in parsed &&
      typeof parsed.profileId === 'string' &&
      parsed.profileId &&
      'nominalAnnualRate' in parsed
    ) {
      const legacy = parsed as unknown as OpportunityPlanC;
      const pid = legacy.profileId || 'default';
      return { [pid]: { ...legacy, profileId: pid } };
    }

    const result: Record<string, OpportunityPlanC> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (val && typeof val === 'object' && 'nominalAnnualRate' in val) {
        const plan = val as OpportunityPlanC;
        const pid = typeof plan.profileId === 'string' && plan.profileId ? plan.profileId : key;
        result[pid] = { ...plan, profileId: pid };
      }
    }
    return result;
  }

  static getPlanC(profileId?: string): OpportunityPlanC | null {
    const targetId = profileId || this.getActiveProfileId();
    const all = this.getAllPlansC();
    if (all[targetId]) {
      return all[targetId];
    }
    if (targetId === DEMO_PROFILE_ID) {
      return { ...DEMO_PLAN_C, profileId: DEMO_PROFILE_ID, isSimulated: true };
    }
    return null;
  }

  static savePlanC(plan: OpportunityPlanC): OpportunityPlanC {
    const targetId = plan.profileId || this.getActiveProfileId();
    const all = this.getAllPlansC();
    const saved: OpportunityPlanC = {
      ...plan,
      profileId: targetId,
      isSimulated: false,
      updatedAt: new Date().toISOString(),
    };
    all[targetId] = saved;
    safeStorage.setItem(STORAGE_KEYS.PLANS_C, JSON.stringify(all));
    return saved;
  }

  static deletePlanC(profileId: string): void {
    const all = this.getAllPlansC();
    if (profileId in all) {
      delete all[profileId];
      safeStorage.setItem(STORAGE_KEYS.PLANS_C, JSON.stringify(all));
    }
  }

  // ==========================================
  // FECHAMENTOS MENSAIS DE COMPETÊNCIA
  // ==========================================
  static getMonthlyClosures(profileId?: string): MonthlyClosure[] {
    const targetId = profileId || this.getActiveProfileId();
    const raw = safeStorage.getItem(STORAGE_KEYS.MONTHLY_CLOSURES);

    if (
      targetId === DEMO_PROFILE_ID &&
      !safeStorage.getItem(STORAGE_KEYS.DEMO_SEEDED_CLOSURES)
    ) {
      const existingNonDemo = safeParseArray<MonthlyClosure>(raw).filter(
        (c) => c.profileId !== DEMO_PROFILE_ID
      );
      safeStorage.setItem(
        STORAGE_KEYS.MONTHLY_CLOSURES,
        JSON.stringify([...existingNonDemo, ...DEMO_MONTHLY_CLOSURES])
      );
      safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_CLOSURES, '1');
    }

    return safeParseArray<MonthlyClosure>(
      safeStorage.getItem(STORAGE_KEYS.MONTHLY_CLOSURES)
    )
      .filter((c) => c.profileId === targetId)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }

  static saveMonthlyClosure(
    closure: MonthlyClosure,
    allowOverwrite = false
  ): {
    success: boolean;
    requiresOverwriteConfirmation?: boolean;
    closure?: MonthlyClosure;
  } {
    const all = safeParseArray<MonthlyClosure>(
      safeStorage.getItem(STORAGE_KEYS.MONTHLY_CLOSURES)
    );
    const existingIdx = all.findIndex(
      (c) => c.profileId === closure.profileId && c.monthKey === closure.monthKey
    );

    if (existingIdx >= 0 && !allowOverwrite) {
      return {
        success: false,
        requiresOverwriteConfirmation: true,
      };
    }

    const nowIso = new Date().toISOString();
    const normalized: MonthlyClosure = {
      ...closure,
      id:
        existingIdx >= 0
          ? all[existingIdx].id
          : closure.id || `cls_${closure.profileId}_${closure.monthKey}`,
      createdAt: existingIdx >= 0 ? all[existingIdx].createdAt || nowIso : closure.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      all[existingIdx] = normalized;
    } else {
      all.push(normalized);
    }

    safeStorage.setItem(STORAGE_KEYS.MONTHLY_CLOSURES, JSON.stringify(all));
    return { success: true, closure: normalized };
  }

  static deleteMonthlyClosure(closureId: string): void {
    const all = safeParseArray<MonthlyClosure>(
      safeStorage.getItem(STORAGE_KEYS.MONTHLY_CLOSURES)
    );
    const filtered = all.filter((c) => c.id !== closureId);
    safeStorage.setItem(STORAGE_KEYS.MONTHLY_CLOSURES, JSON.stringify(filtered));
  }

  // ==========================================
  // RESET, LIMPEZA E CENÁRIOS
  // ==========================================
  static resetToDemoData(): void {
    const existingProfiles = safeParseArray<FamilyProfile>(
      safeStorage.getItem(STORAGE_KEYS.PROFILES)
    );
    const nonDemoProfiles = existingProfiles.filter(
      (p) => p && p.id !== DEMO_PROFILE_ID && !p.isDemo
    );
    const demoProfile = INITIAL_PROFILES.find((p) => p.id === DEMO_PROFILE_ID)!;
    const defaultRealProfile = INITIAL_PROFILES.find((p) => p.id === USER_DEFAULT_PROFILE_ID)!;
    const nextProfiles =
      nonDemoProfiles.length > 0
        ? [demoProfile, ...nonDemoProfiles]
        : [demoProfile, defaultRealProfile];
    safeStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(nextProfiles));
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, DEMO_PROFILE_ID);

    // Mantém itens reais intactos e redefini apenas os itens de demonstração
    const allItems = this.getAllStoredItems();
    const demoItemIds = new Set(
      allItems.filter((i) => i.profileId === DEMO_PROFILE_ID).map((i) => i.id)
    );
    const nonDemoItems = allItems.filter((i) => i.profileId !== DEMO_PROFILE_ID);
    safeStorage.setItem(
      STORAGE_KEYS.BASKET_ITEMS,
      JSON.stringify([...nonDemoItems, ...DEMO_BASKET_ITEMS])
    );
    safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_ITEMS, '1');

    if (demoItemIds.size > 0) {
      const nonDemoPrices = this.getAllPrices().filter((p) => !demoItemIds.has(p.itemId));
      safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(nonDemoPrices));
    }

    const nonDemoIncome = this.getAllStoredIncome().filter(
      (i) => i.profileId !== DEMO_PROFILE_ID
    );
    const demoIncome: IncomeRecord[] = [
      {
        id: 'inc-1',
        profileId: DEMO_PROFILE_ID,
        referenceDate: '2025-11-01',
        nominalIncome: 10000,
        source: 'Salário CLT',
        notes: 'Salário base novembro/2025',
      },
      {
        id: 'inc-2',
        profileId: DEMO_PROFILE_ID,
        referenceDate: '2026-11-01',
        nominalIncome: 10500,
        source: 'Salário CLT',
        notes: 'Ajuste de dissídio coletivo (+5%)',
      },
    ];
    safeStorage.setItem(
      STORAGE_KEYS.INCOME_HISTORY,
      JSON.stringify([...nonDemoIncome, ...demoIncome])
    );
    safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_INCOME, '1');

    const nonDemoPlansA = safeParseArray<SubstitutePlanA>(
      safeStorage.getItem(STORAGE_KEYS.PLANS_A)
    ).filter((p) => p.profileId !== DEMO_PROFILE_ID);
    safeStorage.setItem(
      STORAGE_KEYS.PLANS_A,
      JSON.stringify([...nonDemoPlansA, ...DEMO_PLANS_A])
    );
    safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_PLANS_A, '1');

    const nonDemoPlansB = safeParseArray<EfficiencyPlanB>(
      safeStorage.getItem(STORAGE_KEYS.PLANS_B)
    ).filter((p) => p.profileId !== DEMO_PROFILE_ID);
    safeStorage.setItem(
      STORAGE_KEYS.PLANS_B,
      JSON.stringify([...nonDemoPlansB, ...DEMO_PLANS_B])
    );
    safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_PLANS_B, '1');

    const allPlansC = this.getAllPlansC();
    allPlansC[DEMO_PROFILE_ID] = { ...DEMO_PLAN_C, isSimulated: true };
    safeStorage.setItem(STORAGE_KEYS.PLANS_C, JSON.stringify(allPlansC));

    const nonDemoClosures = safeParseArray<MonthlyClosure>(
      safeStorage.getItem(STORAGE_KEYS.MONTHLY_CLOSURES)
    ).filter((c) => c.profileId !== DEMO_PROFILE_ID);
    safeStorage.setItem(
      STORAGE_KEYS.MONTHLY_CLOSURES,
      JSON.stringify([...nonDemoClosures, ...DEMO_MONTHLY_CLOSURES])
    );
    safeStorage.setItem(STORAGE_KEYS.DEMO_SEEDED_CLOSURES, '1');

    const existingGroups = safeParseArray<ConsumptionGroup>(
      safeStorage.getItem(STORAGE_KEYS.GROUPS)
    );
    const customGroups = existingGroups.filter(
      (g) => g.isCustom && !DEFAULT_GROUPS.some((d) => d.id === g.id)
    );
    safeStorage.setItem(
      STORAGE_KEYS.GROUPS,
      JSON.stringify([...DEFAULT_GROUPS, ...customGroups])
    );
  }

  static clearToEmptyBasket(): void {
    this.setActiveProfileId(EMPTY_PROFILE_ID);
    const allItems = this.getAllStoredItems();
    const emptyItemIds = new Set(
      allItems.filter((i) => i.profileId === EMPTY_PROFILE_ID).map((i) => i.id)
    );
    safeStorage.setItem(
      STORAGE_KEYS.BASKET_ITEMS,
      JSON.stringify(allItems.filter((i) => i.profileId !== EMPTY_PROFILE_ID))
    );
    if (emptyItemIds.size > 0) {
      safeStorage.setItem(
        STORAGE_KEYS.PRICE_HISTORY,
        JSON.stringify(this.getAllPrices().filter((p) => !emptyItemIds.has(p.itemId)))
      );
    }
    safeStorage.setItem(
      STORAGE_KEYS.INCOME_HISTORY,
      JSON.stringify(this.getAllStoredIncome().filter((i) => i.profileId !== EMPTY_PROFILE_ID))
    );
    safeStorage.setItem(
      STORAGE_KEYS.PLANS_A,
      JSON.stringify(
        safeParseArray<SubstitutePlanA>(safeStorage.getItem(STORAGE_KEYS.PLANS_A)).filter(
          (p) => p.profileId !== EMPTY_PROFILE_ID
        )
      )
    );
    safeStorage.setItem(
      STORAGE_KEYS.PLANS_B,
      JSON.stringify(
        safeParseArray<EfficiencyPlanB>(safeStorage.getItem(STORAGE_KEYS.PLANS_B)).filter(
          (p) => p.profileId !== EMPTY_PROFILE_ID
        )
      )
    );
    this.deletePlanC(EMPTY_PROFILE_ID);
    safeStorage.setItem(
      STORAGE_KEYS.MONTHLY_CLOSURES,
      JSON.stringify(
        safeParseArray<MonthlyClosure>(safeStorage.getItem(STORAGE_KEYS.MONTHLY_CLOSURES)).filter(
          (c) => c.profileId !== EMPTY_PROFILE_ID
        )
      )
    );
  }

  static loadDemoBasket(): void {
    this.resetToDemoData();
  }

  static importItems(
    imported: BasketItem[],
    targetProfileId?: string,
    mode: 'merge' | 'replace' = 'merge'
  ): { importedCount: number; skippedDuplicates: number } {
    const activeId = targetProfileId || this.getActiveProfileId();
    const allStored = this.getAllStoredItems();
    const otherProfileItems = allStored.filter((i) => i.profileId !== activeId);
    const currentProfileItems = allStored.filter((i) => i.profileId === activeId);

    const existingIds = new Set(currentProfileItems.filter((i) => !i.isArchived).map((i) => i.id));
    const existingSignatures = new Set(
      currentProfileItems.filter((i) => !i.isArchived).map((i) => buildDuplicateSignature(i))
    );

    const baseProfileList = mode === 'replace' ? [] : [...currentProfileItems];
    const seenBatchSignatures = new Set<string>();
    let importedCount = 0;
    let skippedDuplicates = 0;

    for (let idx = 0; idx < imported.length; idx++) {
      const it = imported[idx];
      const sig = buildDuplicateSignature(it);
      const hasExistingDup =
        mode === 'merge' &&
        ((it.id && existingIds.has(it.id)) || existingSignatures.has(sig));

      if (hasExistingDup || seenBatchSignatures.has(sig)) {
        skippedDuplicates += 1;
        continue;
      }

      seenBatchSignatures.add(sig);
      baseProfileList.push({
        ...it,
        profileId: activeId,
        id: it.id || `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        active: it.active !== false,
        isArchived: false,
      });
      importedCount += 1;
    }

    safeStorage.setItem(
      STORAGE_KEYS.BASKET_ITEMS,
      JSON.stringify([...otherProfileItems, ...baseProfileList])
    );
    return { importedCount, skippedDuplicates };
  }

  // ==========================================
  // BACKUP GERAL & RESTAURAÇÃO
  // ==========================================
  static exportFullBackup() {
    const allPlansC = this.getAllPlansC();
    return {
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      activeProfileId: this.getActiveProfileId(),
      profiles: this.getProfiles(),
      groups: this.getGroups(),
      items: this.getAllStoredItems(),
      prices: this.getAllPrices(),
      income: this.getAllStoredIncome(),
      plansA: safeParseArray<SubstitutePlanA>(safeStorage.getItem(STORAGE_KEYS.PLANS_A)),
      plansB: safeParseArray<EfficiencyPlanB>(safeStorage.getItem(STORAGE_KEYS.PLANS_B)),
      plansC: allPlansC,
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
      if (data.plansC && typeof data.plansC === 'object') {
        safeStorage.setItem(STORAGE_KEYS.PLANS_C, JSON.stringify(data.plansC));
      } else if (data.planC && typeof data.planC === 'object') {
        const pid = typeof data.planC.profileId === 'string' && data.planC.profileId
          ? data.planC.profileId
          : this.getActiveProfileId();
        safeStorage.setItem(STORAGE_KEYS.PLANS_C, JSON.stringify({ [pid]: data.planC }));
      }
    } else {
      if (Array.isArray(data.items)) {
        this.importItems(data.items);
      }
      if (Array.isArray(data.prices)) {
        const currentPrices = this.getAllPrices();
        const combined = [
          ...currentPrices,
          ...data.prices.filter((p: any) => !currentPrices.some((cp) => cp.id === p.id)),
        ];
        safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(combined));
      }
      if (Array.isArray(data.groups)) {
        const currentGroups = this.getGroups();
        const combined = [
          ...currentGroups,
          ...data.groups.filter(
            (g: any) => !currentGroups.some((cg) => cg.id === g.id || cg.name === g.name)
          ),
        ];
        safeStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(combined));
      }
    }

    return { success: true, message: 'Backup restaurado com sucesso!' };
  }
}
