import { ProfileMode } from '../types';

export interface ProfileModeCopy {
  mode: ProfileMode;
  badgeLabel: string;
  modeTitle: string;
  modeDescription: string;
  basketNavLabel: string;
  basketHeading: string;
  spendLabel: string;
  inflationLabel: string;
  incomeNavLabel: string;
  incomeHeading: string;
  incomeFieldLabel: string;
  membersLabel: string;
  newItemPromptLabel: string;
  recommendationContextLabel: string;
}

export function resolveProfileMode(mode?: ProfileMode | string | null): ProfileMode {
  return mode === 'negocio' ? 'negocio' : 'pessoal';
}

export function getProfileModeCopy(mode?: ProfileMode | string | null): ProfileModeCopy {
  const resolved = resolveProfileMode(mode);
  if (resolved === 'negocio') {
    return {
      mode: 'negocio',
      badgeLabel: 'Modo Negócio',
      modeTitle: 'Negócio / Pequena Empresa',
      modeDescription:
        'Acompanhe insumos, ingredientes, fornecedores e custos operacionais para medir a variação de custo e o impacto no seu resultado.',
      basketNavLabel: 'Insumos e Custos',
      basketHeading: 'Insumos, Ingredientes e Custos Operacionais',
      spendLabel: 'Custo Mensal Total',
      inflationLabel: 'Alta nos Custos',
      incomeNavLabel: 'Faturamento e Margem',
      incomeHeading: 'Faturamento e Saúde da Margem',
      incomeFieldLabel: 'Faturamento ou sobra mensal atual',
      membersLabel: 'Pessoas / Unidades',
      newItemPromptLabel: 'Insumo, ingrediente ou custo operacional',
      recommendationContextLabel: 'operação e insumos',
    };
  }

  return {
    mode: 'pessoal',
    badgeLabel: 'Modo Pessoal',
    modeTitle: 'Pessoal / Familiar',
    modeDescription:
      'Acompanhe compras da casa, contas de consumo e despesas da família para enxergar o quanto seu custo de vida subiu.',
    basketNavLabel: 'Minha Cesta e Gastos',
    basketHeading: 'Minha Cesta de Gastos',
    spendLabel: 'Gasto Mensal Total',
    inflationLabel: 'Sua Inflação',
    incomeNavLabel: 'Renda e Poder de Compra',
    incomeHeading: 'Renda e Poder de Compra',
    incomeFieldLabel: 'Quanto você recebe por mês',
    membersLabel: 'Pessoas na casa',
    newItemPromptLabel: 'Produto ou conta mensal',
    recommendationContextLabel: 'orçamento familiar',
  };
}
