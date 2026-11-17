import { ProfileMode } from '../types';

export interface ProfileModeCopy {
  mode: ProfileMode;
  badgeLabel: string;
  modeTitle: string;
  shortTitle: string;
  modeDescription: string;
  basketNavLabel: string;
  basketHeading: string;
  spendLabel: string;
  inflationLabel: string;
  incomeNavLabel: string;
  incomeHeading: string;
  incomeFieldLabel: string;
  incomeTermSingular: string;
  surplusNotice: string;
  membersLabel: string;
  newItemPromptLabel: string;
  recommendationContextLabel: string;
}

export function resolveProfileMode(mode?: ProfileMode | string | null): ProfileMode {
  if (mode === 'negocio') return 'negocio';
  if (mode === 'estudante') return 'estudante';
  return 'pessoal';
}

export function getProfileModeCopy(mode?: ProfileMode | string | null): ProfileModeCopy {
  const resolved = resolveProfileMode(mode);
  if (resolved === 'negocio') {
    return {
      mode: 'negocio',
      badgeLabel: 'Modo Negócio',
      modeTitle: 'Negócio / Pequena Empresa',
      shortTitle: 'Negócio',
      modeDescription:
        'Acompanhe insumos, matérias-primas, fornecedores e custos operacionais para medir a variação real dos custos frente ao faturamento.',
      basketNavLabel: 'Insumos e Custos',
      basketHeading: 'Cesta de Custos, Insumos e Fornecedores',
      spendLabel: 'Custo Operacional Total',
      inflationLabel: 'Variação dos Custos',
      incomeNavLabel: 'Faturamento e Custos',
      incomeHeading: 'Faturamento vs. Variação dos Custos',
      incomeFieldLabel: 'Faturamento mensal do negócio (R$)',
      incomeTermSingular: 'Faturamento',
      surplusNotice: 'Resultado estimado (não é lucro contábil)',
      membersLabel: 'Pessoas no negócio',
      newItemPromptLabel: 'Insumo, matéria-prima ou custo operacional',
      recommendationContextLabel: 'operação, fornecedores e insumos',
    };
  }

  if (resolved === 'estudante') {
    return {
      mode: 'estudante',
      badgeLabel: 'Modo Estudante',
      modeTitle: 'Estudante',
      shortTitle: 'Estudante',
      modeDescription:
        'Acompanhe seus gastos com alimentação, transporte, materiais, livros e cursos para enxergar quanto os preços impactam sua renda ou auxílio.',
      basketNavLabel: 'Cesta Estudantil',
      basketHeading: 'Cesta de Consumo Estudantil',
      spendLabel: 'Gasto Estudantil Total',
      inflationLabel: 'Inflação Estudantil',
      incomeNavLabel: 'Renda e Poder de Compra',
      incomeHeading: 'Renda / Auxílio e Poder de Compra',
      incomeFieldLabel: 'Renda, bolsa, mesada ou auxílio mensal (R$)',
      incomeTermSingular: 'Renda / Auxílio',
      surplusNotice: 'Sobra estimada no mês',
      membersLabel: 'Pessoas consideradas',
      newItemPromptLabel: 'Produto, lanche, material ou curso',
      recommendationContextLabel: 'rotina e orçamento estudantil',
    };
  }

  return {
    mode: 'pessoal',
    badgeLabel: 'Modo Pessoal',
    modeTitle: 'Pessoal / Familiar',
    shortTitle: 'Pessoal / Familiar',
    modeDescription:
      'Acompanhe compras da casa, contas de consumo e despesas da família para enxergar o quanto seu custo de vida subiu.',
    basketNavLabel: 'Minha Cesta e Gastos',
    basketHeading: 'Cesta de Consumo Familiar',
    spendLabel: 'Gasto Mensal Total',
    inflationLabel: 'Inflação da Família',
    incomeNavLabel: 'Renda e Poder de Compra',
    incomeHeading: 'Renda Familiar e Poder de Compra',
    incomeFieldLabel: 'Renda mensal da casa (R$)',
    incomeTermSingular: 'Renda familiar',
    surplusNotice: 'Sobra mensal estimada',
    membersLabel: 'Pessoas na casa',
    newItemPromptLabel: 'Produto ou conta mensal',
    recommendationContextLabel: 'orçamento familiar',
  };
}
