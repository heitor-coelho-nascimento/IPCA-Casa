import React, { useMemo, useState } from 'react';
import { EconomicCalculationSummary, ProfileMode } from '../types';
import { NavTab } from '../components/Sidebar';
import { IBGESeriesMetadata } from '../services/ibge';
import { calculateSpreadPP } from '../services/economics';
import { formatDateRangeLabel } from '../utils/dates';
import { getProfileModeCopy } from '../utils/profileMode';

type AnalysisTimeframe = '12M' | 'YTD' | '1M';

interface InflationAnalysisViewProps {
  summary: EconomicCalculationSummary;
  ibgeData?: IBGESeriesMetadata | null;
  activeTimeframe?: AnalysisTimeframe;
  onSelectTimeframe?: (tf: AnalysisTimeframe) => void;
  onNavigateTab: (tab: NavTab) => void;
  isDemo: boolean;
  profileMode?: ProfileMode;
}

function formatSignedPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(decimals).replace('.', ',')}%`;
}

function formatSignedPP(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(decimals).replace('.', ',')} p.p.`;
}

function formatCurrencyBR(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const InflationAnalysisView: React.FC<InflationAnalysisViewProps> = ({
  summary,
  ibgeData,
  activeTimeframe,
  onSelectTimeframe,
  onNavigateTab,
  isDemo,
  profileMode = 'pessoal',
}) => {
  const modeCopy = getProfileModeCopy(profileMode);
  const isBiz = modeCopy.mode === 'negocio';
  const [showFormula, setShowFormula] = useState(false);
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [filterText, setFilterText] = useState('');
  const [localTimeframe, setLocalTimeframe] = useState<AnalysisTimeframe>('12M');

  const currentTimeframe = activeTimeframe ?? localTimeframe;
  const handleTimeframeClick = (tf: AnalysisTimeframe) => {
    setLocalTimeframe(tf);
    onSelectTimeframe?.(tf);
  };

  const {
    ipcaCasa12M,
    ipcaIBGE12M,
    eligibleItemsCount,
    sumOfWeights,
    groupContributions,
    calculatedItems,
    topIncreases,
    topVillains,
    purchasingPower,
  } = summary;

  // Taxa oficial alinhada ao recorte temporal selecionado quando disponível na série IBGE
  const { officialRate, officialUnit, officialSubtitle } = useMemo(() => {
    if (
      currentTimeframe === 'YTD' &&
      ibgeData?.accumulatedYearRate !== null &&
      ibgeData?.accumulatedYearRate !== undefined &&
      Number.isFinite(ibgeData.accumulatedYearRate)
    ) {
      return {
        officialRate: ibgeData.accumulatedYearRate,
        officialUnit: 'no ano',
        officialSubtitle: 'Acumulado no Ano (SIDRA)',
      };
    }
    if (
      currentTimeframe === '1M' &&
      ibgeData &&
      Number.isFinite(ibgeData.latestMonthlyRate)
    ) {
      return {
        officialRate: ibgeData.latestMonthlyRate,
        officialUnit: 'no mês',
        officialSubtitle: ibgeData.latestMonthLabel
          ? `Variação Mensal (${ibgeData.latestMonthLabel})`
          : 'Último Mês Publicado',
      };
    }
    const base12M =
      ibgeData && Number.isFinite(ibgeData.accumulated12MRate)
        ? ibgeData.accumulated12MRate
        : ipcaIBGE12M;
    return {
      officialRate: base12M,
      officialUnit: 'a.a.',
      officialSubtitle: 'Média Nacional 12M (POF)',
    };
  }, [currentTimeframe, ibgeData, ipcaIBGE12M]);

  const effectiveSpreadPP = calculateSpreadPP(ipcaCasa12M, officialRate);

  const ibgeSourceStatusLabel =
    ibgeData?.sourceMode === 'live' && !ibgeData.isContingencyData
      ? 'SIDRA Tempo Real'
      : ibgeData?.sourceMode === 'cached_live'
      ? 'Cache SIDRA'
      : 'Contingência Offline';

  const baseRangeLabel = formatDateRangeLabel(
    purchasingPower.initialDate,
    purchasingPower.finalDate,
    summary.timeframeLabel
  );

  // Ranking positivo de grupos para concentração e diagnóstico
  const positiveGroups = useMemo(
    () =>
      [...groupContributions]
        .filter((g) => g.weightedContribution > 0)
        .sort((a, b) => b.weightedContribution - a.weightedContribution),
    [groupContributions]
  );

  const maxAbsGroupContribution = useMemo(
    () =>
      Math.max(
        0.01,
        ...groupContributions.map((g) => Math.abs(g.weightedContribution))
      ),
    [groupContributions]
  );

  // Itens elegíveis plotados dinamicamente no scatter plot (Peso x Variação)
  const scatterPlotData = useMemo(() => {
    const eligible = calculatedItems
      .filter((it) => it.priceChangePercent !== null)
      .sort((a, b) => Math.abs(b.weightedContribution) - Math.abs(a.weightedContribution))
      .slice(0, 8);

    if (eligible.length === 0) return [];

    const changes = eligible.map((it) => it.priceChangePercent ?? 0);
    const minChange = Math.min(0, ...changes);
    const maxChange = Math.max(10, ...changes);
    const changeSpan = Math.max(1, maxChange - minChange);
    const maxWeight = Math.max(5, ...eligible.map((it) => it.weightPercent));

    return eligible.map((item, idx) => {
      const change = item.priceChangePercent ?? 0;
      const xPercent = Math.min(
        88,
        Math.max(10, 10 + ((change - minChange) / changeSpan) * 78)
      );
      const yPercent = Math.min(
        84,
        Math.max(14, 14 + (item.weightPercent / maxWeight) * 70)
      );

      let dotColor = 'bg-[#497cff]';
      let badgeLabel = 'Impacto Moderado';
      if (change < 0) {
        dotColor = 'bg-[#006a61]';
        badgeLabel = 'Alívio no Orçamento';
      } else if (item.isVillain || item.weightedContribution >= 0.7) {
        dotColor = 'bg-[#ba1a1a]';
        badgeLabel = 'Vilão Real';
      } else if (change >= 10 && item.weightPercent < 3) {
        dotColor = 'bg-[#565e74]';
        badgeLabel = 'Efeito Manchete';
      }

      return {
        item,
        rank: idx + 1,
        xPercent,
        yPercent,
        dotColor,
        badgeLabel,
      };
    });
  }, [calculatedItems]);

  const availableGroupOptions = useMemo(
    () => Array.from(new Set(calculatedItems.map((it) => it.group))),
    [calculatedItems]
  );

  // Filtragem da tabela analítica completa
  const filteredItems = calculatedItems
    .filter((item) => {
      const matchesGroup = filterGroup === 'ALL' || item.group === filterGroup;
      const matchesText =
        !filterText ||
        item.name.toLowerCase().includes(filterText.toLowerCase()) ||
        item.group.toLowerCase().includes(filterText.toLowerCase());
      return matchesGroup && matchesText;
    })
    .sort((a, b) => b.weightedContribution - a.weightedContribution);

  const totalDisplayedContribution = filteredItems.reduce(
    (acc, it) => acc + it.weightedContribution,
    0
  );

  const sampleFormulaItem =
    topVillains[0] ||
    calculatedItems.find((it) => it.priceChangePercent !== null) ||
    null;

  return (
    <div className="flex flex-col w-full">
      {/* Top Banner / Simulation Indicator */}
      <div className="w-full bg-[#dce9ff] px-6 lg:px-12 py-2 flex items-center justify-between border-b border-[#c6c6cd]/30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#497cff] animate-pulse" />
          <span className="font-mono text-xs text-[#45464d] font-medium">
            {isDemo
              ? 'Modo demonstração — valores fictícios de consumo e preços para fins de auditoria e cálculo de Laspeyres.'
              : 'Modo Real — Cálculos auditáveis da cesta cadastrada.'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
          <span className="text-[#45464d]">
            SIDRA/IBGE Oficial:{' '}
            {ibgeData?.latestMonthLabel || 'Sincronizando...'} ({ibgeSourceStatusLabel})
          </span>
          <span className="text-[#006a61] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">verified</span> Metodologia Laspeyres Auditada
          </span>
        </div>
      </div>

      <div className="px-6 lg:px-12 py-8 flex flex-col gap-8 max-w-[1440px] mx-auto w-full">
        {/* Header Section with Metadata & Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-[#497cff] font-semibold">
                {modeCopy.badgeLabel}
              </span>
              <span className="text-[#76777d]">•</span>
              <span className="font-mono text-xs text-[#45464d]">
                {isDemo ? 'Cesta de Demonstração (Valores Fictícios)' : modeCopy.modeTitle}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-[#0b1c30] tracking-tight">
              {isBiz ? 'O Que Puxou a Alta nos Custos' : 'O Que Puxou a Alta nos Seus Gastos'}
            </h1>
            <p className="text-xs text-[#45464d] max-w-2xl leading-relaxed">
              Veja quais itens e categorias mais pesaram no seu bolso comparados à média oficial do país, sem precisar fazer contas manuais.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="bg-[#eff4ff] rounded-lg p-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleTimeframeClick('12M')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                  currentTimeframe === '12M' ? 'bg-[#ffffff] text-[#0b1c30] font-bold shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                Acumulado 12M
              </button>
              <button
                type="button"
                onClick={() => handleTimeframeClick('YTD')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                  currentTimeframe === 'YTD' ? 'bg-[#ffffff] text-[#0b1c30] font-bold shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                Ano Atual (YTD)
              </button>
              <button
                type="button"
                onClick={() => handleTimeframeClick('1M')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                  currentTimeframe === '1M' ? 'bg-[#ffffff] text-[#0b1c30] font-bold shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                Mês Anterior
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('relatorios')}
              className="flex items-center gap-1.5 bg-[#000000] text-[#ffffff] px-4 py-2 rounded-lg font-mono text-xs hover:bg-[#213145] transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Exportar Dossiê</span>
            </button>
          </div>
        </div>

        {/* 1. KPI Analytical Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: IPCA-Casa */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden border border-[#eff4ff]">
            <div
              className={`absolute top-0 left-0 w-1.5 h-full ${
                ipcaCasa12M > 0 ? 'bg-[#ba1a1a]' : ipcaCasa12M < 0 ? 'bg-[#006a61]' : 'bg-[#497cff]'
              }`}
            />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">IPCA-Casa Ponderado</span>
                <span className="text-xs text-[#76777d]">Sua inflação sentida</span>
              </div>
              <span
                className={`material-symbols-outlined text-[22px] ${
                  ipcaCasa12M > 0 ? 'text-[#ba1a1a]' : ipcaCasa12M < 0 ? 'text-[#006a61]' : 'text-[#497cff]'
                }`}
              >
                {ipcaCasa12M < 0 ? 'trending_down' : 'local_fire_department'}
              </span>
            </div>
            <div className="my-4 flex items-baseline gap-2">
              <span
                className={`text-4xl font-bold tracking-tight tabular-nums font-mono ${
                  ipcaCasa12M > 0 ? 'text-[#ba1a1a]' : ipcaCasa12M < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                }`}
              >
                {formatSignedPercent(ipcaCasa12M)}
              </span>
              <span className="text-xs font-mono text-[#76777d]">cesta</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-[#eff4ff] px-3 py-1.5 rounded-lg font-mono gap-2">
              <span className="text-[#0b1c30] truncate">{baseRangeLabel}</span>
              <span className="text-[#45464d] font-semibold shrink-0">
                {calculatedItems.length === 0
                  ? 'Cesta vazia'
                  : `${eligibleItemsCount}/${calculatedItems.length} válidos`}
              </span>
            </div>
          </div>

          {/* Card 2: IPCA Oficial IBGE */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden border border-[#eff4ff]">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#497cff]" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">IPCA Oficial IBGE</span>
                <span className="text-xs text-[#76777d]">{officialSubtitle}</span>
              </div>
              <span className="material-symbols-outlined text-[#497cff] text-[22px]">account_balance</span>
            </div>
            <div className="my-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                {formatSignedPercent(officialRate)}
              </span>
              <span className="text-xs font-mono text-[#76777d]">{officialUnit}</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-[#eff4ff] px-3 py-1.5 rounded-lg font-mono gap-2">
              <span className="text-[#0b1c30] truncate">
                {ibgeData?.latestMonthLabel ? `Ref. ${ibgeData.latestMonthLabel}` : 'Último mês IBGE'}
              </span>
              <span
                className={`font-semibold shrink-0 ${
                  (ibgeData?.latestMonthlyRate ?? 0) < 0 ? 'text-[#006a61]' : 'text-[#497cff]'
                }`}
              >
                {ibgeData && Number.isFinite(ibgeData.latestMonthlyRate)
                  ? `${formatSignedPercent(ibgeData.latestMonthlyRate)} mês`
                  : '—'}
              </span>
            </div>
          </div>

          {/* Card 3: Diferencial Pessoal */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden border border-[#eff4ff]">
            <div
              className={`absolute top-0 left-0 w-1.5 h-full ${
                effectiveSpreadPP > 0 ? 'bg-[#ba1a1a]' : effectiveSpreadPP < 0 ? 'bg-[#006a61]' : 'bg-[#497cff]'
              }`}
            />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">Spread Inflacionário</span>
                <span className="text-xs text-[#76777d]">Diferença p.p. vs IBGE</span>
              </div>
              <span
                className={`material-symbols-outlined text-[22px] ${
                  effectiveSpreadPP > 0 ? 'text-[#ba1a1a]' : effectiveSpreadPP < 0 ? 'text-[#006a61]' : 'text-[#497cff]'
                }`}
              >
                {effectiveSpreadPP < 0 ? 'trending_down' : 'trending_up'}
              </span>
            </div>
            <div className="my-4 flex items-baseline gap-2">
              <span
                className={`text-4xl font-bold tracking-tight tabular-nums font-mono ${
                  effectiveSpreadPP > 0 ? 'text-[#ba1a1a]' : effectiveSpreadPP < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                }`}
              >
                {effectiveSpreadPP > 0 ? '+' : effectiveSpreadPP < 0 ? '-' : ''}
                {Math.abs(effectiveSpreadPP).toFixed(2).replace('.', ',')}
              </span>
              <span
                className={`text-xs font-mono font-semibold ${
                  effectiveSpreadPP > 0 ? 'text-[#ba1a1a]' : effectiveSpreadPP < 0 ? 'text-[#006a61]' : 'text-[#76777d]'
                }`}
              >
                p.p.
              </span>
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg flex items-center justify-between font-mono text-xs ${
                eligibleItemsCount === 0
                  ? 'bg-[#eff4ff] text-[#45464d]'
                  : effectiveSpreadPP > 0
                  ? 'bg-[#ffdad6]/40 text-[#ba1a1a]'
                  : effectiveSpreadPP < 0
                  ? 'bg-[#86f2e4]/35 text-[#006a61]'
                  : 'bg-[#eff4ff] text-[#0b1c30]'
              }`}
            >
              <span className="font-semibold">
                {eligibleItemsCount === 0
                  ? 'Sem itens com variação calculada'
                  : officialRate > 0 && effectiveSpreadPP !== 0
                  ? `${Math.abs((effectiveSpreadPP / officialRate) * 100).toFixed(0)}% ${
                      effectiveSpreadPP > 0 ? 'acima' : 'abaixo'
                    } da média IBGE`
                  : effectiveSpreadPP > 0
                  ? 'Acima da variação oficial'
                  : effectiveSpreadPP < 0
                  ? 'Abaixo da variação oficial'
                  : 'Alinhado ao índice oficial'}
              </span>
              <span className="material-symbols-outlined text-[16px]">
                {eligibleItemsCount === 0
                  ? 'info'
                  : effectiveSpreadPP > 0
                  ? 'priority_high'
                  : 'check_circle'}
              </span>
            </div>
          </div>

          {/* Card 4: Cobertura Amostral */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden border border-[#eff4ff]">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#006a61]" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">Amostra Familiar</span>
                <span className="text-xs text-[#76777d]">Cesta Ativa Auditada</span>
              </div>
              <span className="material-symbols-outlined text-[#006a61] text-[22px]">category</span>
            </div>
            <div className="my-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                {calculatedItems.length}
              </span>
              <span className="text-xs font-mono text-[#76777d]">
                {calculatedItems.length === 1 ? 'item monitorado' : 'itens monitorados'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs bg-[#eff4ff] px-3 py-1.5 rounded-lg font-mono">
              <span className="text-[#0b1c30]">
                {groupContributions.length} {groupContributions.length === 1 ? 'Grupo ativo' : 'Grupos ativos'}
              </span>
              <span className="text-[#006a61] font-semibold">
                {calculatedItems.length > 0
                  ? `${sumOfWeights.toFixed(1).replace('.', ',')}% ponderados`
                  : '0,0% coberto'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Interactive Educational Accordion / Mathematical Formula */}
        <div className="bg-[#ffffff] rounded-xl shadow-sm overflow-hidden border border-[#eff4ff]">
          <button
            onClick={() => setShowFormula(!showFormula)}
            className="w-full px-6 py-4 flex items-center justify-between bg-[#eff4ff] hover:bg-[#e5eeff] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#dce9ff] flex items-center justify-center text-[#0b1c30]">
                <span className="material-symbols-outlined text-[18px]">functions</span>
              </span>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-[#0b1c30]">
                  Como calculamos sua inflação — Índice de Laspeyres Ponderado
                </span>
                <span className="text-xs text-[#45464d]">
                  Entenda matematicamente por que aumentos em refeições e aluguel pesam muito mais do que eletrônicos
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#45464d] font-mono text-xs">
              <span>{showFormula ? 'Recolher fórmula' : 'Ver demonstração algorítmica'}</span>
              <span className={`material-symbols-outlined text-[20px] transition-transform ${showFormula ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          </button>

          {showFormula && (
            <div className="p-6 bg-[#ffffff] flex flex-col gap-6 border-t border-[#eff4ff]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                {/* Visual Formula Box */}
                <div className="bg-[#131b2e] text-[#ffffff] rounded-xl p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider text-[#dae2fd]">
                      Expressão Econométrica
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#565e74]/40 text-[#dae2fd]">
                      Laspeyres Modificado
                    </span>
                  </div>

                  <div className="py-4 px-3 flex flex-col items-center justify-center gap-2 bg-[#ffffff]/5 rounded-lg border border-[#ffffff]/10 font-mono text-center">
                    <div className="text-sm tracking-wide text-[#dae2fd]">
                      Contribuição<sub>i</sub> = Peso<sub>i</sub> × Variação<sub>i</sub>
                    </div>
                    <div className="text-xl md:text-2xl tracking-wider text-[#ffffff] font-bold py-1">
                      IPCA<sub>Casa</sub> = ∑ (Peso<sub>i</sub> × ΔP<sub>i</sub>) = {formatSignedPercent(ipcaCasa12M)}
                    </div>
                    <div className="text-xs text-[#bec6e0]">
                      onde ∑ Peso<sub>i</sub> = 100,00% do orçamento doméstico mensal
                    </div>
                  </div>

                  <p className="text-xs text-[#bec6e0] leading-relaxed">
                    A inflação real de sua família não é uma média simples dos preços de prateleira, mas sim o somatório da variação percentual de cada bem multiplicada pelo peso exato que ele representa nos seus gastos totais.
                  </p>
                </div>

                {/* Glossary Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#eff4ff] rounded-xl p-4 flex flex-col gap-1 border border-[#e5eeff]">
                    <div className="flex items-center gap-1.5 text-[#497cff] font-semibold text-xs">
                      <span className="material-symbols-outlined text-[18px]">pie_chart</span>
                      <span>Peso (w<sub>i</sub>)</span>
                    </div>
                    <p className="text-xs text-[#45464d] mt-1">
                      Fração percentual da despesa mensal gasta no item sobre o gasto total familiar.
                    </p>
                    <div className="mt-auto pt-2 font-mono text-[11px] text-[#0b1c30] font-semibold">
                      {sampleFormulaItem
                        ? `Cesta: ${sampleFormulaItem.name} = ${sampleFormulaItem.weightPercent.toFixed(1).replace('.', ',')}%`
                        : 'Ex. ilustrativo: 20,0% da cesta'}
                    </div>
                  </div>

                  <div className="bg-[#eff4ff] rounded-xl p-4 flex flex-col gap-1 border border-[#e5eeff]">
                    <div className="flex items-center gap-1.5 text-[#006a61] font-semibold text-xs">
                      <span className="material-symbols-outlined text-[18px]">price_change</span>
                      <span>Variação (ΔP<sub>i</sub>)</span>
                    </div>
                    <p className="text-xs text-[#45464d] mt-1">
                      Variação nominal do preço unitário registrado entre o período base e o período atual.
                    </p>
                    <div className="mt-auto pt-2 font-mono text-[11px] text-[#0b1c30] font-semibold">
                      {sampleFormulaItem && sampleFormulaItem.priceChangePercent !== null
                        ? `Cesta: ${formatSignedPercent(sampleFormulaItem.priceChangePercent, 1)}`
                        : 'Ex. ilustrativo: +10,0%'}
                    </div>
                  </div>

                  <div className="bg-[#eff4ff] rounded-xl p-4 flex flex-col gap-1 border border-[#e5eeff]">
                    <div className="flex items-center gap-1.5 text-[#ba1a1a] font-semibold text-xs">
                      <span className="material-symbols-outlined text-[18px]">drive_file_rename_outline</span>
                      <span>Impacto (C<sub>i</sub>)</span>
                    </div>
                    <p className="text-xs text-[#45464d] mt-1">
                      Pontos percentuais transferidos diretamente para o índice consolidado da residência.
                    </p>
                    <div className="mt-auto pt-2 font-mono text-[11px] text-[#ba1a1a] font-semibold">
                      {sampleFormulaItem && sampleFormulaItem.priceChangePercent !== null
                        ? `${sampleFormulaItem.weightPercent.toFixed(1).replace('.', ',')}% × ${formatSignedPercent(sampleFormulaItem.priceChangePercent, 1)} = ${formatSignedPP(sampleFormulaItem.weightedContribution)}`
                        : 'Ex. ilustrativo: 20% × 10% = +2,00 p.p.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Advanced Visualizations (Waterfall & Scatter Plot) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Decomposição por Grupo (7 colunas) */}
          <div className="lg:col-span-7 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2 border-b border-[#eff4ff]">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-sm ${
                      ipcaCasa12M < 0 ? 'bg-[#006a61]' : 'bg-[#ba1a1a]'
                    }`}
                  />
                  <h2 className="text-lg font-semibold text-[#0b1c30]">Decomposição de Contribuição por Grupo</h2>
                </div>
                <p className="text-xs text-[#45464d] mt-0.5">
                  Quantos pontos percentuais (p.p.) cada setor injetou no IPCA-Casa ({formatSignedPercent(ipcaCasa12M)})
                </p>
              </div>
              <span className="font-mono text-xs bg-[#eff4ff] text-[#0b1c30] px-2 py-1 rounded font-semibold">
                Total: {formatSignedPP(ipcaCasa12M)}
              </span>
            </div>

            <div className="flex flex-col gap-4 my-4">
              {groupContributions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#76777d] bg-[#eff4ff]/50 rounded-xl border border-dashed border-[#c6c6cd]">
                  Nenhum grupo de despesa registrado na cesta ativa ainda.
                </div>
              ) : (
                groupContributions.map((gc) => {
                  const hasMeaningfulTotal = Math.abs(ipcaCasa12M) >= 0.05;
                  const shareOfTotalInflation = hasMeaningfulTotal
                    ? (gc.weightedContribution / ipcaCasa12M) * 100
                    : null;
                  const barWidthPct = Math.min(
                    100,
                    Math.max(4, (Math.abs(gc.weightedContribution) / maxAbsGroupContribution) * 100)
                  );
                  return (
                    <div key={gc.group} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-[#45464d] shrink-0">
                            {gc.icon}
                          </span>
                          <span className="font-semibold text-[#0b1c30] truncate">{gc.group}</span>
                          <span className="font-mono text-[#76777d] shrink-0">
                            (Peso {gc.weightPercent.toFixed(1).replace('.', ',')}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span
                            className={`font-bold ${
                              gc.weightedContribution < 0
                                ? 'text-[#006a61]'
                                : gc.weightedContribution > 0
                                ? 'text-[#ba1a1a]'
                                : 'text-[#0b1c30]'
                            }`}
                          >
                            {formatSignedPP(gc.weightedContribution)}
                          </span>
                          {shareOfTotalInflation !== null && (
                            <span className="text-[#76777d]">
                              ({shareOfTotalInflation.toFixed(1).replace('.', ',')}% do total)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[#eff4ff] overflow-hidden flex">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${gc.weightedContribution === 0 ? 0 : barWidthPct}%`,
                            backgroundColor:
                              gc.weightedContribution < 0 ? '#006a61' : gc.color || '#ba1a1a',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-[#eff4ff] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono border-t border-[#eff4ff]">
              {positiveGroups.length >= 2 && ipcaCasa12M > 0 ? (
                <>
                  <span className="text-[#45464d]">
                    {positiveGroups[0].group} + {positiveGroups[1].group} concentram:
                  </span>
                  <span className="font-bold text-[#ba1a1a] bg-[#ffffff] px-2.5 py-1 rounded shadow-sm">
                    {Math.min(
                      100,
                      Math.max(
                        0,
                        ((positiveGroups[0].weightedContribution +
                          positiveGroups[1].weightedContribution) /
                          ipcaCasa12M) *
                          100
                      )
                    )
                      .toFixed(1)
                      .replace('.', ',')}
                    % da Inflação da Casa
                  </span>
                </>
              ) : positiveGroups.length === 1 ? (
                <>
                  <span className="text-[#45464d]">Principal vetor de alta no período:</span>
                  <span className="font-bold text-[#ba1a1a] bg-[#ffffff] px-2.5 py-1 rounded shadow-sm">
                    {positiveGroups[0].group} ({formatSignedPP(positiveGroups[0].weightedContribution)})
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[#45464d]">Pressão setorial consolidada:</span>
                  <span className="font-bold text-[#006a61] bg-[#ffffff] px-2.5 py-1 rounded shadow-sm">
                    Sem pressão altista relevante por grupo
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Dynamic Scatter Plot (5 colunas) */}
          <div className="lg:col-span-5 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex flex-col pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0b1c30]">Variação vs. Peso no Orçamento</h2>
                <span className="material-symbols-outlined text-[#76777d] text-[20px]">bubble_chart</span>
              </div>
              <p className="text-xs text-[#45464d] mt-0.5">
                Identificação dinâmica dos <em>Verdadeiros Vilões</em> (alto peso × alta variação) vs <em>Ruídos de Gôndola</em>.
              </p>
            </div>

            {/* Dynamic Scatter Canvas */}
            <div className="relative w-full h-64 bg-[#eff4ff] rounded-xl p-3 flex flex-col justify-between border border-[#e5eeff]">
              {/* Quadrant backgrounds */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-50 pointer-events-none rounded-xl overflow-hidden">
                <div className="bg-[#ffffff] border-b border-r border-[#c6c6cd]/20" />
                <div className="bg-[#ffdad6]/30 border-b border-[#c6c6cd]/20 flex items-start justify-end p-2">
                  <span className="font-mono text-[9px] text-[#ba1a1a] font-bold uppercase">Quadrante Crítico</span>
                </div>
                <div className="bg-[#86f2e4]/20 border-r border-[#c6c6cd]/20 flex items-end p-2">
                  <span className="font-mono text-[9px] text-[#006a61] font-bold uppercase">Zona de Segurança</span>
                </div>
                <div className="bg-[#ffffff]" />
              </div>

              {scatterPlotData.length === 0 ? (
                <div className="relative z-10 m-auto text-center px-4">
                  <span className="material-symbols-outlined text-[28px] text-[#76777d] block mb-1">
                    scatter_plot
                  </span>
                  <p className="text-xs font-mono text-[#45464d]">
                    Cadastre itens com preço inicial e atual válidos para visualizar a matriz de dispersão.
                  </p>
                </div>
              ) : (
                scatterPlotData.map(({ item, rank, xPercent, yPercent, dotColor, badgeLabel }) => {
                  const change = item.priceChangePercent ?? 0;
                  const tooltipAlign =
                    xPercent > 65
                      ? 'right-0'
                      : xPercent < 35
                      ? 'left-0'
                      : 'left-1/2 -translate-x-1/2';
                  return (
                    <div
                      key={item.id}
                      className="absolute z-10 hover:z-30"
                      style={{ left: `${xPercent}%`, bottom: `${yPercent}%` }}
                    >
                      <div className="group relative cursor-pointer -translate-x-1/2 translate-y-1/2">
                        <div
                          className={`rounded-full text-[#ffffff] flex items-center justify-center shadow ${dotColor} ${
                            rank === 1 ? 'w-5 h-5' : 'w-4 h-4'
                          }`}
                        >
                          <span className="text-[8px] font-bold font-mono">{rank}</span>
                        </div>
                        <div
                          className={`absolute bottom-full mb-1.5 hidden group-hover:flex flex-col bg-[#131b2e] text-[#ffffff] p-2 rounded shadow-lg whitespace-nowrap z-30 text-[11px] ${tooltipAlign}`}
                        >
                          <span className="font-bold">{item.name}</span>
                          <span>
                            Peso: {item.weightPercent.toFixed(1).replace('.', ',')}% | ΔP: {formatSignedPercent(change, 1)}
                          </span>
                          <span className="text-[#dae2fd] font-semibold">
                            {formatSignedPP(item.weightedContribution)} ({badgeLabel})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Axes indicators */}
              <div className="flex justify-between text-[10px] font-mono text-[#76777d] z-10 pointer-events-none">
                <span>Δ Preço Nominal (%) →</span>
                <span>Alta Severidade</span>
              </div>
              <div className="flex justify-between items-end text-[10px] font-mono text-[#76777d] z-10 pointer-events-none">
                <span>↑ Peso no Bolso (%)</span>
                <span>
                  {scatterPlotData.length > 0
                    ? `Top ${scatterPlotData.length} nós — passe o mouse`
                    : 'Aguardando preços'}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1 text-xs text-[#45464d] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]" />
                <span><strong>Vilão Real:</strong> Alta nominal somada a orçamento expressivo.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#565e74]" />
                <span><strong>Efeito Manchete:</strong> Sobe muito em %, mas pesa pouco nos gastos.</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Top 5 Rankings (Split Highlights) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top 5 Maiores Aumentos Percentuais */}
          <div className="bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#eff4ff]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#45464d]">percent</span>
                  <h3 className="text-base font-semibold text-[#0b1c30]">Top 5 Maiores Variações (%)</h3>
                </div>
                <span className="font-mono text-xs text-[#76777d]">Nominal Bruto</span>
              </div>
              <p className="text-xs text-[#45464d] my-2">
                Itens com a maior variação percentual de preço unitário, desconsiderando o peso no orçamento.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {topIncreases.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#eff4ff]/50 text-center text-xs text-[#76777d]">
                  Nenhum item com preço base e atual válidos para ranquear.
                </div>
              ) : (
                topIncreases.map((item, idx) => {
                  const pct = item.priceChangePercent ?? 0;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-xs text-[#76777d] w-4">#{idx + 1}</span>
                        <div>
                          <span className="text-xs font-semibold text-[#0b1c30] block">{item.name}</span>
                          <span className="font-mono text-[11px] text-[#76777d]">
                            {item.group} • Peso {item.weightPercent.toFixed(2).replace('.', ',')}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm block ${
                            pct < 0 ? 'text-[#006a61]' : pct > 0 ? 'text-[#ba1a1a]' : 'text-[#0b1c30]'
                          }`}
                        >
                          {formatSignedPercent(pct, 1)}
                        </span>
                        <span className="font-mono text-[11px] text-[#76777d]">
                          {formatCurrencyBR(item.oldPrice)} → {formatCurrencyBR(item.currentPrice)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top 5 Maiores Vilões do Orçamento */}
          <div className="bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#eff4ff]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#ba1a1a]">bomb</span>
                  <h3 className="text-base font-semibold text-[#0b1c30]">Top 5 Vilões do Bolso (Ponderado)</h3>
                </div>
                <span className="font-mono text-xs text-[#ba1a1a] font-semibold">Impacto em p.p.</span>
              </div>
              <p className="text-xs text-[#45464d] my-2">
                Os 5 itens responsáveis pela maior fatia de impacto no índice da residência.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {topVillains.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#eff4ff]/50 text-center text-xs text-[#76777d]">
                  Nenhum item ponderado com variação disponível no período.
                </div>
              ) : (
                topVillains.map((item, idx) => {
                  const pct = item.priceChangePercent ?? 0;
                  const sharePct =
                    ipcaCasa12M > 0 ? (item.weightedContribution / ipcaCasa12M) * 100 : null;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                        item.weightedContribution < 0
                          ? 'bg-[#86f2e4]/20 hover:bg-[#86f2e4]/35'
                          : 'bg-[#ffdad6]/20 hover:bg-[#ffdad6]/35'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`font-mono font-bold text-xs w-4 ${
                            item.weightedContribution < 0 ? 'text-[#006a61]' : 'text-[#ba1a1a]'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <span className="text-xs font-semibold text-[#0b1c30] block">{item.name}</span>
                          <span className="font-mono text-[11px] text-[#76777d]">
                            Peso: {item.weightPercent.toFixed(1).replace('.', ',')}% •{' '}
                            {pct >= 0 ? 'Alta' : 'Queda'}: {formatSignedPercent(pct, 1)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm block ${
                            item.weightedContribution < 0 ? 'text-[#006a61]' : 'text-[#ba1a1a]'
                          }`}
                        >
                          {formatSignedPP(item.weightedContribution)}
                        </span>
                        <span className="font-mono text-[11px] text-[#76777d]">
                          {sharePct !== null
                            ? `${sharePct.toFixed(1).replace('.', ',')}% do índice`
                            : `Peso ${item.weightPercent.toFixed(1).replace('.', ',')}%`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 5. Master Analytical Table */}
        <div className="bg-[#ffffff] rounded-xl shadow-sm overflow-hidden flex flex-col border border-[#eff4ff]">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eff4ff]">
            <div>
              <h2 className="text-lg font-semibold text-[#0b1c30]">Tabela Analítica Completa de Itens</h2>
              <p className="text-xs text-[#45464d] mt-0.5">
                Amostra detalhada dos itens cadastrados na cesta, ordenados pelo impacto ponderado Laspeyres.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filtrar por nome ou grupo..."
                className="h-9 px-3 bg-[#eff4ff] text-xs rounded-lg text-[#0b1c30] focus:outline-none w-48"
              />
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="h-9 px-3 bg-[#eff4ff] text-xs text-[#0b1c30] rounded-lg focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todos os Grupos</option>
                {availableGroupOptions.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#eff4ff] text-[#45464d] font-mono text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Produto / Serviço</th>
                  <th className="py-3 px-3">Grupo IBGE</th>
                  <th className="py-3 px-3 text-right">Peso Orçam. (%)</th>
                  <th className="py-3 px-3 text-right">Preço Antigo</th>
                  <th className="py-3 px-3 text-right">Preço Atual</th>
                  <th className="py-3 px-3 text-right">Variação Nominal</th>
                  <th className="py-3 px-4 text-right">Contrib. Ponderada</th>
                  <th className="py-3 px-4 text-center">Nível de Impacto</th>
                </tr>
              </thead>
              <tbody className="text-xs text-[#0b1c30] divide-y divide-[#eff4ff]">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 px-4 text-center text-xs text-[#76777d]">
                      {calculatedItems.length === 0 ? (
                        <div className="flex flex-col items-center gap-2">
                          <span>Sua cesta doméstica ainda não possui itens cadastrados.</span>
                          <button
                            type="button"
                            onClick={() => onNavigateTab('minha-cesta-familiar')}
                            className="px-3 py-1.5 rounded-lg bg-[#000000] text-[#ffffff] font-mono text-xs hover:bg-[#213145] cursor-pointer"
                          >
                            Cadastrar Itens da Cesta
                          </button>
                        </div>
                      ) : (
                        'Nenhum item encontrado com os filtros aplicados.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#eff4ff]/60 transition-colors">
                      <td className="py-3 px-4 font-semibold flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            item.priceChangePercent === null
                              ? 'bg-[#c6c6cd]'
                              : item.priceChangePercent < 0
                              ? 'bg-[#006a61]'
                              : item.weightedContribution >= 0.8
                              ? 'bg-[#ba1a1a]'
                              : 'bg-[#76777d]'
                          }`}
                        />
                        <span>{item.name}</span>
                      </td>
                      <td className="py-3 px-3 text-[#45464d] font-mono">{item.group}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium">
                        {item.weightPercent.toFixed(2).replace('.', ',')}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#76777d]">
                        {item.oldPrice > 0 ? formatCurrencyBR(item.oldPrice) : 'Não inf.'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {item.currentPrice > 0 ? formatCurrencyBR(item.currentPrice) : 'Não inf.'}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono font-bold ${
                          item.priceChangePercent === null
                            ? 'text-[#76777d]'
                            : item.priceChangePercent > 0
                            ? 'text-[#ba1a1a]'
                            : item.priceChangePercent < 0
                            ? 'text-[#006a61]'
                            : 'text-[#0b1c30]'
                        }`}
                      >
                        {item.priceChangePercent === null
                          ? 'Pendente'
                          : formatSignedPercent(item.priceChangePercent)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          item.weightedContribution > 0
                            ? 'text-[#ba1a1a]'
                            : item.weightedContribution < 0
                            ? 'text-[#006a61]'
                            : 'text-[#0b1c30]'
                        }`}
                      >
                        {item.priceChangePercent === null
                          ? '—'
                          : formatSignedPP(item.weightedContribution)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${
                            item.impactLevel === 'Crítico'
                              ? 'bg-[#ffdad6] text-[#ba1a1a]'
                              : item.impactLevel === 'Alto'
                              ? 'bg-[#dce9ff] text-[#0b1c30]'
                              : item.impactLevel === 'Alívio'
                              ? 'bg-[#86f2e4]/50 text-[#006a61]'
                              : 'bg-[#eff4ff] text-[#45464d]'
                          }`}
                        >
                          {item.priceChangePercent === null ? 'Sem histórico' : item.impactLevel}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-[#eff4ff] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#45464d] border-t border-[#e5eeff]">
            <span>
              Exibindo {filteredItems.length} de {calculatedItems.length} itens ponderados • Soma das contribuições filtradas:{' '}
              <strong className="text-[#0b1c30]">{formatSignedPP(totalDisplayedContribution)}</strong>
            </span>
          </div>
        </div>

        {/* Final Takeaway Strategy Card */}
        <div className="bg-[#e5eeff] rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-[#d3e4fe]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#ffdad6]/60 flex items-center justify-center text-[#ba1a1a] shrink-0">
              <span className="material-symbols-outlined text-[28px]">insights</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-[#0b1c30]">Diagnóstico de Blindagem Inflacionária</span>
              <p className="text-xs text-[#45464d] max-w-2xl mt-0.5 leading-relaxed">
                {calculatedItems.length === 0 ? (
                  <>
                    Adicione itens com gasto mensal, preço base e preço atual na aba{' '}
                    <strong>Minha Cesta Familiar</strong> para gerar o diagnóstico personalizado dos seus maiores ofensores.
                  </>
                ) : positiveGroups.length >= 2 ? (
                  <>
                    Sua inflação é puxada principalmente pelos grupos{' '}
                    <strong>
                      {positiveGroups[0].group} ({formatSignedPP(positiveGroups[0].weightedContribution)})
                    </strong>{' '}
                    e{' '}
                    <strong>
                      {positiveGroups[1].group} ({formatSignedPP(positiveGroups[1].weightedContribution)})
                    </strong>
                    . Priorize substituições e eficiência nos itens de maior peso em vez de otimizar apenas itens marginais.
                  </>
                ) : positiveGroups.length === 1 ? (
                  <>
                    O grupo <strong>{positiveGroups[0].group}</strong> responde pelo principal vetor de pressão (
                    {formatSignedPP(positiveGroups[0].weightedContribution)}). Confira planos de contenção direcionados nas estratégias.
                  </>
                ) : (
                  <>
                    Sua cesta apresenta estabilidade ou deflação consolidada no período ({formatSignedPercent(ipcaCasa12M)}). Aproveite a folga orçamentária para reforçar reservas no Plano C.
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('estrategias-de-economia')}
            className="shrink-0 bg-[#000000] text-[#ffffff] px-5 py-2.5 rounded-lg font-mono text-xs hover:bg-[#213145] transition-colors cursor-pointer"
          >
            Ver Estratégias de Economia
          </button>
        </div>
      </div>
    </div>
  );
};

