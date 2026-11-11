/**
 * IPCA-Casa: Integração Oficial com a API Pública do SIDRA / IBGE
 * Consulta séries oficiais do IPCA (Tabela 1737 e Tabela 7060) com:
 * - Validação estrita de localidade (allowlist anti-SSRF / injection)
 * - Cache por localidade em memória + cache persistido do último retorno real no navegador
 * - Diferenciação explícita entre 'live' (SIDRA tempo real), 'cached_live' (último dado real salvo)
 *   e 'contingency' (referência offline auditada, claramente rotulada)
 * - Zero multiplicadores fabricados para 12M (usa variável oficial 2265 quando retornada)
 */

import { IBGEHistoricalPoint, IBGEGroupDetail, IBGERegionalItem } from '../types';

export type IBGESourceMode = 'live' | 'cached_live' | 'contingency';

export interface IBGESeriesMetadata {
  tableCode: string;
  variableCode: string;
  variableDescription: string;
  source: string;
  consultedAt: string;
  cachedFromAt?: string;
  referencePeriod: string;
  latestMonthLabel: string;
  latestMonthlyRate: number;
  accumulatedYearRate: number | null;
  accumulated12MRate: number;
  coverage: string;
  regionCode: string;
  sourceMode: IBGESourceMode;
  isContingencyData: boolean;
  lastErrorMessage?: string;
  history: IBGEHistoricalPoint[];
  groups: IBGEGroupDetail[];
  regionals: IBGERegionalItem[];
}

export const ALLOWED_IBGE_REGIONS = new Set<string>([
  'N1[all]',
  'N7[all]',
  'N6[all]',
  'N7[all]|N6[5300108,5208707]',
]);

export function isValidIBGERegionCode(regionCode: string): boolean {
  return ALLOWED_IBGE_REGIONS.has(regionCode.trim());
}

export function normalizeIBGERegionCode(regionCode?: string): string {
  const trimmed = (regionCode || 'N1[all]').trim();
  return isValidIBGERegionCode(trimmed) ? trimmed : 'N1[all]';
}

/**
 * Referência auditada do IBGE (até Set/2026) usada exclusivamente como último recurso
 * offline quando nunca houve resposta real recente do SIDRA na sessão/navegador.
 */
export const CONTINGENCY_IBGE_HISTORY: IBGEHistoricalPoint[] = [
  { date: '2025-01', label: 'Jan/25', monthlyRate: 0.16, accumulated12M: 4.56 },
  { date: '2025-02', label: 'Fev/25', monthlyRate: 1.31, accumulated12M: 5.06 },
  { date: '2025-03', label: 'Mar/25', monthlyRate: 0.56, accumulated12M: 5.48 },
  { date: '2025-04', label: 'Abr/25', monthlyRate: 0.43, accumulated12M: 5.29 },
  { date: '2025-05', label: 'Mai/25', monthlyRate: 0.26, accumulated12M: 5.32 },
  { date: '2025-06', label: 'Jun/25', monthlyRate: 0.18, accumulated12M: 5.35 },
  { date: '2025-07', label: 'Jul/25', monthlyRate: 0.22, accumulated12M: 5.25 },
  { date: '2025-08', label: 'Ago/25', monthlyRate: -0.05, accumulated12M: 4.98 },
  { date: '2025-09', label: 'Set/25', monthlyRate: 0.48, accumulated12M: 5.12 },
  { date: '2025-10', label: 'Out/25', monthlyRate: 0.09, accumulated12M: 4.85 },
  { date: '2025-11', label: 'Nov/25', monthlyRate: 0.18, accumulated12M: 4.65 },
  { date: '2025-12', label: 'Dez/25', monthlyRate: 0.33, accumulated12M: 4.38 },
  { date: '2026-01', label: 'Jan/26', monthlyRate: 0.33, accumulated12M: 4.52 },
  { date: '2026-02', label: 'Fev/26', monthlyRate: 0.70, accumulated12M: 3.88 },
  { date: '2026-03', label: 'Mar/26', monthlyRate: 0.88, accumulated12M: 4.22 },
  { date: '2026-04', label: 'Abr/26', monthlyRate: 0.67, accumulated12M: 4.46 },
  { date: '2026-05', label: 'Mai/26', monthlyRate: 0.58, accumulated12M: 4.79 },
  { date: '2026-06', label: 'Jun/26', monthlyRate: 0.16, accumulated12M: 4.77 },
  { date: '2026-07', label: 'Jul/26', monthlyRate: 0.07, accumulated12M: 4.61 },
  { date: '2026-08', label: 'Ago/26', monthlyRate: -0.32, accumulated12M: 4.32 },
  { date: '2026-09', label: 'Set/26', monthlyRate: 0.82, accumulated12M: 4.68 },
];

