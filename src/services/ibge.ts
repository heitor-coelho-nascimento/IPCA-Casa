import { IBGEHistoricalPoint, TimeframeWindow } from '../types';
import { normalizeZero } from '../utils/formatters';

export type IBGESourceMode = 'live' | 'cached_live' | 'contingency';

export interface IBGEGroupRate {
  code: string;
  name: string;
  monthlyRate: number;
  accumulated12MRate?: number;
  weightPercent?: number;
  isAvailable?: boolean;
}

export interface IBGERegionalRate {
  id: string;
  name: string;
  state: string;
  monthlyRate: number;
  accumulated12MRate?: number;
  weightPercent?: number;
  isAvailable?: boolean;
  isEstimatedFromNational?: boolean;
}

export interface IBGESeriesMetadata {
  source: string;
  sourceMode: IBGESourceMode;
  tableCode: string;
  variableCode: string;
  coverage: string;
  referencePeriod: string;
  consultedAt: string;
  cachedFromAt?: string;
  cacheTtlSeconds: number;
  cacheExpiresAt: string;
  nextOfficialUpdateEstimate: string;
  latestMonthCode: string;
  latestMonthLabel: string;
  latestMonthlyRate: number;
  accumulated12MRate: number;
  accumulatedYearRate: number | null;
  history: IBGEHistoricalPoint[];
  groups: IBGEGroupRate[];
  regionals: IBGERegionalRate[];
  isContingencyData: boolean;
  lastErrorMessage?: string;
  groupsLoadedCount?: number;
  regionalsLoadedCount?: number;
  dataCompleteness?: 'full' | 'partial' | 'contingency';
}

const IBGE_CACHE_KEY = 'ipca_casa_ibge_sidra_cache_v3';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora
const CACHE_TTL_SECONDS = Math.round(CACHE_TTL_MS / 1000);

const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

export const OFFICIAL_IBGE_DEFAULT_WEIGHTS: Record<string, number> = {
  'Alimentação e bebidas': 21.12,
  Habitação: 15.62,
  'Artigos de residência': 3.89,
  Vestuário: 4.82,
  Transportes: 20.66,
  'Saúde e cuidados pessoais': 13.45,
  'Despesas pessoais': 10.12,
  Educação: 6.08,
  Comunicação: 4.24,
};

export const OFFICIAL_IBGE_GROUPS: Array<{ code: string; name: string; defaultWeight: number }> = [
  { code: '7170', name: 'Alimentação e bebidas', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS['Alimentação e bebidas'] },
  { code: '7445', name: 'Habitação', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS.Habitação },
  { code: '7486', name: 'Artigos de residência', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS['Artigos de residência'] },
  { code: '7558', name: 'Vestuário', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS.Vestuário },
  { code: '7625', name: 'Transportes', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS.Transportes },
  { code: '7660', name: 'Saúde e cuidados pessoais', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS['Saúde e cuidados pessoais'] },
  { code: '7712', name: 'Despesas pessoais', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS['Despesas pessoais'] },
  { code: '7766', name: 'Educação', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS.Educação },
  { code: '7786', name: 'Comunicação', defaultWeight: OFFICIAL_IBGE_DEFAULT_WEIGHTS.Comunicação },
];

export const OFFICIAL_IBGE_REGIONS: Array<{
  id: string;
  sidraLevel: 'N1' | 'N7' | 'N6';
  sidraCode: string;
  name: string;
  state: string;
  defaultWeight: number;
}> = [
  { id: '1', sidraLevel: 'N1', sidraCode: '1', name: 'Brasil (Nacional)', state: 'BR', defaultWeight: 100.0 },
  { id: '3501', sidraLevel: 'N7', sidraCode: '3501', name: 'São Paulo (RM)', state: 'SP', defaultWeight: 32.2 },
  { id: '3301', sidraLevel: 'N7', sidraCode: '3301', name: 'Rio de Janeiro (RM)', state: 'RJ', defaultWeight: 9.4 },
  { id: '3101', sidraLevel: 'N7', sidraCode: '3101', name: 'Belo Horizonte (RM)', state: 'MG', defaultWeight: 9.1 },
  { id: '4301', sidraLevel: 'N7', sidraCode: '4301', name: 'Porto Alegre (RM)', state: 'RS', defaultWeight: 8.5 },
  { id: '4101', sidraLevel: 'N7', sidraCode: '4101', name: 'Curitiba (RM)', state: 'PR', defaultWeight: 8.1 },
  { id: '2901', sidraLevel: 'N7', sidraCode: '2901', name: 'Salvador (RM)', state: 'BA', defaultWeight: 5.7 },
  { id: '2601', sidraLevel: 'N7', sidraCode: '2601', name: 'Recife (RM)', state: 'PE', defaultWeight: 4.9 },
  { id: '2301', sidraLevel: 'N7', sidraCode: '2301', name: 'Fortaleza (RM)', state: 'CE', defaultWeight: 3.3 },
  { id: '1501', sidraLevel: 'N7', sidraCode: '1501', name: 'Belém (RM)', state: 'PA', defaultWeight: 4.0 },
  { id: '3201', sidraLevel: 'N7', sidraCode: '3201', name: 'Vitória (RM)', state: 'ES', defaultWeight: 1.9 },
  { id: '5300108', sidraLevel: 'N6', sidraCode: '5300108', name: 'Brasília (DF)', state: 'DF', defaultWeight: 4.2 },
  { id: '5208707', sidraLevel: 'N6', sidraCode: '5208707', name: 'Goiânia (GO)', state: 'GO', defaultWeight: 4.5 },
];

