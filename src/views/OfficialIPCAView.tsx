import React, { useState, useEffect } from 'react';
import { IBGESeriesMetadata, fetchOfficialIPCA, getOfficialBenchmarkForTimeframe } from '../services/ibge';
import { IBGEHistoricalPoint } from '../types';
import { trackViewIpca } from '../services/analytics';
import { formatIsoDateBR } from '../utils/dates';

interface OfficialIPCAViewProps {
  onNavigateTab?: (tab: any) => void;
  analyticsSurface?: 'public' | 'dashboard';
}

function formatSignedRate(val: number | null | undefined, digits = 2): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(digits).replace('.', ',')}%`;
}

export const OfficialIPCAView: React.FC<OfficialIPCAViewProps> = ({
  analyticsSurface = 'dashboard',
}) => {
  const [metadata, setMetadata] = useState<IBGESeriesMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframeFilter, setTimeframeFilter] = useState<'12M' | '24M'>('12M');
  const [selectedRegion, setSelectedRegion] = useState<string>('1'); // '1' = Brasil
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const scopeForRegion = (regionId: string) => (regionId === '1' ? 'N1[all]' : regionId);

  const loadData = async (force = false, regionId = selectedRegion) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchOfficialIPCA(scopeForRegion(regionId), force);
      setMetadata(data);
      trackViewIpca({
        surface: analyticsSurface,
        timeframe: timeframeFilter,
        source_mode: data.isContingencyData ? 'cache' : 'live',
      });
      if (force) {
        if (data.sourceMode === 'live' && !data.isContingencyData) {
          setFeedbackMessage(
            data.lastErrorMessage ||
              `Dados oficiais do IBGE sincronizados com sucesso para ${data.coverage}!`
          );
        } else if (data.sourceMode === 'cached_live') {
          setFeedbackMessage(
            `Consulta externa ao IBGE indisponível no momento. Exibindo o último retorno real em cache (Ref. ${data.latestMonthLabel}).`
          );
        } else {
          setFeedbackMessage(
            `Consulta externa ao IBGE indisponível no momento. Exibindo dados de contingência offline (Ref. ${data.latestMonthLabel}).`
          );
        }
        setTimeout(() => setFeedbackMessage(null), 5000);
      }
    } catch (err) {
      console.error('Falha ao carregar IBGE:', err);
      setFeedbackMessage(
        'Não foi possível obter dados em tempo real. Exibindo referência offline de contingência.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false, selectedRegion);
  }, [selectedRegion]);

  if (loading && !metadata) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <span className="material-symbols-outlined text-[32px] text-[#497cff] animate-spin">
          sync
        </span>
        <span className="font-mono text-xs text-[#45464d]">
          Consultando serviço oficial de dados abertos do IBGE (SIDRA)...
        </span>
      </div>
    );
  }

  const meta = metadata!;
  const filteredHistory: IBGEHistoricalPoint[] =
    timeframeFilter === '12M' ? meta.history.slice(-12) : meta.history.slice(-24);

  const maxAbsRate = Math.max(
    0.5,
    ...filteredHistory.map((p) => (Number.isFinite(p.monthlyRate) ? Math.abs(p.monthlyRate) : 0))
  );

  // Região selecionada para exibição e checagem de completude de períodos
  const activeRegional = meta.regionals.find((r) => r.id === selectedRegion) || meta.regionals[0];
  const benchmark12M = getOfficialBenchmarkForTimeframe(meta, '12M');
  const benchmarkYtd = getOfficialBenchmarkForTimeframe(meta, 'YTD');

  const sourceBannerText =
    meta.sourceMode === 'live' && !meta.isContingencyData
      ? `Conexão em Tempo Real com API SIDRA / IBGE (${meta.coverage})`
      : meta.sourceMode === 'cached_live'
      ? `Cache Local do Último Retorno Real (SIDRA) — Referência ${meta.latestMonthLabel}`
      : `Dados em Contingência Offline — Referência ${meta.latestMonthLabel}`;

  const sourceDotClass =
    meta.sourceMode === 'live' && !meta.isContingencyData
      ? 'bg-[#006a61] animate-pulse'
      : meta.sourceMode === 'cached_live'
      ? 'bg-[#b45309]'
      : 'bg-[#ba1a1a]';

  return (
    <div className="flex flex-col w-full px-6 lg:px-12 py-8 max-w-[1440px] mx-auto gap-8">
      {/* Sub-Header Ribbon */}
      <div className="p-3 bg-[#eff4ff] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-[#e5eeff]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${sourceDotClass}`} />
          <span className="font-mono text-xs uppercase tracking-wider text-[#45464d] font-semibold">
            {sourceBannerText}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-[#45464d]">
          <span>Ref: {meta.latestMonthLabel}</span>
          <span className="text-[#c6c6cd]">•</span>
          <span>
            {meta.sourceMode === 'cached_live' && meta.cachedFromAt
              ? `Cache de: ${formatIsoDateBR(meta.cachedFromAt)}`
              : meta.isContingencyData
              ? `Contingência (consultado ${formatIsoDateBR(meta.consultedAt)})`
              : `Sincronizado: ${new Date(meta.consultedAt).toLocaleString('pt-BR')}`}
          </span>
        </div>
      </div>

      {meta.isContingencyData && (
        <div className="p-3 bg-[#ffdad6]/30 border border-[#ba1a1a]/25 rounded-xl text-xs font-mono text-[#93000a] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] shrink-0">cloud_off</span>
          <span>
            Consulta oficial ao SIDRA falhou{meta.lastErrorMessage ? ` (${meta.lastErrorMessage})` : ''}. Exibindo série histórica de contingência offline ({meta.latestMonthLabel}) — não corresponde a uma consulta atualizada em tempo real.
          </span>
        </div>
      )}

      {(benchmark12M.completenessNote || benchmarkYtd.completenessNote) && (
        <div className="p-3 bg-[#eff4ff] border border-[#dce9ff] rounded-xl text-xs font-mono text-[#45464d] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#497cff] shrink-0">info</span>
          <span>
            {benchmark12M.completenessNote || benchmarkYtd.completenessNote}
          </span>
        </div>
      )}

      {feedbackMessage && (
        <div className="p-3 bg-[#86f2e4]/20 border border-[#006a61]/30 rounded-xl text-xs font-mono text-[#006a61] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>{feedbackMessage}</span>
          </div>
          <button type="button" onClick={() => setFeedbackMessage(null)} className="text-[#006a61] font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#497cff] font-mono text-xs uppercase tracking-wider font-semibold">
            <span className="material-symbols-outlined text-[18px]">public</span>
            <span>Estatísticas Oficiais Macroeconômicas</span>
          </div>
          <h1 className="text-3xl font-bold text-[#0b1c30] tracking-tight mt-1">
            IPCA Oficial do IBGE
          </h1>
          <p className="text-xs text-[#45464d] mt-1 max-w-2xl">
            Série histórica oficial do Índice Nacional de Preços ao Consumidor Amplo (IPCA), obtida diretamente das Tabelas 1737 e 7060 do SIDRA/IBGE.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadData(true, selectedRegion)}
            disabled={refreshing}
            className="h-9 px-4 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${refreshing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{refreshing ? 'Atualizando...' : 'Atualizar Dados do IBGE'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Oficiais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Último Mês Publicado */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#eff4ff] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">
              Última Variação Mensal
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#497cff]">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-bold font-mono tracking-tight text-[#0b1c30]">
              {formatSignedRate(meta.latestMonthlyRate)}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">Mês de referência: {meta.latestMonthLabel}</span>
          </div>
          <div className="pt-2 border-t border-[#eff4ff] text-[11px] font-mono text-[#76777d]">
            Tabela 1737 • Variável 63
          </div>
        </div>

        {/* Card 2: Acumulado no Ano */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#eff4ff] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">
              Acumulado no Ano (YTD)
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#006a61]">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-bold font-mono tracking-tight text-[#006a61]">
              {formatSignedRate(meta.accumulatedYearRate)}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">
              {meta.accumulatedYearRate !== null
                ? `Janeiro até ${meta.latestMonthLabel}`
                : 'Não divulgado para o período'}
            </span>
          </div>
          <div className="pt-2 border-t border-[#eff4ff] text-[11px] font-mono text-[#76777d]">
            Tabela 1737 • Variável 69
          </div>
        </div>

        {/* Card 3: Acumulado 12 Meses */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#eff4ff] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">
              Acumulado 12 Meses
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#ffdad6]/40 flex items-center justify-center text-[#ba1a1a]">
              <span className="material-symbols-outlined text-[18px]">monitoring</span>
            </span>
          </div>
          <div className="my-2">
            <div
              className={`text-3xl font-bold font-mono tracking-tight ${
                meta.accumulated12MRate < 0 ? 'text-[#006a61]' : 'text-[#ba1a1a]'
              }`}
            >
              {formatSignedRate(meta.accumulated12MRate)}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">Taxa de inflação oficial de 1 ano</span>
          </div>
          <div className="pt-2 border-t border-[#eff4ff] text-[11px] font-mono text-[#76777d]">
            Tabela 1737 • Variável 2265
          </div>
        </div>

        {/* Card 4: Cobertura e Abrangência */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#eff4ff] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">
              Região / Localidade
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#7c839b]">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
            </span>
          </div>
          <div className="my-2">
            <div className="text-lg font-bold font-mono tracking-tight text-[#0b1c30] truncate">
              {activeRegional?.name || 'Brasil (Nacional)'}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">
              Variação local: {formatSignedRate(activeRegional?.monthlyRate)}
            </span>
          </div>
          <div className="pt-2 border-t border-[#eff4ff] text-[11px] font-mono text-[#76777d]">
            POF 2017/2018 (Famílias 1 a 40 SM)
          </div>
        </div>
      </div>

      {/* Gráfico Histórico Oficial e Filtros */}
      <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#eff4ff]">
          <div>
            <h2 className="text-base font-bold text-[#0b1c30]">
              Evolução Histórica do IPCA Oficial
            </h2>
            <p className="text-xs text-[#45464d]">
              Série de variações mensais divulgadas pelo IBGE nos últimos {timeframeFilter === '12M' ? '12 meses' : '24 meses'}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#eff4ff] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setTimeframeFilter('12M');
                  trackViewIpca({
                    surface: analyticsSurface,
                    timeframe: '12M',
                    source_mode: meta.isContingencyData ? 'cache' : 'live',
                  });
                }}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  timeframeFilter === '12M'
                    ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm'
                    : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                12 Meses
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeframeFilter('24M');
                  trackViewIpca({
                    surface: analyticsSurface,
                    timeframe: '24M',
                    source_mode: meta.isContingencyData ? 'cache' : 'live',
                  });
                }}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  timeframeFilter === '24M'
                    ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm'
                    : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                24 Meses
              </button>
            </div>
          </div>
        </div>

        {/* Visual Bar Chart */}
        {filteredHistory.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="h-48 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-[#eff4ff]">
              {filteredHistory.map((point) => {
                const heightPercent = Math.min(
                  100,
                  Math.max(10, (Math.abs(point.monthlyRate) / maxAbsRate) * 100)
                );
                const isPositive = point.monthlyRate >= 0;
                return (
                  <div key={point.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#131b2e] text-[#ffffff] font-mono text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                      {point.label}: {formatSignedRate(point.monthlyRate)}
                    </div>

                    <span className="font-mono text-[9px] text-[#45464d] group-hover:text-[#0b1c30]">
                      {point.monthlyRate.toFixed(2)}%
                    </span>
                    <div className="w-full h-32 flex items-end justify-center">
                      <div
                        className={`w-full max-w-[28px] rounded-t transition-all ${
                          isPositive ? 'bg-[#497cff] hover:bg-[#213145]' : 'bg-[#006a61] hover:bg-[#004e47]'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-[#76777d] truncate w-full text-center">
                      {point.label.split('/')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-[#76777d] font-mono pt-1">
              <span>Início: {filteredHistory[0]?.label}</span>
              <span>Mais recente: {filteredHistory[filteredHistory.length - 1]?.label}</span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs font-mono text-[#76777d]">
            Série histórica mensal ainda não disponível para esta localidade.
          </div>
        )}
      </div>

      {/* Breakdown por Grupos Oficiais (Tabela 7060) e Filtro Regional */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Grupos do IPCA (8 colunas) */}
        <div className="lg:col-span-8 bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
            <div>
              <h2 className="text-base font-bold text-[#0b1c30]">
                Variações por Grupos de Produtos e Serviços
              </h2>
              <p className="text-xs text-[#45464d]">
                Taxas mensais, acumuladas e peso orçamentário médio na POF/IBGE (Tabela 7060).
              </p>
            </div>
            <span className="text-xs font-mono text-[#76777d]">{meta.groups.length} Grupos Oficiais</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#eff4ff] text-[11px] font-mono uppercase text-[#76777d]">
                  <th className="py-2.5 px-3">Grupo de Consumo</th>
                  <th className="py-2.5 px-3 text-right">Peso no IPCA (%)</th>
                  <th className="py-2.5 px-3 text-right">Variação Mensal</th>
                  <th className="py-2.5 px-3 text-right">Acumulado 12M</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff] text-xs">
                {meta.groups.map((grp) => (
                  <tr key={grp.code} className="hover:bg-[#eff4ff]/40 transition-colors">
                    <td className="py-3 px-3 font-medium text-[#0b1c30] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#497cff]" />
                      <span>{grp.name}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#45464d]">
                      {typeof grp.weightPercent === 'number' && Number.isFinite(grp.weightPercent)
                        ? `${grp.weightPercent.toFixed(2).replace('.', ',')}%`
                        : '—'}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-bold ${
                        grp.monthlyRate > 0 ? 'text-[#ba1a1a]' : grp.monthlyRate < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                      }`}
                    >
                      {formatSignedRate(grp.monthlyRate)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#45464d]">
                      {typeof grp.accumulated12MRate === 'number' && Number.isFinite(grp.accumulated12MRate)
                        ? formatSignedRate(grp.accumulated12MRate)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filtro e Comparativo Regional (4 colunas) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#eff4ff]">
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#006a61]">
                <span className="material-symbols-outlined text-[20px]">map</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0b1c30]">
                  Inflação por Região
                </h2>
                <p className="text-xs text-[#45464d]">
                  Selecione uma localidade para comparar com a média nacional.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">Selecione a Região:</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              >
                {meta.regionals.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.state})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-[#eff4ff] rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0b1c30]">{activeRegional.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ffffff] text-[#0b1c30]">
                  {activeRegional.state}
                </span>
              </div>
              {activeRegional.isEstimatedFromNational && (
                <span className="text-[11px] font-mono text-[#93000a] bg-[#ffdad6]/40 px-2 py-1 rounded">
                  Série regional offline não disponível: valor exibido reflete a média nacional de contingência.
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#45464d]">Variação do Mês:</span>
                <span className="text-xl font-bold font-mono text-[#0b1c30]">
                  {activeRegional.monthlyRate >= 0 ? '+' : ''}
                  {activeRegional.monthlyRate.toFixed(2).replace('.', ',')}%
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs text-[#45464d]">
                <span>Diferença vs. Brasil:</span>
                <span className="font-mono font-semibold">
                  {(activeRegional.monthlyRate - meta.latestMonthlyRate) >= 0 ? '+' : ''}
                  {(activeRegional.monthlyRate - meta.latestMonthlyRate).toFixed(2).replace('.', ',')} p.p.
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              <span className="text-[11px] font-mono text-[#76777d] uppercase">Todas as Capitais / RMs</span>
              {meta.regionals.map((reg) => (
                <div
                  key={reg.id}
                  onClick={() => setSelectedRegion(reg.id)}
                  className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    reg.id === selectedRegion
                      ? 'bg-[#131b2e] text-[#ffffff] font-semibold'
                      : 'hover:bg-[#eff4ff] text-[#0b1c30]'
                  }`}
                >
                  <span>{reg.name}</span>
                  <span className="font-mono">
                    {reg.monthlyRate >= 0 ? '+' : ''}
                    {reg.monthlyRate.toFixed(2).replace('.', ',')}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Metodologia Oficial IBGE */}
          <div className="bg-[#ffffff] rounded-2xl p-5 shadow-sm border border-[#eff4ff] flex flex-col gap-2 text-xs text-[#45464d]">
            <span className="font-mono text-xs font-bold text-[#0b1c30] uppercase">
              Nota Metodológica Oficial
            </span>
            <p className="leading-relaxed text-[11px]">
              O IPCA tem por objetivo medir a inflação de um conjunto de produtos e serviços comercializados no varejo, referentes ao consumo pessoal das famílias cujo rendimento varia entre 1 e 40 salários mínimos.
            </p>
            <p className="leading-relaxed text-[11px]">
              A pesquisa é realizada continuamente pelo IBGE em estabelecimentos comerciais, prestadores de serviços, domicílios e concessionárias de serviços públicos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