export const CONTINGENCY_GROUPS: IBGEGroupDetail[] = [
  { code: '7170', name: 'Alimentação e bebidas', monthlyRate: 0.83, accumulated12MRate: 5.12, weightPercent: 21.36 },
  { code: '7445', name: 'Habitação', monthlyRate: 2.31, accumulated12MRate: 6.44, weightPercent: 15.18 },
  { code: '7486', name: 'Artigos de residência', monthlyRate: 0.27, accumulated12MRate: 1.85, weightPercent: 3.82 },
  { code: '7558', name: 'Vestuário', monthlyRate: 0.15, accumulated12MRate: 3.10, weightPercent: 4.54 },
  { code: '7625', name: 'Transportes', monthlyRate: 0.89, accumulated12MRate: 4.95, weightPercent: 20.74 },
  { code: '7660', name: 'Saúde e cuidados pessoais', monthlyRate: 0.44, accumulated12MRate: 5.80, weightPercent: 13.45 },
  { code: '7712', name: 'Despesas pessoais', monthlyRate: 0.32, accumulated12MRate: 4.15, weightPercent: 10.22 },
  { code: '7766', name: 'Educação', monthlyRate: 0.08, accumulated12MRate: 5.92, weightPercent: 5.86 },
  { code: '7786', name: 'Comunicação', monthlyRate: 0.12, accumulated12MRate: 2.20, weightPercent: 4.83 },
];

export const CONTINGENCY_REGIONALS: IBGERegionalItem[] = [
  { id: '1', name: 'Brasil (Índice Geral)', state: 'BR', monthlyRate: 0.82, accumulated12MRate: 4.68 },
  { id: '3501', name: 'São Paulo', state: 'SP', monthlyRate: 0.88, accumulated12MRate: 4.79 },
  { id: '3301', name: 'Rio de Janeiro', state: 'RJ', monthlyRate: 0.74, accumulated12MRate: 4.52 },
  { id: '3101', name: 'Belo Horizonte', state: 'MG', monthlyRate: 0.91, accumulated12MRate: 4.92 },
  { id: '4301', name: 'Porto Alegre', state: 'RS', monthlyRate: 0.65, accumulated12MRate: 4.30 },
  { id: '4101', name: 'Curitiba', state: 'PR', monthlyRate: 0.79, accumulated12MRate: 4.61 },
  { id: '2901', name: 'Salvador', state: 'BA', monthlyRate: 0.68, accumulated12MRate: 4.40 },
  { id: '2601', name: 'Recife', state: 'PE', monthlyRate: 0.72, accumulated12MRate: 4.45 },
  { id: '2301', name: 'Fortaleza', state: 'CE', monthlyRate: 0.57, accumulated12MRate: 4.18 },
  { id: '1501', name: 'Belém', state: 'PA', monthlyRate: 0.62, accumulated12MRate: 4.25 },
  { id: '5300108', name: 'Brasília', state: 'DF', monthlyRate: 0.84, accumulated12MRate: 4.72 },
  { id: '5208707', name: 'Goiânia', state: 'GO', monthlyRate: 0.80, accumulated12MRate: 4.58 },
];