const VALID_REGION_IDS = new Set(OFFICIAL_IBGE_REGIONS.map((r) => r.id));
const NATIONAL_ALIASES = new Set(['N1[ALL]', 'N1/ALL', '1', 'BR', 'BRASIL']);

/**
 * Validação rigorosa e segura de códigos e escopos de localidade para consulta ao SIDRA/IBGE.
 * Rejeita valores arbitrários, parâmetros malformados e injeções, aceitando apenas
 * o escopo nacional oficial ou as RMs e Capitais disponibilizadas pelo IPCA.
 */
export function isValidIBGERegionCode(rawCode: unknown): boolean {
  if (typeof rawCode !== 'string') return false;
  const trimmed = rawCode.trim();
  if (!trimmed || trimmed.length > 32) return false;
  // Permite apenas caracteres seguros para códigos do SIDRA
  if (!/^[a-zA-Z0-9\[\]\/\-_]+$/.test(trimmed)) return false;

  const upper = trimmed.toUpperCase();
  if (NATIONAL_ALIASES.has(upper)) return true;
  if (VALID_REGION_IDS.has(trimmed)) return true;

  // Notação de nível do SIDRA: N1[all], N1/all, N7[3501], N7/3501, N6[5300108], N6/5300108
  const match = trimmed.match(/^(N[167])(?:\[([0-9a-zA-Z]+)\]|\/([0-9a-zA-Z]+))$/i);
  if (match) {
    const level = match[1].toUpperCase();
    const code = (match[2] || match[3]).toLowerCase();
    if (level === 'N1' && (code === 'all' || code === '1')) return true;
    const region = OFFICIAL_IBGE_REGIONS.find(
      (r) => r.id === code || r.sidraCode.toLowerCase() === code
    );
    if (region && region.sidraLevel.toUpperCase() === level) return true;
  }

  return false;
}

/**
 * Faz o parse estruturado do código ou escopo de região para uso nas URLs das tabelas 1737 e 7060 do SIDRA.
 */
export function parseIBGERegion(rawCode: string): {
  level: 'n1' | 'n7' | 'n6';
  code: string;
  isNational: boolean;
  regionDef: (typeof OFFICIAL_IBGE_REGIONS)[number];
} {
  const trimmed = (rawCode || '').trim();
  const upper = trimmed.toUpperCase();
  const defaultNational = OFFICIAL_IBGE_REGIONS[0];

  if (!trimmed || NATIONAL_ALIASES.has(upper) || upper === 'N1[ALL]' || upper === 'N1/ALL') {
    return { level: 'n1', code: 'all', isNational: true, regionDef: defaultNational };
  }

  const match = trimmed.match(/^(N[167])(?:\[([0-9a-zA-Z]+)\]|\/([0-9a-zA-Z]+))$/i);
  if (match) {
    const level = match[1].toLowerCase() as 'n1' | 'n7' | 'n6';
    const code = match[2] || match[3];
    if (level === 'n1' || code.toLowerCase() === 'all' || code === '1') {
      return { level: 'n1', code: 'all', isNational: true, regionDef: defaultNational };
    }
    const regionDef = OFFICIAL_IBGE_REGIONS.find((r) => r.id === code || r.sidraCode === code);
    if (regionDef) {
      return { level, code: regionDef.sidraCode, isNational: regionDef.id === '1', regionDef };
    }
  }

  const regionDef = OFFICIAL_IBGE_REGIONS.find((r) => r.id === trimmed || r.sidraCode === trimmed);
  if (regionDef) {
    return {
      level: regionDef.sidraLevel.toLowerCase() as 'n1' | 'n7' | 'n6',
      code: regionDef.sidraCode,
      isNational: regionDef.id === '1',
      regionDef,
    };
  }

  return { level: 'n1', code: 'all', isNational: true, regionDef: defaultNational };
}

export function formatMonthCodeToLabel(monthCode: string): string {
  if (!monthCode || monthCode.length < 6) return monthCode;
  const yr = monthCode.slice(2, 4);
  const mo = monthCode.slice(4, 6);
  return `${MONTH_ABBR[mo] || mo}/${yr}`;
}

export function monthCodeToIsoDate(monthCode: string): string {
  if (!/^\d{6}$/.test(monthCode)) return monthCode;
  return `${monthCode.slice(0, 4)}-${monthCode.slice(4, 6)}-01`;
}

export function isoDateToMonthCode(point: IBGEHistoricalPoint): string {
  if (point.monthCode && /^\d{6}$/.test(point.monthCode)) {
    return point.monthCode;
  }
  if (point.date && /^\d{4}-\d{2}/.test(point.date)) {
    return point.date.slice(0, 7).replace('-', '');
  }
  return '';
}

export function estimateNextIbgeRelease(latestMonthCode: string): string {
  if (!/^\d{6}$/.test(latestMonthCode)) {
    return 'Calendário IBGE (~dia 10 do mês subsequente ao de referência)';
  }
  const year = parseInt(latestMonthCode.slice(0, 4), 10);
  const month = parseInt(latestMonthCode.slice(4, 6), 10);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthLabel = MONTH_ABBR[String(nextMonth).padStart(2, '0')] || String(nextMonth);
  return `Previsão calendário IBGE: ~10/${monthLabel}/${nextYear} (divulgação após ${formatMonthCodeToLabel(latestMonthCode)})`;
}

