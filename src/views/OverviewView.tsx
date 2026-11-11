import React, { useMemo, useState } from 'react';
import { EconomicCalculationSummary } from '../types';
import { NavTab } from '../components/Sidebar';
import { IBGESeriesMetadata } from '../services/ibge';
import { calculateObservedBasketDifference } from '../services/economics';
import { formatDateRangeLabel, formatIsoDateBR, parseIsoDateToLocalTimestamp } from '../utils/dates';

interface OverviewViewProps {
  summary: EconomicCalculationSummary;
  ibgeData?: IBGESeriesMetadata | null;
  onNavigateTab: (tab: NavTab) => void;
  onOpenNewItem: () => void;
  onOpenQuickPrice: () => void;
  isDemo: boolean;
}

function formatSignedPercent(val: number, digits = 2): string {
  const safe = Number.isFinite(val) ? val : 0;
  return `${safe >= 0 ? '+' : ''}${safe.toFixed(digits).replace('.', ',')}%`;
}

function formatCurrencyBR(val: number): string {
  const safe = Number.isFinite(val) ? val : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  ibgeData = null,
  onNavigateTab,
  onOpenNewItem,
  onOpenQuickPrice,
  isDemo,
}) => {
  const [showDemoBanner, setShowDemoBanner] = useState(isDemo);

  const {
    totalMonthlySpend,
    totalItemsCount,
    eligibleItemsCount,
    ipcaCasa12M,
    ipcaIBGE12M,
    spreadPP,
    groupContributions,
    topVillains,
    topIncreases,
    calculatedItems,
    purchasingPower,
    timeframeLabel,
  } = summary;

  const [intPart, decPart] = formatCurrencyBR(totalMonthlySpend).split(',');
  const recentItems = calculatedItems.slice(0, 5);

  const monthlyPocketEffect = (totalMonthlySpend * ipcaCasa12M) / 100;
  const annualPocketEffect = monthlyPocketEffect * 12;
  const observedBasketDiffReais = useMemo(
    () => calculateObservedBasketDifference(calculatedItems),
    [calculatedItems]
  );

  // Última data real de atualização registrada nos itens da cesta
  const latestItemDate = useMemo(() => {
    let bestTs = 0;
    let bestIso: string | null = null;
    for (const item of calculatedItems) {
      const candidate = item.currentPriceDate || item.updatedAt;
      const ts = parseIsoDateToLocalTimestamp(candidate);
      if (ts > bestTs) {
        bestTs = ts;
        bestIso = candidate;
      }
    }
    return bestIso;
  }, [calculatedItems]);

  // Dados reais do Gráfico 1 (Série IBGE 12M + trajetória proporcional IPCA-Casa)
  const historyPoints = useMemo(() => {
    const raw = ibgeData?.history?.slice(-12) || [];
    if (raw.length === 0) return [];
    const lastIdx = raw.length - 1;
    const latestOfficial12M = raw[lastIdx]?.accumulated12M ?? ipcaIBGE12M;
    return raw.map((pt, idx) => {
      const progress = lastIdx > 0 ? idx / lastIdx : 1;
      const personalEstimate =
        latestOfficial12M > 0
          ? pt.accumulated12M * (1 + ((ipcaCasa12M - latestOfficial12M) / Math.max(1, latestOfficial12M)) * progress)
          : ipcaCasa12M * progress;
      return {
        label: pt.label,
        official12M: Number.isFinite(pt.accumulated12M) ? pt.accumulated12M : 0,
        personal12M: Number.isFinite(personalEstimate) ? personalEstimate : 0,
      };
    });
  }, [ibgeData?.history, ipcaCasa12M, ipcaIBGE12M]);

  const chartBounds = useMemo(() => {
    const allVals = historyPoints.flatMap((p) => [p.official12M, p.personal12M]);
    const minVal = Math.min(0, ...allVals);
    const maxVal = Math.max(4, ...allVals);
    const pad = Math.max(0.5, (maxVal - minVal) * 0.15);
    const yMin = Math.floor(minVal);
    const yMax = Math.ceil(maxVal + pad);
    const mapY = (val: number) => {
      const ratio = (val - yMin) / Math.max(1, yMax - yMin);
      return 230 - ratio * 210;
    };
    const count = historyPoints.length;
    const mapX = (idx: number) => (count <= 1 ? 390 : 60 + (idx / (count - 1)) * 660);
    return { yMin, yMax, mapY, mapX };
  }, [historyPoints]);

  // Donut dinâmico por ponderação orçamentária real
  const donutSegments = useMemo(() => {
    const circumference = 2 * Math.PI * 70; // ~439.82
    let accumulatedOffset = 0;
    const topGroups = groupContributions.slice(0, 6);
    const topSum = topGroups.reduce((acc, g) => acc + g.weightPercent, 0);
    const remainingWeight = Math.max(0, 100 - topSum);
    const list =
      remainingWeight > 0.5
        ? [
            ...topGroups,
            {
              group: 'Outros grupos',
              weightPercent: remainingWeight,
              color: '#d3e4fe',
            },
          ]
        : topGroups;

    return list.map((grp) => {
      const length = (Math.max(0, grp.weightPercent) / 100) * circumference;
      const seg = {
        group: grp.group,
        color: grp.color || '#497cff',
        dasharray: `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`,
        dashoffset: -accumulatedOffset,
      };
      accumulatedOffset += length;
      return seg;
    });
  }, [groupContributions]);

  // Concentração dos top 4 vilões
  const top4Villains = topVillains.slice(0, 4);
  const top4ContributionSum = top4Villains.reduce((acc, it) => acc + it.weightedContribution, 0);
  const top4SharePercent =
    ipcaCasa12M > 0 && top4ContributionSum > 0
      ? Math.min(100, (top4ContributionSum / ipcaCasa12M) * 100)
      : 0;

  // Alertas dinâmicos gerados exclusivamente a partir de summary + ibgeData
  const smartAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      icon: string;
      iconColor: string;
      title: string;
      body: string;
      badge: string;
      badgeColor: string;
    }> = [];

    if (totalItemsCount === 0) {
      alerts.push({
        id: 'empty-basket',
        icon: 'playlist_add',
        iconColor: 'text-[#497cff]',
        title: 'Cesta Familiar Aguardando Itens',
        body: 'Cadastre seus gastos mensais com preço anterior e atual para calcular seu IPCA-Casa ponderado.',
        badge: 'Próximo passo: Cadastrar Item',
        badgeColor: 'text-[#497cff]',
      });
    } else {
      const topDriver = topVillains[0] || topIncreases[0];
      if (topDriver && topDriver.priceChangePercent !== null) {
        const delta = topDriver.priceChangePercent;
        alerts.push({
          id: 'top-driver',
          icon: delta > 0 ? 'warning' : 'check_circle',
          iconColor: delta > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]',
          title:
            delta > 0
              ? `Maior Pressão: ${topDriver.name}`
              : `Maior Alívio: ${topDriver.name}`,
          body: `Peso de ${topDriver.weightPercent.toFixed(1).replace('.', ',')}% na cesta e variação de ${formatSignedPercent(delta, 1)}.`,
          badge: `Impacto ponderado: ${topDriver.weightedContribution >= 0 ? '+' : ''}${topDriver.weightedContribution.toFixed(2).replace('.', ',')} p.p.`,
          badgeColor: delta > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]',
        });
      }

      alerts.push({
        id: 'spread-ibge',
        icon: spreadPP > 0.2 ? 'trending_up' : 'analytics',
        iconColor: spreadPP > 0.2 ? 'text-[#ba1a1a]' : 'text-[#006a61]',
        title:
          spreadPP > 0.2
            ? 'Inflação Pessoal Acima do IBGE'
            : spreadPP < -0.2
            ? 'Inflação Pessoal Abaixo do IBGE'
            : 'Inflação Pessoal Alinhada ao País',
        body: `Seu IPCA-Casa (${formatSignedPercent(ipcaCasa12M)}) vs. IPCA IBGE (${formatSignedPercent(ipcaIBGE12M)}${ibgeData?.isContingencyData ? ' em cache' : ''}).`,
        badge: `Diferencial: ${spreadPP >= 0 ? '+' : ''}${spreadPP.toFixed(2).replace('.', ',')} p.p.`,
        badgeColor: spreadPP > 0.2 ? 'text-[#ba1a1a]' : 'text-[#006a61]',
      });
    }

    if (purchasingPower.hasIncomeData && purchasingPower.monthlyPurchasingDeficitOrGain !== null) {
      const gap = purchasingPower.monthlyPurchasingDeficitOrGain;
      alerts.push({
        id: 'income-gap',
        icon: gap < 0 ? 'account_balance_wallet' : 'verified',
        iconColor: gap < 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]',
        title: gap < 0 ? 'Defasagem no Poder de Compra' : 'Ganho Real de Renda Preservado',
        body:
          gap < 0
            ? `A renda atual está R$ ${formatCurrencyBR(Math.abs(gap))}/mês abaixo do necessário para empatar com sua cesta.`
            : `Sua renda atual supera em R$ ${formatCurrencyBR(gap)}/mês o necessário para acompanhar a inflação.`,
        badge: `Poder de compra: ${formatSignedPercent(purchasingPower.realPurchasingPowerChangePercent ?? 0)}`,
        badgeColor: gap < 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]',
      });
    } else {
      alerts.push({
        id: 'income-missing',
        icon: 'payments',
        iconColor: 'text-[#497cff]',
        title: 'Poder de Compra Não Apurado',
        body: 'Informe sua renda inicial e atual na aba Impacto no Bolso para calcular o ganho ou perda real salarial.',
        badge: 'Configurar faixa de renda',
        badgeColor: 'text-[#497cff]',
      });
    }

    return alerts;
  }, [
    totalItemsCount,
    topVillains,
    topIncreases,
    spreadPP,
    ipcaCasa12M,
    ipcaIBGE12M,
    ibgeData?.isContingencyData,
    purchasingPower,
  ]);

  const topGroupName = groupContributions[0]?.group;
  const maxGroupSpend = Math.max(1, ...groupContributions.slice(0, 4).map((g) => g.totalSpend));

  return (
    <div className="flex flex-col w-full">
      <div className="px-6 lg:px-12 py-6 flex flex-col gap-6 max-w-[1440px] mx-auto w-full">
        {/* Aviso Dismissible de Demonstração */}
        {showDemoBanner && (
          <div className="relative overflow-hidden bg-[#e5eeff] rounded-xl p-4 shadow-sm transition-all duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#d3e4fe] flex items-center justify-center shrink-0 text-[#0b1c30]">
                  <span className="material-symbols-outlined text-[20px]">info</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#86f2e4]/40 text-[#006a61] px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wide uppercase">
                      Modo Demonstração — Valores Didáticos
                    </span>
                    <span className="font-mono text-xs text-[#45464d] font-medium">
                      Parâmetro: Perfil Demonstrativo ({calculatedItems.length} itens de exemplo)
                    </span>
                  </div>
                  <p className="text-xs text-[#45464d] mt-0.5">
                    Todos os índices e históricos deste modo representam uma simulação ilustrativa. Crie uma conta gratuita para acompanhar seus gastos reais.
                  </p>
                </div>
              </div>
              <button
                className="self-end sm:self-center p-1 rounded-lg text-[#45464d] hover:bg-[#d3e4fe] hover:text-[#0b1c30] transition-colors cursor-pointer"
                onClick={() => setShowDemoBanner(false)}
                type="button"
                title="Fechar banner"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Cabeçalho de Contexto & Quick Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs uppercase tracking-wider text-[#45464d] font-medium">
                Relatório Executivo
              </span>
              <span className="w-1 h-1 rounded-full bg-[#c6c6cd]" />
              <span className="font-mono text-xs text-[#006a61] font-semibold">
                {ibgeData?.latestMonthLabel
                  ? `Ref. IBGE: ${ibgeData.latestMonthLabel}${ibgeData.isContingencyData ? ' (Cache)' : ''}`
                  : `Janela: ${timeframeLabel}`}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-[#0b1c30] tracking-tight mt-0.5">
              Termômetro da Inflação Doméstica
            </h1>
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenNewItem}
              className="h-10 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-sm font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>Cadastrar Item</span>
            </button>
            <button
              onClick={onOpenQuickPrice}
              className="h-10 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-sm font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
              <span>Atualizar Preço</span>
            </button>
            <button
              onClick={() => onNavigateTab('relatorios')}
              className="h-10 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-sm font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Exportar Resumo</span>
            </button>
            <button
              onClick={() => onNavigateTab('impacto-no-bolso')}
              className="h-10 px-4 rounded-lg bg-[#006a61] text-[#ffffff] hover:bg-[#004e47] text-sm font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">payments</span>
              <span>Impacto no Bolso (R$)</span>
            </button>
            <button
              onClick={() => onNavigateTab('analise-da-inflacao')}
              className="h-10 px-4 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-sm font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">insights</span>
              <span>Ver Análise Detalhada</span>
            </button>
          </div>
        </div>

        {/* ÁREA CENTRAL EM DESTAQUE: IMPACTO NO SEU BOLSO */}
        <div className="bg-[#131b2e] text-[#ffffff] rounded-2xl p-6 lg:p-7 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6 border border-[#213145]">
          {totalItemsCount === 0 || totalMonthlySpend <= 0 ? (
            <>
              <div className="flex flex-col gap-2 max-w-2xl">
                <div className="flex items-center gap-2 text-[#86f2e4] font-mono text-xs uppercase tracking-wider font-bold">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                  <span>Comece a Medir Sua Inflação Real</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Sua cesta pessoal está pronta para o primeiro registro.
                </h2>
                <p className="text-xs text-[#bec6e0] leading-relaxed">
                  Adicione itens do seu orçamento mensal com os respectivos preços anterior e atual para apurar automaticamente quanto a inflação custa no seu bolso em Reais (R$).
                </p>
              </div>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onOpenNewItem}
                  className="h-11 px-6 rounded-xl bg-[#ffffff] text-[#0b1c30] hover:bg-[#eff4ff] text-xs font-mono font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Cadastrar Primeiro Item</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('ipca-oficial')}
                  className="h-10 px-5 rounded-xl bg-[#213145] text-[#dae2fd] hover:text-[#ffffff] text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">public</span>
                  <span>Consultar IPCA Oficial ({formatSignedPercent(ipcaIBGE12M)})</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2 max-w-2xl">
                <div className="flex items-center gap-2 text-[#86f2e4] font-mono text-xs uppercase tracking-wider font-bold">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                  <span>O Verdadeiro Impacto da Inflação no seu Bolso</span>
                </div>
                {monthlyPocketEffect >= 0 ? (
                  <>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                      A alta de preços consome{' '}
                      <span className="text-[#ffb4ab]">-R$ {formatCurrencyBR(monthlyPocketEffect)}</span>{' '}
                      do seu orçamento todo mês.
                    </h2>
                    <p className="text-xs text-[#bec6e0] leading-relaxed">
                      Em 12 meses, mantendo o gasto mensal base de R$ {formatCurrencyBR(totalMonthlySpend)}, a pressão acumulada chega a{' '}
                      <strong className="text-[#ffffff]">-R$ {formatCurrencyBR(annualPocketEffect)}</strong>.
                      Compare com sua renda e avalie estratégias de substituição para neutralizar essa perda.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                      Sua cesta registra alívio de{' '}
                      <span className="text-[#86f2e4]">+R$ {formatCurrencyBR(Math.abs(monthlyPocketEffect))}</span>{' '}
                      por mês nos preços atuais.
                    </h2>
                    <p className="text-xs text-[#bec6e0] leading-relaxed">
                      Sob a taxa ponderada de {formatSignedPercent(ipcaCasa12M)} aplicada ao gasto base de R$ {formatCurrencyBR(totalMonthlySpend)}, a economia estimada em 12 meses é de{' '}
                      <strong className="text-[#86f2e4]">+R$ {formatCurrencyBR(Math.abs(annualPocketEffect))}</strong>.
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigateTab('impacto-no-bolso')}
                  className="h-11 px-6 rounded-xl bg-[#ffffff] text-[#0b1c30] hover:bg-[#eff4ff] text-xs font-mono font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Abrir Diagnóstico do Bolso</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('ipca-oficial')}
                  className="h-10 px-5 rounded-xl bg-[#213145] text-[#dae2fd] hover:text-[#ffffff] text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">public</span>
                  <span>Comparar com IPCA Oficial</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* 1. Grid de Indicadores Principais (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* KPI 1: Gasto Mensal Total */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">Gasto Mensal</span>
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Total Consolidado</span>
              <div className="text-2xl font-bold text-[#0b1c30] tracking-tight tabular-nums">
                R$ {intPart}
                <span className="text-[#45464d] font-normal text-lg">,{decPart}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#eff4ff] text-[#45464d] px-2 py-0.5 rounded-md w-fit font-mono text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#497cff]" />
              <span>{totalItemsCount} {totalItemsCount === 1 ? 'item ativo' : 'itens ativos'}</span>
            </div>
          </div>

          {/* KPI 2: IPCA-Casa (Inflação Pessoal) */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">IPCA-Casa</span>
              <span
                className={`material-symbols-outlined text-[18px] ${
                  ipcaCasa12M > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                }`}
              >
                local_fire_department
              </span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Inflação da Família</span>
              <div
                className={`text-2xl font-bold tracking-tight tabular-nums font-mono ${
                  ipcaCasa12M > 0 ? 'text-[#ba1a1a]' : ipcaCasa12M < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                }`}
              >
                {eligibleItemsCount > 0 ? formatSignedPercent(ipcaCasa12M) : '0,00%'}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#45464d] text-xs">
              <span className="material-symbols-outlined text-[14px]">history</span>
              <span className="truncate">{timeframeLabel}</span>
            </div>
          </div>

          {/* KPI 3: IPCA Oficial IBGE */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">IPCA Oficial</span>
              <span className="material-symbols-outlined text-[18px] text-[#497cff]">account_balance</span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">IBGE Nacional (12M)</span>
              <div className="text-2xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                {formatSignedPercent(ipcaIBGE12M)}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#497cff] font-mono text-[11px] font-medium truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#497cff] shrink-0" />
              <span className="truncate">
                {ibgeData?.latestMonthLabel || 'Fonte SIDRA/IBGE'}
              </span>
            </div>
          </div>

          {/* KPI 4: Diferencial (Spread) */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">Diferencial</span>
              <span
                className={`material-symbols-outlined text-[18px] ${
                  spreadPP > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                }`}
              >
                difference
              </span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Sobre a Média Oficial</span>
              <div
                className={`text-2xl font-bold tracking-tight tabular-nums font-mono ${
                  spreadPP > 0.05 ? 'text-[#ba1a1a]' : spreadPP < -0.05 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                }`}
              >
                {spreadPP >= 0 ? '+' : ''}
                {spreadPP.toFixed(2).replace('.', ',')}{' '}
                <span className="text-xs font-normal">p.p.</span>
              </div>
            </div>
            <div
              className={`px-2 py-0.5 rounded text-left text-[11px] font-medium ${
                spreadPP > 0.05
                  ? 'bg-[#ffdad6]/40 text-[#93000a]'
                  : spreadPP < -0.05
                  ? 'bg-[#86f2e4]/40 text-[#005049]'
                  : 'bg-[#eff4ff] text-[#45464d]'
              }`}
            >
              {spreadPP > 0.05
                ? 'Cesta acima do país'
                : spreadPP < -0.05
                ? 'Cesta abaixo do país'
                : 'Alinhada à média'}
            </div>
          </div>

          {/* KPI 5: Variação Renda Nominal */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">Renda Nominal</span>
              <span className="material-symbols-outlined text-[18px] text-[#006a61]">trending_up</span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Ajuste no Período</span>
              <div className="text-2xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                {purchasingPower.nominalIncomeGrowthPercent !== null
                  ? formatSignedPercent(purchasingPower.nominalIncomeGrowthPercent)
                  : '—'}
              </div>
            </div>
            <div className="text-[#45464d] font-mono text-[11px] tabular-nums truncate">
              {purchasingPower.hasIncomeData && purchasingPower.initialIncome !== null && purchasingPower.finalIncome !== null
                ? `R$ ${purchasingPower.initialIncome.toLocaleString('pt-BR')} → R$ ${purchasingPower.finalIncome.toLocaleString('pt-BR')}`
                : 'Renda não informada'}
            </div>
          </div>

          {/* KPI 6: Poder de Compra Real */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">Poder de Compra</span>
              <span
                className={`material-symbols-outlined text-[18px] ${
                  purchasingPower.realPurchasingPowerChangePercent === null
                    ? 'text-[#76777d]'
                    : purchasingPower.realPurchasingPowerChangePercent < 0
                    ? 'text-[#ba1a1a]'
                    : 'text-[#006a61]'
                }`}
              >
                shopping_cart_checkout
              </span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Efeito Real Pós-Inflação</span>
              <div
                className={`text-2xl font-bold tracking-tight tabular-nums font-mono ${
                  purchasingPower.realPurchasingPowerChangePercent === null
                    ? 'text-[#76777d]'
                    : purchasingPower.realPurchasingPowerChangePercent < 0
                    ? 'text-[#ba1a1a]'
                    : 'text-[#006a61]'
                }`}
              >
                {purchasingPower.realPurchasingPowerChangePercent !== null
                  ? formatSignedPercent(purchasingPower.realPurchasingPowerChangePercent)
                  : '—'}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#45464d] font-mono text-[11px]">
              {purchasingPower.realPurchasingPowerChangePercent === null ? (
                <span>Informe a renda para apurar</span>
              ) : purchasingPower.realPurchasingPowerChangePercent < 0 ? (
                <>
                  <span className="material-symbols-outlined text-[14px] text-[#ba1a1a]">arrow_downward</span>
                  <span>Perda de compra real</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px] text-[#006a61]">arrow_upward</span>
                  <span>Ganho de compra real</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Grid Gráfica Principal (Histórico 12M e Cesta Donut) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Gráfico 1: Comparativo IPCA-Casa vs IPCA IBGE (8 colunas) */}
          <div className="lg:col-span-8 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2 border-b border-[#eff4ff]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#0b1c30]">Histórico Acumulado 12 Meses</h2>
                  <span className="font-mono text-xs bg-[#eff4ff] px-2 py-0.5 rounded text-[#45464d]">
                    {ibgeData?.sourceMode === 'live' ? 'SIDRA Ao Vivo' : 'SIDRA Cache'}
                  </span>
                </div>
                <p className="text-xs text-[#45464d] mt-0.5">
                  Série oficial IBGE (12 meses) comparada à referência atual da sua cesta familiar
                </p>
              </div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-[#000000]" />
                  <span className="text-[#0b1c30] font-semibold">
                    IPCA-Casa ({formatSignedPercent(ipcaCasa12M)})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-[#497cff]" />
                  <span className="text-[#45464d]">
                    IPCA IBGE ({formatSignedPercent(ipcaIBGE12M)})
                  </span>
                </div>
              </div>
            </div>

            {historyPoints.length > 0 ? (
              <div className="relative w-full h-64 mt-4">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 760 260">
                  <defs>
                    <linearGradient id="ipcaCasaGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#000000" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                    const val = chartBounds.yMin + (chartBounds.yMax - chartBounds.yMin) * step;
                    const y = chartBounds.mapY(val);
                    return (
                      <g key={step}>
                        <line
                          stroke={step === 0 ? '#c6c6cd' : '#eff4ff'}
                          strokeWidth="1"
                          x1="40"
                          x2="740"
                          y1={y}
                          y2={y}
                        />
                        <text className="font-mono text-[10px] fill-[#76777d]" textAnchor="end" x="34" y={y + 3}>
                          {val.toFixed(1).replace('.', ',')}%
                        </text>
                      </g>
                    );
                  })}

                  <polygon
                    fill="url(#ipcaCasaGrad)"
                    points={`${historyPoints
                      .map((p, idx) => `${chartBounds.mapX(idx)},${chartBounds.mapY(p.personal12M)}`)
                      .join(' ')} ${chartBounds.mapX(historyPoints.length - 1)},230 ${chartBounds.mapX(0)},230`}
                  />

                  <polyline
                    fill="none"
                    stroke="#497cff"
                    strokeDasharray="4 4"
                    strokeWidth="2.5"
                    points={historyPoints
                      .map((p, idx) => `${chartBounds.mapX(idx)},${chartBounds.mapY(p.official12M)}`)
                      .join(' ')}
                  />

                  <polyline
                    fill="none"
                    stroke="#000000"
                    strokeWidth="3"
                    points={historyPoints
                      .map((p, idx) => `${chartBounds.mapX(idx)},${chartBounds.mapY(p.personal12M)}`)
                      .join(' ')}
                  />

                  {(() => {
                    const lastIdx = historyPoints.length - 1;
                    const lastX = chartBounds.mapX(lastIdx);
                    const lastPersonalY = chartBounds.mapY(historyPoints[lastIdx].personal12M);
                    const lastOfficialY = chartBounds.mapY(historyPoints[lastIdx].official12M);
                    return (
                      <>
                        <circle cx={lastX} cy={lastPersonalY} fill="#000000" r="5" />
                        <circle cx={lastX} cy={lastPersonalY} fill="#000000" fillOpacity="0.2" r="9" />
                        <circle cx={lastX} cy={lastOfficialY} fill="#497cff" r="4" />
                      </>
                    );
                  })()}

                  {historyPoints.map((pt, idx) => {
                    const isEdgeOrEven = idx === historyPoints.length - 1 || idx % 2 === 0;
                    if (!isEdgeOrEven) return null;
                    return (
                      <text
                        key={pt.label}
                        className={`font-mono text-[10px] ${
                          idx === historyPoints.length - 1 ? 'fill-[#0b1c30] font-semibold' : 'fill-[#76777d]'
                        }`}
                        textAnchor="middle"
                        x={chartBounds.mapX(idx)}
                        y="250"
                      >
                        {pt.label}
                      </text>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs font-mono text-[#76777d]">
                Carregando série histórica oficial do IBGE...
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs text-[#45464d] border-t border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${spreadPP > 0 ? 'bg-[#ba1a1a]' : 'bg-[#006a61]'}`} />
                <span>
                  {totalItemsCount === 0
                    ? 'Cadastre seus itens para comparar sua inflação domiciliar com o IBGE.'
                    : topGroupName
                    ? `Maior concentração orçamentária atual no grupo "${topGroupName}".`
                    : 'Base calculada sobre os itens cadastrados na sua cesta.'}
                </span>
              </div>
              <span className="font-semibold text-[#0b1c30]">
                {ibgeData?.referencePeriod
                  ? formatDateRangeLabel(ibgeData.referencePeriod.split(' a ')[0], ibgeData.referencePeriod.split(' a ')[1])
                  : 'SIDRA Tabela 1737'}
              </span>
            </div>
          </div>

          {/* Gráfico 2: Distribuição do Orçamento (4 colunas) */}
          <div className="lg:col-span-4 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0b1c30]">Cesta de Consumo</h2>
                <span className="material-symbols-outlined text-[#76777d] text-[18px]">pie_chart</span>
              </div>
              <p className="text-xs text-[#45464d] mt-0.5">Ponderação orçamentária real por grupo</p>
            </div>

            {/* Donut SVG Dinâmico */}
            <div className="relative flex items-center justify-center my-4">
              <svg className="w-44 h-44 -rotate-90" viewBox="0 0 200 200">
                {donutSegments.length > 0 ? (
                  donutSegments.map((seg) => (
                    <circle
                      key={seg.group}
                      cx="100"
                      cy="100"
                      fill="transparent"
                      r="70"
                      stroke={seg.color}
                      strokeDasharray={seg.dasharray}
                      strokeDashoffset={seg.dashoffset}
                      strokeWidth="24"
                    />
                  ))
                ) : (
                  <circle cx="100" cy="100" fill="transparent" r="70" stroke="#eff4ff" strokeWidth="24" />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                <span className="font-mono text-[10px] text-[#76777d] uppercase tracking-wider">Maior Peso</span>
                <span className="text-2xl font-bold text-[#0b1c30]">
                  {groupContributions[0] ? `${groupContributions[0].weightPercent.toFixed(0)}%` : '0%'}
                </span>
                <span className="text-xs font-medium text-[#0b1c30] truncate max-w-[110px]">
                  {groupContributions[0]?.group || 'Sem itens'}
                </span>
              </div>
            </div>

            {/* Legenda de Grupos */}
            {groupContributions.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
                {groupContributions.slice(0, 6).map((gc) => (
                  <div key={gc.group} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate text-[#45464d]" title={gc.group}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: gc.color }} />
                      <span className="truncate">{gc.group.split(' ')[0]}</span>
                    </span>
                    <span className="font-semibold text-[#0b1c30]">{gc.weightPercent.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center font-mono text-xs text-[#76777d]">
                Nenhum grupo ativo cadastrado.
              </div>
            )}
          </div>
        </div>

        {/* 3. Concentração do Orçamento por Grupo & Vilões do Orçamento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Concentração de Gastos por Grupo (5 colunas) */}
          <div className="lg:col-span-5 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0b1c30]">Distribuição por Principais Grupos</h2>
                <span className="font-mono text-xs text-[#76777d]">Gasto Mensal (R$)</span>
              </div>
              <p className="text-xs text-[#45464d] mt-0.5">Participação das categorias com maior desembolso na cesta</p>
            </div>

            {groupContributions.length > 0 ? (
              <div className="grid grid-cols-4 items-end gap-3 h-48 my-4 px-2">
                {groupContributions.slice(0, 4).map((grp, idx) => {
                  const barPct = Math.min(100, Math.max(12, (grp.totalSpend / maxGroupSpend) * 90));
                  return (
                    <div key={grp.group} className="flex flex-col items-center gap-2 h-full justify-end">
                      <span className="font-mono text-[11px] text-[#0b1c30] font-semibold">
                        {Math.round(grp.totalSpend).toLocaleString('pt-BR')}
                      </span>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-300 ${
                          idx === 0 ? 'bg-[#000000] shadow-sm' : 'bg-[#dce9ff]'
                        }`}
                        style={{ height: `${barPct}%` }}
                        title={`${grp.group}: R$ ${formatCurrencyBR(grp.totalSpend)} (${grp.weightPercent.toFixed(1)}%)`}
                      />
                      <span className="font-mono text-[11px] text-[#45464d] truncate max-w-full" title={grp.group}>
                        {grp.group.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs font-mono text-[#76777d]">
                Cadastre despesas para visualizar a distribuição por categoria.
              </div>
            )}

            <div className="p-3 bg-[#eff4ff] rounded-lg flex items-center justify-between text-xs font-mono">
              <span className="text-[#45464d]">Variação direta na cesta (R$):</span>
              <span className={`font-bold ${observedBasketDiffReais > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'}`}>
                {observedBasketDiffReais >= 0 ? '+R$ ' : '-R$ '}
                {formatCurrencyBR(Math.abs(observedBasketDiffReais))}/mês
              </span>
            </div>
          </div>

          {/* Vilões do Orçamento Familiar (7 colunas) */}
          <div className="lg:col-span-7 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0b1c30]">Vilões do Orçamento Familiar</h2>
                <span className="font-mono text-xs bg-[#ffdad6]/40 text-[#ba1a1a] px-2 py-0.5 rounded font-semibold">
                  Impacto no IPCA-Casa
                </span>
              </div>
              <p className="text-xs text-[#45464d] mt-0.5">
                Contribuição em pontos percentuais (p.p.) na taxa total apurada ({formatSignedPercent(ipcaCasa12M)})
              </p>
            </div>

            {top4Villains.length > 0 ? (
              <div className="flex flex-col gap-3 my-3">
                {top4Villains.map((item) => {
                  const denom = Math.max(0.5, Math.abs(ipcaCasa12M));
                  const widthPercent = Math.min(100, Math.max(10, (Math.abs(item.weightedContribution) / denom) * 100));
                  return (
                    <div key={item.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#0b1c30] flex items-center gap-1.5 truncate max-w-[320px]">
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              item.weightedContribution >= 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                            }`}
                          >
                            {item.weightedContribution >= 0 ? 'warning' : 'check_circle'}
                          </span>
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="font-mono font-bold text-[#0b1c30]">
                          {item.weightedContribution >= 0 ? '+' : ''}
                          {item.weightedContribution.toFixed(2).replace('.', ',')} p.p.{' '}
                          <span className="text-[#76777d] font-normal">
                            ({formatSignedPercent(item.priceChangePercent ?? 0, 1)})
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-[#eff4ff] h-2 rounded-full overflow-hidden">
                        <div
                          className={`${item.weightedContribution >= 0 ? 'bg-[#000000]' : 'bg-[#006a61]'} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs font-mono text-[#76777d]">
                Cadastre itens com preço anterior e preço atual válidos para ranquear os principais vilões da cesta.
              </div>
            )}

            <div className="text-xs font-mono text-[#45464d] flex items-center justify-between pt-2 border-t border-[#eff4ff]">
              <span>
                {top4Villains.length > 0 && ipcaCasa12M > 0
                  ? `Estes ${top4Villains.length} itens representam ${top4SharePercent.toFixed(1).replace('.', ',')}% da inflação da cesta`
                  : 'Acompanhe os impactos ponderados por item'}
              </span>
              <button
                onClick={() => onNavigateTab('analise-da-inflacao')}
                className="text-[#0b1c30] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                type="button"
              >
                Explorar todos os itens <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. Tabela de Variação Recente, Alertas Inteligentes e Diagnóstico */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Tabela de Variação Recente (8 colunas) */}
          <div className="lg:col-span-8 bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#eff4ff]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2 border-b border-[#eff4ff]">
              <div>
                <h2 className="text-lg font-semibold text-[#0b1c30]">Variação Recente por Produto</h2>
                <p className="text-xs text-[#45464d]">Movimentação apurada entre o preço base e o preço atual</p>
              </div>
              <span className="font-mono text-xs text-[#76777d]">
                Mostrando {recentItems.length} de {calculatedItems.length} itens monitorados
              </span>
            </div>

            {recentItems.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center gap-3">
                <p className="text-xs text-[#45464d] font-mono">Nenhum produto ou serviço cadastrado nesta cesta ainda.</p>
                <button
                  type="button"
                  onClick={onOpenNewItem}
                  className="h-9 px-4 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold cursor-pointer"
                >
                  + Cadastrar Item
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#eff4ff] text-[#45464d] font-mono text-xs uppercase tracking-wider">
                      <th className="py-2.5 px-3 rounded-l-lg">Produto / Serviço</th>
                      <th className="py-2.5 px-3">Grupo</th>
                      <th className="py-2.5 px-3 text-right">Preço Ant.</th>
                      <th className="py-2.5 px-3 text-right">Preço Atual</th>
                      <th className="py-2.5 px-3 text-right">Variação %</th>
                      <th className="py-2.5 px-3 text-center rounded-r-lg">Impacto</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs text-[#0b1c30] divide-y divide-[#eff4ff]">
                    {recentItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#eff4ff]/60 transition-colors">
                        <td className="py-3 px-3 font-semibold flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              (item.priceChangePercent ?? 0) < 0
                                ? 'bg-[#006a61]'
                                : item.weightedContribution >= 0.8
                                ? 'bg-[#ba1a1a]'
                                : 'bg-[#76777d]'
                            }`}
                          />
                          <span className="truncate max-w-[220px]">{item.name}</span>
                        </td>
                        <td className="py-3 px-3 text-[#45464d]">{item.group.split(' ')[0]}</td>
                        <td className="py-3 px-3 text-right font-mono text-[#76777d]">
                          {item.oldPrice > 0 ? `R$ ${item.oldPrice.toFixed(2).replace('.', ',')}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {item.currentPrice > 0 ? `R$ ${item.currentPrice.toFixed(2).replace('.', ',')}` : '—'}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-mono font-bold ${
                            (item.priceChangePercent ?? 0) > 0
                              ? 'text-[#ba1a1a]'
                              : (item.priceChangePercent ?? 0) < 0
                              ? 'text-[#006a61]'
                              : 'text-[#0b1c30]'
                          }`}
                        >
                          {item.priceChangePercent !== null
                            ? formatSignedPercent(item.priceChangePercent, 1)
                            : 'Pendente'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                              item.impactLevel === 'Crítico' || item.impactLevel === 'Alto'
                                ? 'bg-[#ffdad6]/40 text-[#ba1a1a]'
                                : item.impactLevel === 'Alívio'
                                ? 'bg-[#86f2e4]/40 text-[#006a61]'
                                : 'bg-[#eff4ff] text-[#45464d]'
                            }`}
                          >
                            {item.impactLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 pt-3 flex items-center justify-between border-t border-[#eff4ff] text-xs">
              <span className="font-mono text-[#76777d]">
                {latestItemDate
                  ? `Última atualização de preço registrada: ${formatIsoDateBR(latestItemDate)}`
                  : 'Sem registros recentes de preço'}
              </span>
              <button
                onClick={() => onNavigateTab('minha-cesta-familiar')}
                className="font-semibold text-[#0b1c30] hover:text-[#497cff] flex items-center gap-1 cursor-pointer"
                type="button"
              >
                Ver Tabela Completa ({calculatedItems.length} itens)
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Alertas & Notificações Orçamentárias (4 colunas) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#eff4ff]">
              <div className="flex items-center justify-between pb-2 border-b border-[#eff4ff]">
                <h2 className="text-base font-semibold text-[#0b1c30]">Alertas da Sua Cesta</h2>
                <span className="material-symbols-outlined text-[#76777d] text-[20px]">notifications_active</span>
              </div>

              <div className="flex flex-col gap-2.5 mt-3 text-xs">
                {smartAlerts.map((alertItem) => (
                  <div key={alertItem.id} className="p-3 rounded-lg bg-[#eff4ff] flex items-start gap-2.5">
                    <span className={`material-symbols-outlined text-[20px] ${alertItem.iconColor} shrink-0 mt-0.5`}>
                      {alertItem.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#0b1c30]">{alertItem.title}</span>
                      <p className="text-[#45464d] mt-0.5">{alertItem.body}</p>
                      <span className={`font-mono font-semibold mt-1 ${alertItem.badgeColor}`}>
                        {alertItem.badge}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Diagnóstico da Família Card */}
            <div className="bg-[#131b2e] text-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#dae2fd] font-semibold">
                  Diagnóstico da Família
                </span>
                <span className="material-symbols-outlined text-[#86f2e4] text-[20px]">shield</span>
              </div>
              <div className="my-3">
                <h3 className="text-lg font-bold">
                  {purchasingPower.monthlyPurchasingDeficitOrGain !== null
                    ? purchasingPower.monthlyPurchasingDeficitOrGain < 0
                      ? `Déficit Real de R$ ${formatCurrencyBR(Math.abs(purchasingPower.monthlyPurchasingDeficitOrGain))}/mês`
                      : `Ganho Real de +R$ ${formatCurrencyBR(purchasingPower.monthlyPurchasingDeficitOrGain)}/mês`
                    : 'Poder de Compra Aguardando Renda'}
                </h3>
                <p className="text-xs text-[#bec6e0] mt-1 leading-relaxed">
                  {purchasingPower.monthlyPurchasingDeficitOrGain === null
                    ? 'Informe sua renda na aba Renda & Poder de Compra para calcular quanto falta ou sobra em relação à inflação da casa.'
                    : purchasingPower.monthlyPurchasingDeficitOrGain < 0
                    ? 'Para recompor o poder de compra mantendo a mesma cesta, avalie ajustes salariais ou substituições táticas de itens.'
                    : 'Sua renda superou a variação da sua cesta familiar. Você pode direcionar o excedente nas Estratégias de Economia.'}
                </p>
              </div>
              <button
                onClick={() =>
                  onNavigateTab(
                    purchasingPower.monthlyPurchasingDeficitOrGain === null
                      ? 'renda-e-poder-de-compra'
                      : 'estrategias-de-economia'
                  )
                }
                className="w-full h-9 rounded-lg bg-[#ffffff] text-[#0b1c30] text-xs font-semibold hover:bg-[#eff4ff] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                type="button"
              >
                <span>
                  {purchasingPower.monthlyPurchasingDeficitOrGain === null
                    ? 'Informar Renda Familiar'
                    : 'Simular Estratégias de Economia'}
                </span>
                <span className="material-symbols-outlined text-[16px]">tune</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