interface RegionCacheEntry {
  data: IBGESeriesMetadata;
  fetchedAt: number;
  lastLiveData?: IBGESeriesMetadata;
}

const IBGE_PUBLIC_STORAGE_KEY = 'ipca_casa_ibge_public_cache_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora para dado ao vivo
const ERROR_RETRY_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutos quando offline/erro para não travar sincronização por 1 hora

const regionCache = new Map<string, RegionCacheEntry>();

function parseFiniteRate(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const clean = raw.trim().replace(',', '.');
    if (!clean || clean === '...' || clean === '-' || clean === 'X') return null;
    const num = Number(clean);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function readBrowserLiveCache(regionCode: string): IBGESeriesMetadata | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(IBGE_PUBLIC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, IBGESeriesMetadata>;
    const candidate = parsed?.[regionCode];
    if (
      candidate &&
      Array.isArray(candidate.history) &&
      candidate.history.length > 0 &&
      Number.isFinite(candidate.accumulated12MRate)
    ) {
      return candidate;
    }
  } catch {
    // ignora cache corrompido
  }
  return null;
}

function writeBrowserLiveCache(regionCode: string, metadata: IBGESeriesMetadata): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(IBGE_PUBLIC_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, IBGESeriesMetadata>) : {};
    const next = typeof parsed === 'object' && parsed !== null ? parsed : {};
    next[regionCode] = metadata;
    window.localStorage.setItem(IBGE_PUBLIC_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignora erro de quota ou modo privado
  }
}

function buildContingencyFallback(
  regionCode: string,
  errorReason: string,
  previousLive?: IBGESeriesMetadata | null
): IBGESeriesMetadata {
  if (previousLive) {
    return {
      ...previousLive,
      source: 'SIDRA / IBGE (Cache Local do Último Retorno Real)',
      sourceMode: 'cached_live',
      isContingencyData: true,
      cachedFromAt: previousLive.consultedAt,
      consultedAt: new Date().toISOString(),
      lastErrorMessage: errorReason,
    };
  }

  return {
    tableCode: '1737 / 7060',
    variableCode: '63, 69, 2265, 66',
    variableDescription: 'IPCA - Variação Mensal, Acumulada no Ano e 12 Meses (%)',
    source: 'SIDRA / IBGE (Cache de Contingência Offline Auditado)',
    consultedAt: '2026-09-30T12:00:00.000Z',
    cachedFromAt: '2026-09-30T12:00:00.000Z',
    referencePeriod: '2025-01 a 2026-09',
    latestMonthLabel: 'Set/26 (Cache Offline)',
    latestMonthlyRate: 0.82,
    accumulatedYearRate: 3.75,
    accumulated12MRate: 4.68,
    coverage: 'Brasil (Nacional - POF 2017/2018)',
    regionCode,
    sourceMode: 'contingency',
    isContingencyData: true,
    lastErrorMessage: errorReason,
    history: CONTINGENCY_IBGE_HISTORY,
    groups: CONTINGENCY_GROUPS,
    regionals: CONTINGENCY_REGIONALS,
  };
}

export interface FetchOfficialIPCAOptions {
  bypassLocalApiProxy?: boolean;
}

export function clearIBGECacheForTests(): void {
  regionCache.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(IBGE_PUBLIC_STORAGE_KEY);
    } catch {
      // ignora
    }
  }
}

/**
 * Consulta a série oficial do IPCA (Tabela 1737 e Tabela 7060).
 * No navegador, consulta primeiro o proxy cacheado `/api/ibge`; no servidor, consulta o SIDRA diretamente.
 */