export function computeGeometricPeriodAccumulated(
  history: IBGEHistoricalPoint[],
  startMonthCode?: string,
  endMonthCode?: string
): {
  valid: boolean;
  rate: number | null;
  monthsUsed: IBGEHistoricalPoint[];
  isCompleteSeries: boolean;
  reason?: string;
} {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      valid: false,
      rate: null,
      monthsUsed: [],
      isCompleteSeries: false,
      reason: 'Série histórica oficial do IBGE não carregada.',
    };
  }

  const withCodes = history
    .map((pt) => ({ ...pt, resolvedCode: isoDateToMonthCode(pt) }))
    .filter((pt) => /^\d{6}$/.test(pt.resolvedCode) && Number.isFinite(pt.monthlyRate))
    .sort((a, b) => a.resolvedCode.localeCompare(b.resolvedCode));

  const cleanStart = startMonthCode ? startMonthCode.replace('-', '').slice(0, 6) : undefined;
  const cleanEnd = endMonthCode ? endMonthCode.replace('-', '').slice(0, 6) : undefined;

  const filtered = withCodes.filter((pt) => {
    const afterStart = !cleanStart || pt.resolvedCode >= cleanStart;
    const beforeEnd = !cleanEnd || pt.resolvedCode <= cleanEnd;
    return afterStart && beforeEnd;
  });

  if (filtered.length === 0) {
    return {
      valid: false,
      rate: null,
      monthsUsed: [],
      isCompleteSeries: false,
      reason: 'Nenhum mês publicado pelo IBGE dentro do intervalo solicitado.',
    };
  }

  let product = 1;
  for (const pt of filtered) {
    product *= 1 + pt.monthlyRate / 100;
  }

  let isComplete = true;
  for (let i = 1; i < filtered.length; i++) {
    const prevY = parseInt(filtered[i - 1].resolvedCode.slice(0, 4), 10);
    const prevM = parseInt(filtered[i - 1].resolvedCode.slice(4, 6), 10);
    const curY = parseInt(filtered[i].resolvedCode.slice(0, 4), 10);
    const curM = parseInt(filtered[i].resolvedCode.slice(4, 6), 10);
    if ((curY - prevY) * 12 + (curM - prevM) !== 1) {
      isComplete = false;
      break;
    }
  }

  return {
    valid: true,
    rate: normalizeZero((product - 1) * 100),
    monthsUsed: filtered.map(({ resolvedCode, ...rest }) => ({ ...rest, monthCode: resolvedCode })),
    isCompleteSeries: isComplete,
  };
}

