/**
 * Utilitários centralizados de precisão numérica e formatação monetária/estatística (pt-BR).
 * Regra §47 e §48: manter precisão máxima nos cálculos internos e aplicar arredondamento
 * apenas na apresentação visual, distinguindo explicitamente 0 de valores ausentes/inválidos.
 */

export type ExplicitDataStatus =
  | 'ok'
  | 'nao_informado'
  | 'indisponivel'
  | 'invalido'
  | 'estimado'
  | 'desatualizado'
  | 'sem_comparabilidade';

export function normalizeZero(value: number, epsilon = 1e-9): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(value) < epsilon ? 0 : value;
}

export function roundDisplay(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(8, Math.trunc(decimals))));
  return normalizeZero(Math.round((value + Number.EPSILON) * factor) / factor);
}

export function formatNumberBR(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return 'Indisponível';
  const safe = normalizeZero(value);
  return safe.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrencyBR(
  value: number,
  options: { prefix?: boolean; decimals?: number } = {}
): string {
  const { prefix = true, decimals = 2 } = options;
  if (!Number.isFinite(value)) return 'Indisponível';
  const safe = roundDisplay(value, decimals);
  const formatted = Math.abs(safe).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = safe < 0 ? '-' : '';
  return prefix ? `${sign}R$ ${formatted}` : `${sign}${formatted}`;
}

export function formatSignedCurrencyBR(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return 'Indisponível';
  const safe = roundDisplay(value, decimals);
  const sign = safe > 0 ? '+' : safe < 0 ? '-' : '';
  const formatted = Math.abs(safe).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}R$ ${formatted}`;
}

export function formatOptionalCurrencyBR(
  value: number | null | undefined,
  missingLabel: 'Não informado' | 'Indisponível' | 'Inválido' = 'Não informado',
  options: { prefix?: boolean; decimals?: number } = {}
): string {
  if (value === null || value === undefined) return missingLabel;
  if (!Number.isFinite(value)) return 'Inválido';
  return formatCurrencyBR(value, options);
}

export function formatPercentBR(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return 'Indisponível';
  const safe = roundDisplay(value, decimals);
  return `${safe.toFixed(decimals).replace('.', ',')}%`;
}

export function formatSignedPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return 'Indisponível';
  const safe = roundDisplay(value, decimals);
  const sign = safe > 0 ? '+' : safe < 0 ? '-' : '';
  return `${sign}${Math.abs(safe).toFixed(decimals).replace('.', ',')}%`;
}

export function formatOptionalPercent(
  value: number | null | undefined,
  decimals = 2,
  missingLabel = 'Sem comparabilidade'
): string {
  if (value === null || value === undefined) return missingLabel;
  if (!Number.isFinite(value)) return 'Inválido';
  return formatSignedPercent(value, decimals);
}

export function formatSignedPP(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return 'Indisponível';
  const safe = roundDisplay(value, decimals);
  const sign = safe > 0 ? '+' : safe < 0 ? '-' : '';
  return `${sign}${Math.abs(safe).toFixed(decimals).replace('.', ',')} p.p.`;
}

export function formatDataStatusLabel(status: ExplicitDataStatus): string {
  switch (status) {
    case 'nao_informado':
      return 'Não informado';
    case 'indisponivel':
      return 'Indisponível';
    case 'invalido':
      return 'Inválido';
    case 'estimado':
      return 'Estimado';
    case 'desatualizado':
      return 'Desatualizado';
    case 'sem_comparabilidade':
      return 'Sem comparabilidade';
    default:
      return 'Válido';
  }
}