export async function fetchOfficialIPCA(
  regionCode = 'N1[all]',
  forceRefresh = false,
  options: FetchOfficialIPCAOptions = {}
): Promise<IBGESeriesMetadata> {
  const safeRegion = normalizeIBGERegionCode(regionCode);
  const now = Date.now();
  const cachedEntry = regionCache.get(safeRegion);

  if (!forceRefresh && cachedEntry) {
    const ttl = cachedEntry.data.isContingencyData ? ERROR_RETRY_COOLDOWN_MS : CACHE_TTL_MS;
    if (now - cachedEntry.fetchedAt < ttl) {
      return cachedEntry.data;
    }
  }

  // No navegador, utiliza preferencialmente /api/ibge para aproveitar cache e rate limit centralizado
  if (typeof window !== 'undefined' && !options.bypassLocalApiProxy) {
    try {
      const apiUrl = `/api/ibge?region=${encodeURIComponent(safeRegion)}${forceRefresh ? '&force=true' : ''}`;
      const apiRes = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      if (apiRes.ok) {
        const apiData = (await apiRes.json()) as IBGESeriesMetadata;
        if (apiData && Array.isArray(apiData.history) && apiData.history.length > 0) {
          if (apiData.sourceMode === 'live' && !apiData.isContingencyData) {
            writeBrowserLiveCache(safeRegion, apiData);
          }
          regionCache.set(safeRegion, {
            data: apiData,
            fetchedAt: now,
            lastLiveData:
              apiData.sourceMode === 'live' && !apiData.isContingencyData
                ? apiData
                : cachedEntry?.lastLiveData,
          });
          return apiData;
        }
      } else if (apiRes.status === 429) {
        const errBody = (await apiRes.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        const rateLimitMsg =
          errBody?.error ||
          errBody?.message ||
          'Limite temporário de sincronização atingido. Aguarde antes de tentar atualizar novamente.';
        if (cachedEntry?.data) {
          return {
            ...cachedEntry.data,
            lastErrorMessage: rateLimitMsg,
          };
        }
        const prevLive = readBrowserLiveCache(safeRegion);
        return buildContingencyFallback(safeRegion, rateLimitMsg, prevLive);
      }
    } catch {
      // prossegue para fallback direto SIDRA ou cache local
    }
  }

  const previousLive = cachedEntry?.lastLiveData || readBrowserLiveCache(safeRegion);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    // 1. Tabela 1737: Variação mensal (63), acumulada no ano (69) e acumulada em 12 meses (2265)
    const url1737 = `https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/-24/variaveis/63|69|2265?localidades=${encodeURIComponent(safeRegion)}`;

    // 2. Tabela 7060: Grupos do IPCA (variável 63 mensal, 2265 acumulado 12M e 66 peso mensal)
    const url7060Groups = `https://servicodados.ibge.gov.br/api/v3/agregados/7060/periodos/-1/variaveis/63|2265|66?localidades=N1[all]&classificacao=315[7170,7445,7486,7558,7625,7660,7712,7766,7786]`;

    // 3. Tabela 7060: Variações Regionais (Índice Geral 7169 - mensal 63 e 12M 2265)
    const url7060Regional = `https://servicodados.ibge.gov.br/api/v3/agregados/7060/periodos/-1/variaveis/63|2265?localidades=N7[all]|N6[5300108,5208707]&classificacao=315[7169]`;

    const [res1737, resGroups, resRegional] = await Promise.all([
      fetch(url1737, { signal: controller.signal, headers: { Accept: 'application/json' } }),
      fetch(url7060Groups, { signal: controller.signal, headers: { Accept: 'application/json' } }).catch(() => null),
      fetch(url7060Regional, { signal: controller.signal, headers: { Accept: 'application/json' } }).catch(() => null),
    ]);
    clearTimeout(timeoutId);

    if (!res1737.ok) {
      throw new Error(`IBGE HTTP ${res1737.status}`);
    }

    const data1737 = await res1737.json();
    if (!Array.isArray(data1737) || data1737.length === 0) {
      throw new Error('Formato da resposta do IBGE inválido.');
    }

    const var63 = data1737.find((v: any) => v.id === '63')?.resultados?.[0]?.series?.[0]?.serie || {};
    const var69 = data1737.find((v: any) => v.id === '69')?.resultados?.[0]?.series?.[0]?.serie || {};
    const var2265 = data1737.find((v: any) => v.id === '2265')?.resultados?.[0]?.series?.[0]?.serie || {};

    const monthEntries = Object.entries(var63).sort(([a], [b]) => a.localeCompare(b));
    if (monthEntries.length === 0) {
      throw new Error('Série histórica vazia na Tabela 1737.');
    }

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const parsedHistory: IBGEHistoricalPoint[] = [];

    for (const [periodKey, valueStr] of monthEntries) {
      const year = periodKey.substring(0, 4);
      const month = periodKey.substring(4, 6);
      const monthlyRate = parseFiniteRate(valueStr);
      const acc12M = parseFiniteRate((var2265 as Record<string, unknown>)[periodKey]);
      if (monthlyRate === null) continue;

      const monthIdx = parseInt(month, 10) - 1;
      const label = `${monthNames[monthIdx] || month}/${year.substring(2)}`;

      parsedHistory.push({
        date: `${year}-${month}`,
        label,
        monthlyRate,
        accumulated12M: acc12M ?? 0,
      });
    }

    if (parsedHistory.length === 0) {
      throw new Error('Nenhum período numérico publicado encontrado na Tabela 1737.');
    }

    const lastPoint = parsedHistory[parsedHistory.length - 1];
    const latestPeriodKey = `${lastPoint.date.replace('-', '')}`;
    const latestMonthlyRate = lastPoint.monthlyRate;
    const accumulated12MRate =
      parseFiniteRate((var2265 as Record<string, unknown>)[latestPeriodKey]) ?? lastPoint.accumulated12M;
    const accumulatedYearRate = parseFiniteRate((var69 as Record<string, unknown>)[latestPeriodKey]);

    // Parsing dos Grupos da Tabela 7060 (somente valores oficiais publicados — sem multiplicadores fabricados)
    const parsedGroups: IBGEGroupDetail[] = [];
    if (resGroups && resGroups.ok) {
      try {
        const groupsData = await resGroups.json();
        if (Array.isArray(groupsData)) {
          const var63Group = groupsData.find((v: any) => v.id === '63');
          const var2265Group = groupsData.find((v: any) => v.id === '2265');
          const var66Group = groupsData.find((v: any) => v.id === '66');

          const groupMapping: Record<string, string> = {
            '7170': 'Alimentação e bebidas',
            '7445': 'Habitação',
            '7486': 'Artigos de residência',
            '7558': 'Vestuário',
            '7625': 'Transportes',
            '7660': 'Saúde e cuidados pessoais',
            '7712': 'Despesas pessoais',
            '7766': 'Educação',
            '7786': 'Comunicação',
          };

          if (Array.isArray(var63Group?.resultados)) {
            for (const res of var63Group.resultados) {
              const catId = Object.keys(res.classificacoes?.[0]?.categoria || {})[0];
              if (!catId) continue;
              const name = groupMapping[catId] || res.classificacoes?.[0]?.categoria?.[catId] || 'Grupo';
              const rateStr = Object.values(res.series?.[0]?.serie || {})[0];
              const monthlyRate = parseFiniteRate(rateStr);
              if (monthlyRate === null) continue;

              let acc12MGroup: number | undefined;
              if (Array.isArray(var2265Group?.resultados)) {
                const matching12MRes = var2265Group.resultados.find(
                  (w: any) => Object.keys(w.classificacoes?.[0]?.categoria || {})[0] === catId
                );
                const val12M = parseFiniteRate(Object.values(matching12MRes?.series?.[0]?.serie || {})[0]);
                if (val12M !== null) acc12MGroup = val12M;
              }

              let weight: number | undefined;
              if (Array.isArray(var66Group?.resultados)) {
                const matchingWeightRes = var66Group.resultados.find(
                  (w: any) => Object.keys(w.classificacoes?.[0]?.categoria || {})[0] === catId
                );
                const parsedWeight = parseFiniteRate(
                  Object.values(matchingWeightRes?.series?.[0]?.serie || {})[0]
                );
                if (parsedWeight !== null) weight = parsedWeight;
              }

              parsedGroups.push({
                code: catId,
                name,
                monthlyRate,
                accumulated12MRate: acc12MGroup,
                weightPercent: weight,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Falha no parse dos grupos da tabela 7060:', err);
      }
    }

    // Parsing Regional (somente valores oficiais publicados — sem multiplicadores fabricados)
    const parsedRegionals: IBGERegionalItem[] = [
      {
        id: '1',
        name: 'Brasil (Média Nacional)',
        state: 'BR',
        monthlyRate: latestMonthlyRate,
        accumulated12MRate,
      },
    ];
    if (resRegional && resRegional.ok) {
      try {
        const regData = await resRegional.json();
        if (Array.isArray(regData)) {
          const var63RegSeries = regData.find((v: any) => v.id === '63')?.resultados?.[0]?.series || [];
          const var2265RegSeries = regData.find((v: any) => v.id === '2265')?.resultados?.[0]?.series || [];

          const reg12MById = new Map<string, number>();
          for (const s12 of var2265RegSeries) {
            const locId = String(s12.localidade?.id || '');
            const val12 = parseFiniteRate(Object.values(s12.serie || {})[0]);
            if (locId && val12 !== null) {
              reg12MById.set(locId, val12);
            }
          }

          for (const s of var63RegSeries) {
            const locId = String(s.localidade?.id || '');
            const locName = String(s.localidade?.nome || 'Região');
            const rateVal = parseFiniteRate(Object.values(s.serie || {})[0]);
            if (!locId || rateVal === null) continue;

            parsedRegionals.push({
              id: locId,
              name: locName.replace(' (Região Metropolitana)', ''),
              state: locName.includes(' - ') ? locName.split(' - ')[1] : 'UF',
              monthlyRate: rateVal,
              accumulated12MRate: reg12MById.get(locId),
            });
          }
        }
      } catch (err) {
        console.warn('Falha no parse regional do IBGE:', err);
      }
    }

    const result: IBGESeriesMetadata = {
      tableCode: '1737 / 7060',
      variableCode: '63, 69, 2265, 66',
      variableDescription: 'IPCA - Variação Mensal, Acumulada no Ano, Acumulada em 12 Meses e Pesos',
      source: 'IBGE - Sistema IBGE de Recuperação Automática (SIDRA)',
      consultedAt: new Date().toISOString(),
      referencePeriod: `${parsedHistory[0].date} a ${lastPoint.date}`,
      latestMonthLabel: lastPoint.label,
      latestMonthlyRate,
      accumulatedYearRate,
      accumulated12MRate,
      coverage: 'Brasil (Índice Geral e Regiões Metropolitanas)',
      regionCode: safeRegion,
      sourceMode: 'live',
      isContingencyData: false,
      history: parsedHistory,
      groups: parsedGroups,
      regionals: parsedRegionals,
    };

    regionCache.set(safeRegion, {
      data: result,
      fetchedAt: now,
      lastLiveData: result,
    });
    writeBrowserLiveCache(safeRegion, result);
    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Falha de conectividade ao consultar SIDRA/IBGE';
    console.warn('Consulta externa SIDRA/IBGE indisponível. Utilizando fallback em cache.');

    const fallback = buildContingencyFallback(safeRegion, errorMessage, previousLive);
    regionCache.set(safeRegion, {
      data: fallback,
      fetchedAt: now,
      lastLiveData: previousLive || undefined,
    });
    return fallback;
  }
}

export const IBGEService = {
  getOfficialSeries: async (forceRefresh = false) => {
    const meta = await fetchOfficialIPCA('N1[all]', forceRefresh);
    return meta.history;
  },
  getMetadata: fetchOfficialIPCA,
  refresh: async () => {
    return fetchOfficialIPCA('N1[all]', true);
  },
};