export function getOfficialBenchmarkForTimeframe(
  ibgeData: IBGESeriesMetadata | null | undefined,
  timeframe: TimeframeWindow,
  customStartDate?: string,
  customEndDate?: string
): {
  rate: number;
  unitLabel: string;
  subtitle: string;
  monthsIncludedLabel: string;
  isExactPeriodMatch: boolean;
  expectedMonthsCount?: number;
  availableMonthsCount?: number;
  completenessNote?: string;
} {
  if (!ibgeData) {
    return {
      rate: 0,
      unitLabel: 'indisp.',
      subtitle: 'Série IBGE não disponível',
      monthsIncludedLabel: 'Sem série carregada',
      isExactPeriodMatch: false,
      expectedMonthsCount: timeframe === '1M' ? 1 : timeframe === '12M' ? 12 : undefined,
      availableMonthsCount: 0,
      completenessNote: 'Série oficial do IBGE ainda não carregada.',
    };
  }

  if (timeframe === '1M') {
    const hasMonth = Boolean(ibgeData.latestMonthCode && Number.isFinite(ibgeData.latestMonthlyRate));
    return {
      rate: Number.isFinite(ibgeData.latestMonthlyRate) ? ibgeData.latestMonthlyRate : 0,
      unitLabel: 'no mês',
      subtitle: ibgeData.latestMonthLabel
        ? `Variação Mensal (${ibgeData.latestMonthLabel})`
        : 'Último Mês Publicado',
      monthsIncludedLabel: ibgeData.latestMonthLabel || 'Último mês oficial',
      isExactPeriodMatch: hasMonth,
      expectedMonthsCount: 1,
      availableMonthsCount: hasMonth ? 1 : 0,
      completenessNote: hasMonth ? undefined : 'Última competência mensal do IBGE indisponível.',
    };
  }

  if (timeframe === 'YTD') {
    const latestCode = ibgeData.latestMonthCode || '';
    const latestYear = latestCode.slice(0, 4);
    const expectedMonths = /^\d{6}$/.test(latestCode) ? Math.max(1, parseInt(latestCode.slice(4, 6), 10)) : 0;
    const ytdMonths = (ibgeData.history || []).filter((h) => {
      const code = isoDateToMonthCode(h);
      return latestYear ? code.startsWith(latestYear) : false;
    });
    const ytdCalc = computeGeometricPeriodAccumulated(ytdMonths);
    const hasCompleteYtd =
      expectedMonths > 0 &&
      ytdCalc.valid &&
      ytdCalc.isCompleteSeries &&
      ytdMonths.length === expectedMonths &&
      isoDateToMonthCode(ytdMonths[0]) === `${latestYear}01`;

    const resolvedYtd =
      ibgeData.accumulatedYearRate !== null &&
      ibgeData.accumulatedYearRate !== undefined &&
      Number.isFinite(ibgeData.accumulatedYearRate)
        ? ibgeData.accumulatedYearRate
        : ytdCalc.rate ?? 0;

    return {
      rate: resolvedYtd,
      unitLabel: 'no ano',
      subtitle: `Acumulado no Ano (${latestYear || 'Atual'})`,
      monthsIncludedLabel:
        ytdMonths.length > 0
          ? `${ytdMonths[0].label} até ${ytdMonths[ytdMonths.length - 1].label} (${ytdMonths.length}m)`
          : 'Acumulado ano SIDRA',
      isExactPeriodMatch: hasCompleteYtd || (ibgeData.accumulatedYearRate !== null && ibgeData.accumulatedYearRate !== undefined),
      expectedMonthsCount: expectedMonths || undefined,
      availableMonthsCount: ytdMonths.length,
      completenessNote:
        !hasCompleteYtd && ytdMonths.length < expectedMonths
          ? `Janela YTD possui ${ytdMonths.length} de ${expectedMonths} meses na série local (usando acumulado oficial publicado quando disponível).`
          : undefined,
    };
  }

  if (timeframe === 'CUSTOM') {
    const startYM =
      customStartDate && /^\d{4}-\d{2}/.test(customStartDate)
        ? customStartDate.slice(0, 7).replace('-', '')
        : undefined;
    const endYM =
      customEndDate && /^\d{4}-\d{2}/.test(customEndDate)
        ? customEndDate.slice(0, 7).replace('-', '')
        : undefined;
    const calc = computeGeometricPeriodAccumulated(ibgeData.history || [], startYM, endYM);
    if (calc.valid && calc.rate !== null) {
      return {
        rate: calc.rate,
        unitLabel: 'no recorte',
        subtitle: `IBGE Composto (${calc.monthsUsed.length} ${
          calc.monthsUsed.length === 1 ? 'mês' : 'meses'
        })`,
        monthsIncludedLabel: `${calc.monthsUsed[0].label} a ${
          calc.monthsUsed[calc.monthsUsed.length - 1].label
        }`,
        isExactPeriodMatch: calc.isCompleteSeries,
        availableMonthsCount: calc.monthsUsed.length,
        completenessNote: !calc.isCompleteSeries
          ? 'Série do recorte possui lacuna entre meses publicados.'
          : undefined,
      };
    }
    return {
      rate: ibgeData.accumulated12MRate,
      unitLabel: 'ref. 12M',
      subtitle: 'Recorte fora da janela SIDRA disponível — exibindo 12M',
      monthsIncludedLabel: calc.reason || 'Fora da janela disponível',
      isExactPeriodMatch: false,
      availableMonthsCount: 0,
      completenessNote: calc.reason || 'Período solicitado fora da série histórica IBGE carregada.',
    };
  }

  const last12 = (ibgeData.history || []).slice(-12);
  const last12Calc = computeGeometricPeriodAccumulated(last12);
  const isComplete12 = last12.length === 12 && last12Calc.valid && last12Calc.isCompleteSeries;
  return {
    rate: Number.isFinite(ibgeData.accumulated12MRate) ? ibgeData.accumulated12MRate : 0,
    unitLabel: 'a.a.',
    subtitle: 'Acumulado 12 Meses (IBGE)',
    monthsIncludedLabel:
      last12.length >= 2
        ? `${last12[0].label} até ${last12[last12.length - 1].label}${last12.length < 12 ? ` (${last12.length}/12m)` : ''}`
        : ibgeData.latestMonthLabel || '12 meses',
    isExactPeriodMatch: isComplete12,
    expectedMonthsCount: 12,
    availableMonthsCount: last12.length,
    completenessNote: !isComplete12
      ? `Série local contém ${last12.length} de 12 meses contínuos.`
      : undefined,
  };
}

export function buildFallbackMetadata(errorMessage?: string): IBGESeriesMetadata {
  const consultedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  const history: IBGEHistoricalPoint[] = [
    { date: '2024-03-01', monthCode: '202403', label: 'Mar/24', monthlyRate: 0.16, accumulated12M: 3.93, accumulatedYear: 1.42 },
    { date: '2024-04-01', monthCode: '202404', label: 'Abr/24', monthlyRate: 0.38, accumulated12M: 3.69, accumulatedYear: 1.80 },
    { date: '2024-05-01', monthCode: '202405', label: 'Mai/24', monthlyRate: 0.46, accumulated12M: 3.93, accumulatedYear: 2.27 },
    { date: '2024-06-01', monthCode: '202406', label: 'Jun/24', monthlyRate: 0.21, accumulated12M: 4.23, accumulatedYear: 2.48 },
    { date: '2024-07-01', monthCode: '202407', label: 'Jul/24', monthlyRate: 0.38, accumulated12M: 4.50, accumulatedYear: 2.87 },
    { date: '2024-08-01', monthCode: '202408', label: 'Ago/24', monthlyRate: -0.02, accumulated12M: 4.24, accumulatedYear: 2.85 },
    { date: '2024-09-01', monthCode: '202409', label: 'Set/24', monthlyRate: 0.44, accumulated12M: 4.42, accumulatedYear: 3.31 },
    { date: '2024-10-01', monthCode: '202410', label: 'Out/24', monthlyRate: 0.56, accumulated12M: 4.76, accumulatedYear: 3.88 },
    { date: '2024-11-01', monthCode: '202411', label: 'Nov/24', monthlyRate: 0.39, accumulated12M: 4.87, accumulatedYear: 4.29 },
    { date: '2024-12-01', monthCode: '202412', label: 'Dez/24', monthlyRate: 0.52, accumulated12M: 4.83, accumulatedYear: 4.83 },
    { date: '2025-01-01', monthCode: '202501', label: 'Jan/25', monthlyRate: 0.16, accumulated12M: 4.56, accumulatedYear: 0.16 },
    { date: '2025-02-01', monthCode: '202502', label: 'Fev/25', monthlyRate: 1.31, accumulated12M: 5.06, accumulatedYear: 1.47 },
    { date: '2025-03-01', monthCode: '202503', label: 'Mar/25', monthlyRate: 0.56, accumulated12M: 5.48, accumulatedYear: 2.04 },
    { date: '2025-04-01', monthCode: '202504', label: 'Abr/25', monthlyRate: 0.43, accumulated12M: 5.53, accumulatedYear: 2.48 },
    { date: '2025-05-01', monthCode: '202505', label: 'Mai/25', monthlyRate: 0.26, accumulated12M: 5.32, accumulatedYear: 2.75 },
    { date: '2025-06-01', monthCode: '202506', label: 'Jun/25', monthlyRate: 0.24, accumulated12M: 5.35, accumulatedYear: 2.99 },
    { date: '2025-07-01', monthCode: '202507', label: 'Jul/25', monthlyRate: 0.26, accumulated12M: 5.23, accumulatedYear: 3.26 },
    { date: '2025-08-01', monthCode: '202508', label: 'Ago/25', monthlyRate: -0.11, accumulated12M: 5.13, accumulatedYear: 3.15 },
    { date: '2025-09-01', monthCode: '202509', label: 'Set/25', monthlyRate: 0.48, accumulated12M: 5.17, accumulatedYear: 3.64 },
    { date: '2025-10-01', monthCode: '202510', label: 'Out/25', monthlyRate: 0.09, accumulated12M: 4.68, accumulatedYear: 3.74 },
    { date: '2025-11-01', monthCode: '202511', label: 'Nov/25', monthlyRate: 0.18, accumulated12M: 4.46, accumulatedYear: 3.92 },
    { date: '2025-12-01', monthCode: '202512', label: 'Dez/25', monthlyRate: 0.33, accumulated12M: 4.26, accumulatedYear: 4.26 },
    { date: '2026-01-01', monthCode: '202601', label: 'Jan/26', monthlyRate: 0.42, accumulated12M: 4.56, accumulatedYear: 0.42 },
    { date: '2026-02-01', monthCode: '202602', label: 'Fev/26', monthlyRate: 0.83, accumulated12M: 4.50, accumulatedYear: 1.25 },
    { date: '2026-03-01', monthCode: '202603', label: 'Mar/26', monthlyRate: 0.28, accumulated12M: 4.21, accumulatedYear: 1.53 },
    { date: '2026-04-01', monthCode: '202604', label: 'Abr/26', monthlyRate: 0.35, accumulated12M: 4.13, accumulatedYear: 1.89 },
    { date: '2026-05-01', monthCode: '202605', label: 'Mai/26', monthlyRate: 0.22, accumulated12M: 4.09, accumulatedYear: 2.11 },
    { date: '2026-06-01', monthCode: '202606', label: 'Jun/26', monthlyRate: 0.19, accumulated12M: 4.04, accumulatedYear: 2.30 },
    { date: '2026-07-01', monthCode: '202607', label: 'Jul/26', monthlyRate: 0.25, accumulated12M: 4.03, accumulatedYear: 2.56 },
    { date: '2026-08-01', monthCode: '202608', label: 'Ago/26', monthlyRate: -0.05, accumulated12M: 4.09, accumulatedYear: 2.51 },
    { date: '2026-09-01', monthCode: '202609', label: 'Set/26', monthlyRate: 0.38, accumulated12M: 3.99, accumulatedYear: 2.90 },
    { date: '2026-10-01', monthCode: '202610', label: 'Out/26', monthlyRate: 0.42, accumulated12M: 4.34, accumulatedYear: 3.33 },
  ];
  const firstPoint = history[0];
  const latestPoint = history[history.length - 1];

  return {
    source: 'Referência Offline de Contingência (IBGE - Tabelas 1737/7060)',
    sourceMode: 'contingency',
    tableCode: '1737 / 7060',
    variableCode: '63, 69, 2265, 66',
    coverage: 'Brasil (Nacional)',
    referencePeriod: `${firstPoint.date} a ${latestPoint.date}`,
    consultedAt,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    cacheExpiresAt: expiresAt,
    nextOfficialUpdateEstimate: estimateNextIbgeRelease(latestPoint.monthCode || '202610'),
    latestMonthCode: latestPoint.monthCode || '202610',
    latestMonthLabel: latestPoint.label,
    latestMonthlyRate: latestPoint.monthlyRate,
    accumulated12MRate: latestPoint.accumulated12M,
    accumulatedYearRate: latestPoint.accumulatedYear,
    history,
    groups: [
      { code: '7170', name: 'Alimentação e bebidas', monthlyRate: 0.95, accumulated12MRate: 7.45, weightPercent: 21.12, isAvailable: true },
      { code: '7445', name: 'Habitação', monthlyRate: 0.54, accumulated12MRate: 4.10, weightPercent: 15.62, isAvailable: true },
      { code: '7486', name: 'Artigos de residência', monthlyRate: 0.12, accumulated12MRate: 1.20, weightPercent: 3.89, isAvailable: true },
      { code: '7558', name: 'Vestuário', monthlyRate: 0.31, accumulated12MRate: 2.85, weightPercent: 4.82, isAvailable: true },
      { code: '7625', name: 'Transportes', monthlyRate: 0.65, accumulated12MRate: 4.30, weightPercent: 20.66, isAvailable: true },
      { code: '7660', name: 'Saúde e cuidados pessoais', monthlyRate: 0.58, accumulated12MRate: 6.12, weightPercent: 13.45, isAvailable: true },
      { code: '7712', name: 'Despesas pessoais', monthlyRate: 0.48, accumulated12MRate: 5.05, weightPercent: 10.12, isAvailable: true },
      { code: '7766', name: 'Educação', monthlyRate: 4.70, accumulated12MRate: 6.18, weightPercent: 6.08, isAvailable: true },
      { code: '7786', name: 'Comunicação', monthlyRate: 0.15, accumulated12MRate: 2.15, weightPercent: 4.24, isAvailable: true },
    ],
    regionals: OFFICIAL_IBGE_REGIONS.map((reg) => ({
      id: reg.id,
      name: reg.name,
      state: reg.state,
      monthlyRate: latestPoint.monthlyRate,
      accumulated12MRate: latestPoint.accumulated12M,
      weightPercent: reg.defaultWeight,
      isAvailable: true,
      isEstimatedFromNational: reg.id !== '1',
    })),
    isContingencyData: true,
    lastErrorMessage: errorMessage,
    groupsLoadedCount: 9,
    regionalsLoadedCount: OFFICIAL_IBGE_REGIONS.length,
    dataCompleteness: 'contingency',
  };
}

interface CachedSidraWrapper {
  timestamp: number;
  data: IBGESeriesMetadata;
}

const serverMemoryCache = new Map<string, { timestamp: number; data: IBGESeriesMetadata }>();

function buildStorageKey(scope?: string): string {
  const parsed = parseIBGERegion(scope || 'N1[all]');
  if (parsed.isNational) {
    return `${IBGE_CACHE_KEY}_n1_all`;
  }
  return `${IBGE_CACHE_KEY}_${parsed.level}_${parsed.code}`;
}

function readCachedSidra(scope?: string): CachedSidraWrapper | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const parsedRegion = parseIBGERegion(scope || 'N1[all]');
    const key = buildStorageKey(scope);
    const raw =
      window.localStorage.getItem(key) ||
      (parsedRegion.isNational ? window.localStorage.getItem(IBGE_CACHE_KEY) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSidraWrapper;
    if (
      parsed &&
      parsed.data &&
      Array.isArray(parsed.data.history) &&
      parsed.data.history.length >= 6 &&
      Array.isArray(parsed.data.groups) &&
      Array.isArray(parsed.data.regionals) &&
      Number.isFinite(parsed.data.accumulated12MRate)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedSidra(data: IBGESeriesMetadata, scope?: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const parsedRegion = parseIBGERegion(scope || 'N1[all]');
    const key = buildStorageKey(scope);
    const payload: CachedSidraWrapper = {
      timestamp: Date.now(),
      data,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
    if (parsedRegion.isNational) {
      window.localStorage.setItem(IBGE_CACHE_KEY, JSON.stringify(payload));
    }
  } catch {
    // ignora erros de quota de storage
  }
}

async function fetchSidraJson(url: string, timeoutMs = 8000): Promise<any[]> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao consultar SIDRA`);
    }
    const json = await response.json();
    if (!Array.isArray(json) || json.length < 2) {
      throw new Error('Retorno vazio da API SIDRA');
    }
    return json.slice(1);
  } finally {
    clearTimeout(id);
  }
}

/**
 * Consulta direta aos serviços oficiais do SIDRA/IBGE.
 * Realiza as consultas externas das Tabelas 1737 e 7060, tratando escopos geográficos
 * (Brasil N1, Regiões Metropolitanas N7 e Capitais N6), parciais de rede, e cache compartilhado.
 */
export async function fetchOfficialIPCAFromSidra(
  scope = 'N1[all]',
  forceRefresh = false
): Promise<IBGESeriesMetadata> {
  const parsedRegion = parseIBGERegion(scope);
  const cacheKey = `${parsedRegion.level}_${parsedRegion.code}`;

  // 1. Verifica cache em memória no backend
  const memCached = serverMemoryCache.get(cacheKey);
  if (!forceRefresh && memCached && Date.now() - memCached.timestamp < CACHE_TTL_MS) {
    return {
      ...memCached.data,
      sourceMode: 'cached_live',
    };
  }

  // 2. Verifica cache local do navegador
  const localCached = readCachedSidra(scope);
  if (!forceRefresh && localCached && Date.now() - localCached.timestamp < CACHE_TTL_MS) {
    return localCached.data;
  }

  try {
    // Monta URL da Tabela 1737 com base no nível geográfico correto
    let urlSeries: string;
    if (parsedRegion.isNational) {
      urlSeries =
        'https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/63,69,2265/p/last%2024/d/v63%202,v69%202,v2265%202';
    } else {
      urlSeries = `https://apisidra.ibge.gov.br/values/t/1737/${parsedRegion.level}/${parsedRegion.code}/v/63,69,2265/p/last%2024/d/v63%202,v69%202,v2265%202`;
    }

    const seriesRows = await fetchSidraJson(urlSeries, 8500);

    const historyMap = new Map<string, IBGEHistoricalPoint>();
    for (const row of seriesRows) {
      const monthCode = String(row.D3C || '');
      const varCode = String(row.D2C || '');
      const rawVal = parseFloat(String(row.V || '').replace(',', '.'));
      if (!/^\d{6}$/.test(monthCode) || !Number.isFinite(rawVal)) continue;

      if (!historyMap.has(monthCode)) {
        historyMap.set(monthCode, {
          date: monthCodeToIsoDate(monthCode),
          monthCode,
          label: formatMonthCodeToLabel(monthCode),
          monthlyRate: 0,
          accumulated12M: 0,
          accumulatedYear: null,
        });
      }
      const entry = historyMap.get(monthCode)!;
      if (varCode === '63') entry.monthlyRate = rawVal;
      if (varCode === '2265') entry.accumulated12M = rawVal;
      if (varCode === '69') entry.accumulatedYear = rawVal;
    }

    const history = Array.from(historyMap.values()).sort((a, b) =>
      (a.monthCode || '').localeCompare(b.monthCode || '')
    );

    if (history.length === 0) {
      throw new Error(`Falha no parseamento da série histórica SIDRA para ${scope}`);
    }

    const firstPoint = history[0];
    const latestPoint = history[history.length - 1];
    const targetPeriod = latestPoint.monthCode || isoDateToMonthCode(latestPoint);

    // Tabela 7060: Grupos de consumo + Visão regional comparativa
    const groupCodes = OFFICIAL_IBGE_GROUPS.map((g) => g.code).join(',');
    let urlGroups: string;
    if (parsedRegion.isNational) {
      urlGroups = `https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/63,2265,66/p/${targetPeriod}/c315/${groupCodes}`;
    } else {
      urlGroups = `https://apisidra.ibge.gov.br/values/t/7060/${parsedRegion.level}/${parsedRegion.code}/v/63,2265,66/p/${targetPeriod}/c315/${groupCodes}`;
    }

    const urlRegionsN7 = `https://apisidra.ibge.gov.br/values/t/7060/n7/all/v/63,2265,66/p/${targetPeriod}/c315/7169`;
    const urlRegionsN6 = `https://apisidra.ibge.gov.br/values/t/7060/n6/5300108,5208707/v/63,2265,66/p/${targetPeriod}/c315/7169`;

    const [groupRowsRes, regionN7Res, regionN6Res] = await Promise.allSettled([
      fetchSidraJson(urlGroups, 6500),
      fetchSidraJson(urlRegionsN7, 6500),
      fetchSidraJson(urlRegionsN6, 6500),
    ]);

    // Trata grupos oficiais (distingue ausência de dado vs 0 real)
    const groupMap = new Map<string, IBGEGroupRate>();
    for (const og of OFFICIAL_IBGE_GROUPS) {
      groupMap.set(og.code, {
        code: og.code,
        name: og.name,
        monthlyRate: 0,
        accumulated12MRate: undefined,
        weightPercent: og.defaultWeight,
        isAvailable: false,
      });
    }

    let groupsLoadedCount = 0;
    if (groupRowsRes.status === 'fulfilled') {
      for (const row of groupRowsRes.value) {
        const code = String(row.D4C || '');
        const varCode = String(row.D2C || '');
        const val = parseFloat(String(row.V || '').replace(',', '.'));
        const entry = groupMap.get(code);
        if (!entry || !Number.isFinite(val)) continue;
        if (varCode === '63') {
          entry.monthlyRate = val;
          entry.isAvailable = true;
          groupsLoadedCount++;
        }
        if (varCode === '2265') entry.accumulated12MRate = val;
        if (varCode === '66') entry.weightPercent = val;
      }
    }

    // Trata regiões oficiais
    const regionMap = new Map<string, IBGERegionalRate>();
    for (const reg of OFFICIAL_IBGE_REGIONS) {
      regionMap.set(reg.sidraCode, {
        id: reg.id,
        name: reg.name,
        state: reg.state,
        monthlyRate: reg.id === parsedRegion.regionDef.id ? latestPoint.monthlyRate : 0,
        accumulated12MRate: reg.id === parsedRegion.regionDef.id ? latestPoint.accumulated12M : undefined,
        weightPercent: reg.defaultWeight,
        isAvailable: reg.id === parsedRegion.regionDef.id,
        isEstimatedFromNational: false,
      });
    }

    let regionalsLoadedCount = 0;
    const applyRegionalRows = (rows: any[]) => {
      for (const row of rows) {
        const code = String(row.D1C || '');
        const varCode = String(row.D2C || '');
        const val = parseFloat(String(row.V || '').replace(',', '.'));
        const entry = regionMap.get(code);
        if (!entry || !Number.isFinite(val)) continue;
        if (varCode === '63') {
          entry.monthlyRate = val;
          entry.isAvailable = true;
          regionalsLoadedCount++;
        }
        if (varCode === '2265') entry.accumulated12MRate = val;
        if (varCode === '66') entry.weightPercent = val;
      }
    };

    if (regionN7Res.status === 'fulfilled') applyRegionalRows(regionN7Res.value);
    if (regionN6Res.status === 'fulfilled') applyRegionalRows(regionN6Res.value);

    // Se a consulta foi para uma RM ou Capital específica, garante taxa dela preenchida
    const activeRegionalEntry = regionMap.get(parsedRegion.regionDef.sidraCode);
    if (activeRegionalEntry && !activeRegionalEntry.isAvailable) {
      activeRegionalEntry.monthlyRate = latestPoint.monthlyRate;
      activeRegionalEntry.accumulated12MRate = latestPoint.accumulated12M;
      activeRegionalEntry.isAvailable = true;
    }

    const nowMs = Date.now();
    const dataCompleteness =
      groupsLoadedCount >= 7 && (parsedRegion.isNational ? regionalsLoadedCount >= 5 : true)
        ? 'full'
        : 'partial';

    const result: IBGESeriesMetadata = {
      source: `IBGE - Sistema SIDRA (Tabelas 1737 e 7060 - ${parsedRegion.regionDef.name})`,
      sourceMode: 'live',
      tableCode: '1737 / 7060',
      variableCode: '63, 69, 2265, 66',
      coverage: parsedRegion.regionDef.name,
      referencePeriod: `${firstPoint.date} a ${latestPoint.date}`,
      consultedAt: new Date(nowMs).toISOString(),
      cacheTtlSeconds: CACHE_TTL_SECONDS,
      cacheExpiresAt: new Date(nowMs + CACHE_TTL_MS).toISOString(),
      nextOfficialUpdateEstimate: estimateNextIbgeRelease(targetPeriod),
      latestMonthCode: targetPeriod,
      latestMonthLabel: latestPoint.label,
      latestMonthlyRate: latestPoint.monthlyRate,
      accumulated12MRate: latestPoint.accumulated12M,
      accumulatedYearRate: latestPoint.accumulatedYear,
      history,
      groups: Array.from(groupMap.values()),
      regionals: Array.from(regionMap.values()),
      isContingencyData: false,
      groupsLoadedCount,
      regionalsLoadedCount,
      dataCompleteness,
    };

    serverMemoryCache.set(cacheKey, { timestamp: nowMs, data: result });
    writeCachedSidra(result, scope);
    return result;
  } catch (err) {
    const errText = err instanceof Error ? err.message : 'Conexão SIDRA indisponível.';

    // Tenta cache em memória do backend
    if (memCached && memCached.data) {
      return {
        ...memCached.data,
        sourceMode: 'cached_live',
        consultedAt: new Date().toISOString(),
        cachedFromAt: memCached.data.consultedAt,
        cacheTtlSeconds: CACHE_TTL_SECONDS,
        lastErrorMessage: errText,
      };
    }

    // Tenta cache local
    if (localCached && localCached.data) {
      return {
        ...localCached.data,
        sourceMode: 'cached_live',
        consultedAt: new Date().toISOString(),
        cachedFromAt: localCached.data.consultedAt,
        cacheTtlSeconds: CACHE_TTL_SECONDS,
        lastErrorMessage: errText,
      };
    }

    return buildFallbackMetadata(errText);
  }
}

/**
 * Função de consumo universal de metadados oficiais do IBGE.
 * - No frontend (navegador): consulta a rota própria /api/ibge, garantindo proxy, cache e proteção anti-abuso.
 * - No backend (ou com bypassLocalApiProxy): consulta diretamente o SIDRA evitando chamadas recursivas.
 */
export async function fetchOfficialIPCA(
  scope = 'N1[all]',
  forceRefresh = false,
  options?: { bypassLocalApiProxy?: boolean }
): Promise<IBGESeriesMetadata> {
  const isBrowser = typeof window !== 'undefined';
  const shouldQueryLocalProxy = isBrowser && !options?.bypassLocalApiProxy;

  if (shouldQueryLocalProxy) {
    const cached = readCachedSidra(scope);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const url = `/api/ibge?region=${encodeURIComponent(scope)}${forceRefresh ? '&force=true' : ''}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

      if (res.ok) {
        const data = (await res.json()) as IBGESeriesMetadata;
        writeCachedSidra(data, scope);
        return data;
      }

      if (res.status === 429 && cached && cached.data) {
        return {
          ...cached.data,
          sourceMode: 'cached_live',
          lastErrorMessage: 'Atualização recente em cooldown. Exibindo dados locais em cache.',
        };
      }

      throw new Error(`Proxy /api/ibge retornou status HTTP ${res.status}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na comunicação com o backend';
      if (cached && cached.data) {
        return {
          ...cached.data,
          sourceMode: 'cached_live',
          lastErrorMessage: msg,
        };
      }
      // Se proxy próprio falhar no navegador, consulta diretamente o SIDRA
      return fetchOfficialIPCAFromSidra(scope, forceRefresh);
    }
  }

  // Execução direta via backend ou quando bypassLocalApiProxy for ativado
  return fetchOfficialIPCAFromSidra(scope, forceRefresh);
}

export const IBGEService = {
  getMetadata: fetchOfficialIPCA,
  fetchOfficialData: (forceRefresh = false) => fetchOfficialIPCA('N1[all]', forceRefresh),
  refresh: () => fetchOfficialIPCA('N1[all]', true),
  clearCache: (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(IBGE_CACHE_KEY)) keysToRemove.push(k);
        }
        for (const k of keysToRemove) window.localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
    serverMemoryCache.clear();
  },
};
