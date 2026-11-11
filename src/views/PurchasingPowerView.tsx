import React, { useEffect, useMemo, useState } from 'react';
import { EconomicCalculationSummary } from '../types';
import {
  formatDateRangeLabel,
  formatMonthYearLabel,
  getMonthsAgoIsoDate,
  getTodayIsoDate,
  isValidIsoDate,
  parseIsoDateToLocalTimestamp,
} from '../utils/dates';

interface PurchasingPowerViewProps {
  summary: EconomicCalculationSummary;
  onUpdateIncome: (
    initial: number,
    final: number,
    dates?: { initialDate?: string; finalDate?: string }
  ) => void | Promise<void>;
  isDemo: boolean;
}

function formatSignedPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(decimals).replace('.', ',')}%`;
}

function formatCurrencyBR(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const PurchasingPowerView: React.FC<PurchasingPowerViewProps> = ({
  summary,
  onUpdateIncome,
  isDemo,
}) => {
  const { ipcaCasa12M, ipcaIBGE12M, spreadPP, purchasingPower } = summary;

  // Estado do simulador interativo de reajuste necessário (sem defaults fictícios)
  const [baseSalary, setBaseSalary] = useState<number>(purchasingPower.initialIncome ?? 0);
  const [currentActualSalary, setCurrentActualSalary] = useState<number>(
    purchasingPower.finalIncome ?? 0
  );
  const [initialDateInput, setInitialDateInput] = useState<string>(
    purchasingPower.initialDate || getMonthsAgoIsoDate(12)
  );
  const [finalDateInput, setFinalDateInput] = useState<string>(
    purchasingPower.finalDate || getTodayIsoDate()
  );
  const [appliedInflation, setAppliedInflation] = useState<number>(ipcaCasa12M);
  const [targetRealGain, setTargetRealGain] = useState<number>(0.0);
  const [activePreset, setActivePreset] = useState<'breakeven' | 'gain1' | 'gain2'>('breakeven');
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Mantém inputs sincronizados quando perfil ou período mudam
  useEffect(() => {
    setBaseSalary(purchasingPower.initialIncome ?? 0);
    setCurrentActualSalary(purchasingPower.finalIncome ?? 0);
    setInitialDateInput(purchasingPower.initialDate || getMonthsAgoIsoDate(12));
    setFinalDateInput(purchasingPower.finalDate || getTodayIsoDate());
  }, [
    purchasingPower.initialIncome,
    purchasingPower.finalIncome,
    purchasingPower.initialDate,
    purchasingPower.finalDate,
  ]);

  useEffect(() => {
    setAppliedInflation(ipcaCasa12M);
  }, [ipcaCasa12M]);

  // Cálculos dinâmicos do simulador com proteção contra divisão por zero
  const hasSimBase = Number.isFinite(baseSalary) && baseSalary > 0;
  const inflationFactor = Math.max(0.01, 1 + (Number.isFinite(appliedInflation) ? appliedInflation : 0) / 100);
  const realGainFactor = Math.max(0, 1 + (Number.isFinite(targetRealGain) ? targetRealGain : 0) / 100);
  const neededSalary = hasSimBase ? baseSalary * inflationFactor * realGainFactor : 0;
  const totalPercentageNeeded = hasSimBase ? (neededSalary / baseSalary - 1) * 100 : 0;
  const monthlyGap = hasSimBase ? neededSalary - currentActualSalary : 0;

  // Dados exibidos nos painéis principais (preferência aos salvos, ou preview se simulador ativo)
  const hasSavedIncome = purchasingPower.hasIncomeData && (purchasingPower.initialIncome ?? 0) > 0;
  const displayInitial = hasSavedIncome ? purchasingPower.initialIncome! : hasSimBase ? baseSalary : 0;
  const displayFinal = hasSavedIncome
    ? purchasingPower.finalIncome ?? 0
    : hasSimBase
    ? currentActualSalary
    : 0;
  const hasAnyIncomeToChart = displayInitial > 0;

  const nominalGrowthDisplay = hasAnyIncomeToChart
    ? ((displayFinal - displayInitial) / displayInitial) * 100
    : null;
  const summaryInflationFactor = Math.max(0.01, 1 + ipcaCasa12M / 100);
  const deflatedFinalSalary = hasAnyIncomeToChart ? displayFinal / summaryInflationFactor : 0;
  const breakevenSalarySaved = hasAnyIncomeToChart ? displayInitial * summaryInflationFactor : 0;
  const realDiffReaisDisplay = hasAnyIncomeToChart ? displayFinal - breakevenSalarySaved : null;
  const realChangePctDisplay =
    nominalGrowthDisplay !== null
      ? ((1 + nominalGrowthDisplay / 100) / summaryInflationFactor - 1) * 100
      : null;

  const dateRangeText = formatDateRangeLabel(initialDateInput, finalDateInput, 'Período ativo');
  const startMonthShort = formatMonthYearLabel(initialDateInput);
  const endMonthShort = formatMonthYearLabel(finalDateInput);

  // Construção dinâmica das séries dos dois gráficos SVG (13 pontos mensais de t=0..12)
  const chartData = useMemo(() => {
    if (!hasAnyIncomeToChart) return null;

    const chartInflFactor = Math.max(0.01, 1 + appliedInflation / 100);
    const steps = 12;
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const nom = displayInitial + (displayFinal - displayInitial) * t;
      const inflAtT = Math.pow(chartInflFactor, t);
      const defl = nom / inflAtT;
      const idxBase100 = 100 * (nom / displayInitial / inflAtT);
      return { i, nom, defl, idxBase100 };
    });

    const allSalaries = points.flatMap((p) => [p.nom, p.defl]);
    const minSal = Math.min(...allSalaries);
    const maxSal = Math.max(...allSalaries);
    const salSpan = Math.max(1, maxSal - minSal);
    const padSal = salSpan * 0.15;
    const lowSal = minSal - padSal;
    const highSal = maxSal + padSal;

    const toSalaryY = (val: number) => 150 - ((val - lowSal) / Math.max(1, highSal - lowSal)) * 120;

    const allIdx = points.map((p) => p.idxBase100).concat(100);
    const minIdx = Math.min(...allIdx);
    const maxIdx = Math.max(...allIdx);
    const idxSpan = Math.max(2, maxIdx - minIdx);
    const lowIdx = minIdx - idxSpan * 0.15;
    const highIdx = maxIdx + idxSpan * 0.15;

    const toIndexY = (val: number) => 155 - ((val - lowIdx) / Math.max(1, highIdx - lowIdx)) * 125;

    const coords = points.map((p) => {
      const x = (p.i / steps) * 540;
      return {
        ...p,
        x,
        nomY: toSalaryY(p.nom),
        deflY: toSalaryY(p.defl),
        idxY: toIndexY(p.idxBase100),
      };
    });

    const nomPath = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.nomY.toFixed(1)}`)
      .join(' ');
    const deflPath = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.deflY.toFixed(1)}`)
      .join(' ');
    const areaPoints = [
      ...coords.map((c) => `${c.x.toFixed(1)},${c.nomY.toFixed(1)}`),
      ...[...coords].reverse().map((c) => `${c.x.toFixed(1)},${c.deflY.toFixed(1)}`),
    ].join(' ');

    const idxPath = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.idxY.toFixed(1)}`)
      .join(' ');
    const idxAreaPoints = [
      ...coords.map((c) => `${c.x.toFixed(1)},${c.idxY.toFixed(1)}`),
      `540,170`,
      `0,170`,
    ].join(' ');
    const base100Y = toIndexY(100);

    // 6 rótulos de datas intermediárias distribuídos entre initialDateInput e finalDateInput
    const startMs = parseIsoDateToLocalTimestamp(initialDateInput);
    const endMs = parseIsoDateToLocalTimestamp(finalDateInput);
    const tickLabels = Array.from({ length: 6 }, (_, idx) => {
      if (startMs > 0 && endMs >= startMs) {
        const ms = startMs + ((endMs - startMs) * idx) / 5;
        const d = new Date(ms);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return formatMonthYearLabel(ym);
      }
      return idx === 0 ? startMonthShort : idx === 5 ? endMonthShort : `M+${idx * 2}`;
    });

    const lastPoint = coords[coords.length - 1];
    const finalIndexValue = lastPoint.idxBase100;
    const finalRealPct = finalIndexValue - 100;
    const breakevenSal = displayInitial * chartInflFactor;
    const gapToBreakeven = breakevenSal - displayFinal;
    const workingDaysNeeded =
      gapToBreakeven > 0 && displayFinal > 0 ? (gapToBreakeven / displayFinal) * 22 : 0;

    return {
      coords,
      nomPath,
      deflPath,
      areaPoints,
      idxPath,
      idxAreaPoints,
      base100Y,
      tickLabels,
      finalNominal: lastPoint.nom,
      finalDeflated: lastPoint.defl,
      deflatedGap: lastPoint.defl - lastPoint.nom,
      finalIndexValue,
      finalRealPct,
      workingDaysNeeded,
    };
  }, [
    hasAnyIncomeToChart,
    displayInitial,
    displayFinal,
    appliedInflation,
    initialDateInput,
    finalDateInput,
    startMonthShort,
    endMonthShort,
  ]);

  const handlePreset = (type: 'breakeven' | 'gain1' | 'gain2') => {
    setActivePreset(type);
    if (type === 'breakeven') setTargetRealGain(0.0);
    if (type === 'gain1') setTargetRealGain(1.0);
    if (type === 'gain2') setTargetRealGain(2.5);
  };

  const handleApplyToPlan = async () => {
    setSaveNotice(null);
    if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
      setSaveNotice({
        type: 'error',
        text: 'Informe um salário base maior que zero antes de salvar no planejamento.',
      });
      return;
    }
    if (!Number.isFinite(currentActualSalary) || currentActualSalary < 0) {
      setSaveNotice({
        type: 'error',
        text: 'Informe uma renda atual válida (maior ou igual a zero).',
      });
      return;
    }
    if (!isValidIsoDate(initialDateInput) || !isValidIsoDate(finalDateInput)) {
      setSaveNotice({
        type: 'error',
        text: 'As datas inicial e final precisam ser datas válidas no formato AAAA-MM-DD.',
      });
      return;
    }
    if (initialDateInput > finalDateInput) {
      setSaveNotice({
        type: 'error',
        text: 'A data inicial deve ser anterior ou igual à data final de referência.',
      });
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateIncome(baseSalary, currentActualSalary, {
        initialDate: initialDateInput,
        finalDate: finalDateInput,
      });
      setSaveNotice({
        type: 'success',
        text: 'Faixa de renda e datas de referência sincronizadas com sua análise econômica!',
      });
    } catch {
      setSaveNotice({
        type: 'error',
        text: 'Não foi possível salvar a atualização de renda. Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full px-6 lg:px-12 py-6 max-w-[1440px] mx-auto gap-6">
      {/* Top Demo Banner & Analytical Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-[#eff4ff] rounded-xl px-4 py-2.5 shadow-sm border border-[#e5eeff]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#006a61] text-[#ffffff]">
            <span className="material-symbols-outlined text-[15px]">balance</span>
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono uppercase tracking-wider text-[#45464d] font-semibold">Módulo Econômico</span>
            <span className="text-[#c6c6cd]">/</span>
            <span className="text-[#0b1c30] font-medium">Impacto Real no Orçamento Doméstico</span>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ffffff] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#006a61] animate-pulse" />
          <span className="font-mono text-xs text-[#0b1c30] font-medium">
            {isDemo ? 'Modo demonstração — valores fictícios' : 'Cenário Familiar Real'}
          </span>
        </div>
      </div>

      {/* Header & Parameter Overview Matrix */}
      <div className="flex flex-col xl:flex-row gap-6 items-stretch">
        {/* Macro Heading and Scenario Description */}
        <div className="flex-1 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-mono text-xs uppercase tracking-widest text-[#006a61] bg-[#86f2e4]/30 px-2.5 py-0.5 rounded-full font-semibold">
                Análise Temporal Consolidada
              </span>
              <span className="font-mono text-xs text-[#76777d]">{dateRangeText}</span>
            </div>
            <h1 className="text-3xl font-bold text-[#0b1c30] tracking-tight mt-1">Renda e Poder de Compra</h1>
            <p className="text-xs text-[#45464d] max-w-2xl mt-1 leading-relaxed">
              Avaliação da defasagem inflacionária sobre o rendimento familiar no ciclo analisado. O índice afere a variação real do poder aquisitivo ponderada pela sua cesta do domicílio.
            </p>
          </div>

          {/* Parameter Bar Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 mt-4 border-t border-[#eff4ff]">
            <div className="flex flex-col bg-[#eff4ff] rounded-lg p-3">
              <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
                {startMonthShort !== '—' ? `Renda ${startMonthShort}` : 'Renda Inicial'}
              </span>
              <span className="text-lg font-bold text-[#0b1c30] font-mono mt-0.5">
                {hasAnyIncomeToChart ? formatCurrencyBR(displayInitial) : 'Não informada'}
              </span>
              <span className="text-[11px] text-[#76777d] mt-1">Marco inicial</span>
            </div>
            <div className="flex flex-col bg-[#eff4ff] rounded-lg p-3">
              <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
                {endMonthShort !== '—' ? `Renda ${endMonthShort}` : 'Renda Atual'}
              </span>
              <span className="text-lg font-bold text-[#0b1c30] font-mono mt-0.5">
                {hasAnyIncomeToChart ? formatCurrencyBR(displayFinal) : 'Não informada'}
              </span>
              <span
                className={`text-[11px] font-semibold font-mono mt-1 ${
                  nominalGrowthDisplay === null
                    ? 'text-[#76777d]'
                    : nominalGrowthDisplay >= 0
                    ? 'text-[#006a61]'
                    : 'text-[#ba1a1a]'
                }`}
              >
                {nominalGrowthDisplay !== null
                  ? `${formatSignedPercent(nominalGrowthDisplay)} nominal`
                  : 'Preencha no simulador'}
              </span>
            </div>
            <div className="flex flex-col bg-[#131b2e] text-[#ffffff] rounded-lg p-3 shadow-inner">
              <span className="font-mono text-xs text-[#dae2fd] uppercase tracking-wider font-semibold">
                IPCA-Casa Pessoal
              </span>
              <span
                className={`text-lg font-bold font-mono mt-0.5 ${
                  ipcaCasa12M < 0 ? 'text-[#86f2e4]' : ipcaCasa12M > 0 ? 'text-[#ffdad6]' : 'text-[#ffffff]'
                }`}
              >
                {formatSignedPercent(ipcaCasa12M)}
              </span>
              <span className="text-[11px] text-[#bec6e0] mt-1">Cesta efetiva apurada</span>
            </div>
            <div className="flex flex-col bg-[#eff4ff] rounded-lg p-3">
              <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">IPCA Oficial IBGE</span>
              <span className="text-lg font-bold text-[#497cff] font-mono mt-0.5">
                {formatSignedPercent(ipcaIBGE12M)}
              </span>
              <span className="text-[11px] text-[#76777d] mt-1 font-mono">
                Divergência: {spreadPP > 0 ? '+' : spreadPP < 0 ? '-' : ''}
                {Math.abs(spreadPP).toFixed(2).replace('.', ',')} p.p.
              </span>
            </div>
          </div>
        </div>

        {/* Editorial Context */}
        <div className="w-full xl:w-80 bg-[#eff4ff] rounded-xl p-5 flex flex-col justify-between shadow-sm border border-[#e5eeff]">
          {!hasAnyIncomeToChart ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#497cff]" />
                  <span className="font-mono text-xs uppercase font-semibold tracking-wider text-[#497cff]">
                    Renda Não Cadastrada
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0b1c30]">Diagnóstico Pendente</h3>
                <p className="text-xs text-[#45464d] leading-relaxed">
                  Informe o rendimento inicial e atual no simulador abaixo e clique em sincronizar para calcular o ganho ou corrosão real frente ao seu IPCA-Casa.
                </p>
              </div>
              <a
                href="#simulador-renda"
                className="mt-4 w-full py-2.5 bg-[#000000] text-[#ffffff] rounded-lg font-mono text-xs text-center hover:bg-[#213145] transition-colors"
              >
                Informar Renda Agora
              </a>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      (realChangePctDisplay ?? 0) < 0 ? 'bg-[#ba1a1a]' : 'bg-[#006a61]'
                    }`}
                  />
                  <span
                    className={`font-mono text-xs uppercase font-semibold tracking-wider ${
                      (realChangePctDisplay ?? 0) < 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                    }`}
                  >
                    {(realChangePctDisplay ?? 0) < 0
                      ? 'Déficit Real Detectado'
                      : 'Ganho / Equilíbrio Real'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  {(realChangePctDisplay ?? 0) < 0
                    ? 'Ilusão Monetária Familiar'
                    : 'Poder Aquisitivo Protegido'}
                </h3>
                <p className="text-xs text-[#45464d] leading-relaxed">
                  {(realChangePctDisplay ?? 0) < 0
                    ? `Mesmo com variação nominal de ${formatCurrencyBR(
                        displayFinal - displayInitial
                      )}, a inflação de ${formatSignedPercent(
                        ipcaCasa12M
                      )} na sua cesta corroeu o poder de compra líquido.`
                    : `Sua variação salarial nominal de ${formatCurrencyBR(
                        displayFinal - displayInitial
                      )} acompanhou ou superou a inflação da cesta (${formatSignedPercent(
                        ipcaCasa12M
                      )}).`}
                </p>
              </div>
              <div className="mt-4 p-3 bg-[#ffffff] rounded-lg border border-[#e5eeff] font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#45464d]">Salário Efetivo:</span>
                  <span className="font-bold text-[#0b1c30]">{formatCurrencyBR(displayFinal)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[#45464d]">Salário Deflacionado:</span>
                  <span
                    className={`font-bold ${
                      deflatedFinalSalary < displayInitial ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                    }`}
                  >
                    {formatCurrencyBR(deflatedFinalSalary)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Key Metrics Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Variação Nominal */}
        <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between gap-2 border border-[#eff4ff]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Variação Nominal</span>
            <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#0b1c30]">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </span>
          </div>
          <div className="flex flex-col">
            <div className="text-2xl font-bold text-[#0b1c30] font-mono tracking-tight">
              {nominalGrowthDisplay !== null ? formatSignedPercent(nominalGrowthDisplay) : 'Aguardando'}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">
              {hasAnyIncomeToChart
                ? `${formatCurrencyBR(displayInitial)} → ${formatCurrencyBR(displayFinal)}`
                : 'Informe as rendas no simulador'}
            </span>
          </div>
          <div
            className={`pt-1 flex items-center gap-1 font-mono text-xs ${
              nominalGrowthDisplay === null
                ? 'text-[#76777d]'
                : nominalGrowthDisplay >= 0
                ? 'text-[#006a61]'
                : 'text-[#ba1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {nominalGrowthDisplay !== null && nominalGrowthDisplay < 0
                ? 'trending_down'
                : 'trending_up'}
            </span>
            <span>
              {nominalGrowthDisplay === null
                ? 'Sem histórico salarial'
                : `Diferença: ${displayFinal >= displayInitial ? '+' : '-'}${formatCurrencyBR(
                    Math.abs(displayFinal - displayInitial)
                  )}`}
            </span>
          </div>
        </div>

        {/* Card 2: Inflação Pessoal IPCA-Casa */}
        <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between gap-2 border border-[#eff4ff]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Inflação Pessoal</span>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                ipcaCasa12M < 0 ? 'bg-[#86f2e4]/40 text-[#006a61]' : 'bg-[#ffdad6]/40 text-[#ba1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {ipcaCasa12M < 0 ? 'trending_down' : 'local_fire_department'}
              </span>
            </span>
          </div>
          <div className="flex flex-col">
            <div
              className={`text-2xl font-bold font-mono tracking-tight ${
                ipcaCasa12M < 0 ? 'text-[#006a61]' : ipcaCasa12M > 0 ? 'text-[#ba1a1a]' : 'text-[#0b1c30]'
              }`}
            >
              {formatSignedPercent(ipcaCasa12M)}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">IPCA-Casa ({summary.timeframeLabel})</span>
          </div>
          <div
            className={`pt-1 flex items-center gap-1 font-mono text-xs ${
              spreadPP > 0 ? 'text-[#ba1a1a]' : spreadPP < 0 ? 'text-[#006a61]' : 'text-[#76777d]'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {spreadPP > 0 ? 'priority_high' : 'check_circle'}
            </span>
            <span>
              {spreadPP > 0 ? '+' : spreadPP < 0 ? '-' : ''}
              {Math.abs(spreadPP).toFixed(2).replace('.', ',')} p.p. vs. IBGE
            </span>
          </div>
        </div>

        {/* Card 3: Poder de Compra Real */}
        <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between gap-2 border border-[#eff4ff]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Poder de Compra Real</span>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                realChangePctDisplay === null
                  ? 'bg-[#eff4ff] text-[#76777d]'
                  : realChangePctDisplay < 0
                  ? 'bg-[#ffdad6]/40 text-[#ba1a1a]'
                  : 'bg-[#86f2e4]/40 text-[#006a61]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {realChangePctDisplay !== null && realChangePctDisplay >= 0
                  ? 'trending_up'
                  : 'trending_down'}
              </span>
            </span>
          </div>
          <div className="flex flex-col">
            <div
              className={`text-2xl font-bold font-mono tracking-tight ${
                realChangePctDisplay === null
                  ? 'text-[#76777d]'
                  : realChangePctDisplay < 0
                  ? 'text-[#ba1a1a]'
                  : 'text-[#006a61]'
              }`}
            >
              {realChangePctDisplay !== null ? formatSignedPercent(realChangePctDisplay) : 'Aguardando'}
            </div>
            <span className="font-mono text-[11px] text-[#76777d] mt-0.5">
              [(1 + g) / (1 + π) - 1]
            </span>
          </div>
          <div
            className={`pt-1 flex items-center gap-1 font-mono text-xs ${
              realChangePctDisplay === null
                ? 'text-[#76777d]'
                : realChangePctDisplay < 0
                ? 'text-[#ba1a1a]'
                : 'text-[#006a61]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                realChangePctDisplay === null
                  ? 'bg-[#c6c6cd]'
                  : realChangePctDisplay < 0
                  ? 'bg-[#ba1a1a]'
                  : 'bg-[#006a61]'
              }`}
            />
            <span>
              {realChangePctDisplay === null
                ? 'Cadastre a renda'
                : realChangePctDisplay < 0
                ? 'Corrosão real líquida'
                : realChangePctDisplay > 0
                ? 'Ganho real líquido'
                : 'Equilíbrio exato'}
            </span>
          </div>
        </div>

        {/* Card 4: Perda/Ganho Monetário Real */}
        <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between gap-2 border border-[#eff4ff]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
              {realDiffReaisDisplay !== null && realDiffReaisDisplay >= 0
                ? 'Superávit Real'
                : 'Diferença Real Mensal'}
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#0b1c30]">
              <span className="material-symbols-outlined text-[18px]">price_change</span>
            </span>
          </div>
          <div className="flex flex-col">
            <div
              className={`text-2xl font-bold font-mono tracking-tight ${
                realDiffReaisDisplay === null
                  ? 'text-[#76777d]'
                  : realDiffReaisDisplay < 0
                  ? 'text-[#ba1a1a]'
                  : 'text-[#006a61]'
              }`}
            >
              {realDiffReaisDisplay !== null ? (
                <>
                  {realDiffReaisDisplay < 0 ? '-' : realDiffReaisDisplay > 0 ? '+' : ''}
                  {formatCurrencyBR(Math.abs(realDiffReaisDisplay))}
                  <span className="text-xs text-[#76777d] font-normal">/mês</span>
                </>
              ) : (
                'Não apurado'
              )}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">
              {realDiffReaisDisplay === null
                ? 'Aguardando faixa de renda'
                : realDiffReaisDisplay < 0
                ? 'Déficit para manter padrão'
                : 'Excedente frente à inflação'}
            </span>
          </div>
          <div className="pt-1 font-mono text-xs text-[#76777d]">
            {realDiffReaisDisplay !== null
              ? `${formatCurrencyBR(Math.abs(realDiffReaisDisplay) * 12)} projeção 12 meses`
              : 'Sem dados salariais'}
          </div>
        </div>
      </div>

      {/* Didactic Educational Block */}
      <div className="bg-[#eff4ff] rounded-xl p-6 shadow-sm flex flex-col lg:flex-row gap-6 items-start justify-between border border-[#e5eeff]">
        <div className="flex items-start gap-3 max-w-sm">
          <div className="w-10 h-10 rounded-xl bg-[#000000] text-[#ffffff] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">school</span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-xs uppercase font-semibold text-[#76777d] tracking-wider">
              Guia Metodológico
            </span>
            <h2 className="text-lg font-bold text-[#0b1c30] mt-0.5">Atenção aos Conceitos</h2>
            <p className="text-xs text-[#45464d] mt-1 leading-relaxed">
              Entender a mecânica entre índices nominais e deflacionados evita a armadilha do falso ganho financeiro.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#006a61]" />
                <span className="text-xs font-semibold text-[#0b1c30]">Variação Nominal</span>
              </div>
              <p className="text-xs text-[#45464d] mt-1 leading-relaxed">
                É o aumento numérico bruto do salário na conta bancária. Representa a quantia de dinheiro facial, sem ajuste de poder de compra.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#eff4ff] font-mono text-[11px] text-[#76777d]">
              {hasAnyIncomeToChart
                ? `Seu caso: ${formatCurrencyBR(displayInitial)} → ${formatCurrencyBR(displayFinal)} (${formatSignedPercent(
                    nominalGrowthDisplay ?? 0
                  )})`
                : 'Medida em moeda corrente (sem deflacionar)'}
            </div>
          </div>

          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
                <span className="text-xs font-semibold text-[#0b1c30]">Inflação Familiar</span>
              </div>
              <p className="text-xs text-[#45464d] mt-1 leading-relaxed">
                É a variação do custo real da cesta consumida estritamente pela sua família, mensurada com os pesos do seu perfil de gastos.
              </p>
            </div>
            <div
              className={`mt-3 pt-2 border-t border-[#eff4ff] font-mono text-[11px] ${
                ipcaCasa12M < 0 ? 'text-[#006a61]' : 'text-[#ba1a1a]'
              }`}
            >
              Cesta familiar: {formatSignedPercent(ipcaCasa12M)} no período
            </div>
          </div>

          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#497cff]" />
                <span className="text-xs font-semibold text-[#0b1c30]">Rendimento Real</span>
              </div>
              <p className="text-xs text-[#45464d] mt-1 leading-relaxed">
                O crescimento salarial descontado da taxa de inflação da cesta. Ter aumento de salário não garante ganho real se o custo de vida subiu mais.
              </p>
            </div>
            <div
              className={`mt-3 pt-2 border-t border-[#eff4ff] font-mono text-[11px] ${
                realChangePctDisplay === null
                  ? 'text-[#76777d]'
                  : realChangePctDisplay < 0
                  ? 'text-[#ba1a1a]'
                  : 'text-[#006a61]'
              }`}
            >
              {realChangePctDisplay !== null
                ? `Resultado real líquido: ${formatSignedPercent(realChangePctDisplay)}`
                : 'Insira os salários abaixo para calcular'}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section (2 Columns Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Chart 1: Renda Nominal vs. Renda Deflacionada */}
        <div className="bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#eff4ff]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0b1c30]" />
                <h3 className="text-base font-semibold text-[#0b1c30]">Evolução Nominal vs. Deflacionada</h3>
              </div>
              <span className="text-xs text-[#76777d]">Renda nominal recebida vs. Poder real medido em R$ constantes</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#0b1c30]" />
                <span className="text-[#0b1c30]">Nominal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-[#ba1a1a]" />
                <span className="text-[#ba1a1a]">Deflacionada</span>
              </div>
            </div>
          </div>

          {!chartData ? (
            <div className="py-12 my-4 text-center rounded-xl bg-[#eff4ff]/50 border border-dashed border-[#c6c6cd] text-xs font-mono text-[#76777d]">
              Informe uma renda base maior que zero no simulador abaixo para plotar a comparação nominal vs. deflacionada.
            </div>
          ) : (
            <>
              <div className="py-4">
                <div className="relative w-full h-52 flex items-end">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 540 180">
                    <defs>
                      <linearGradient id="lossGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    <line stroke="#eff4ff" strokeWidth="1" x1="0" x2="540" y1="20" y2="20" />
                    <line stroke="#eff4ff" strokeWidth="1" x1="0" x2="540" y1="65" y2="65" />
                    <line stroke="#eff4ff" strokeWidth="1" x1="0" x2="540" y1="110" y2="110" />
                    <line stroke="#eff4ff" strokeWidth="1" x1="0" x2="540" y1="155" y2="155" />

                    <polygon fill="url(#lossGrad)" points={chartData.areaPoints} />

                    <path
                      d={chartData.nomPath}
                      fill="none"
                      stroke="#0b1c30"
                      strokeLinecap="round"
                      strokeWidth="2.5"
                    />

                    <path
                      d={chartData.deflPath}
                      fill="none"
                      stroke="#ba1a1a"
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                      strokeWidth="2.5"
                    />

                    <circle cx="0" cy={chartData.coords[0].nomY} fill="#0b1c30" r="4.5" />
                    <circle
                      cx="540"
                      cy={chartData.coords[chartData.coords.length - 1].nomY}
                      fill="#0b1c30"
                      r="5"
                    />
                    <circle
                      cx="540"
                      cy={chartData.coords[chartData.coords.length - 1].deflY}
                      fill="#ba1a1a"
                      r="5"
                    />
                  </svg>
                </div>
                <div className="flex justify-between text-xs font-mono text-[#76777d] mt-2">
                  {chartData.tickLabels.map((lbl, idx) => (
                    <span key={`${lbl}-${idx}`}>{lbl}</span>
                  ))}
                </div>
              </div>

              <div className="bg-[#eff4ff] rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div>
                  <span className="text-[#76777d]">Renda Nominal:</span>
                  <span className="font-bold text-[#0b1c30] ml-1">
                    {formatCurrencyBR(chartData.finalNominal)}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-bold ${
                      chartData.deflatedGap < 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                    }`}
                  >
                    Efeito Preços: {chartData.deflatedGap < 0 ? '-' : '+'}
                    {formatCurrencyBR(Math.abs(chartData.deflatedGap))}
                  </span>
                </div>
                <div>
                  <span className="text-[#76777d]">Renda Deflacionada:</span>
                  <span
                    className={`font-bold ml-1 ${
                      chartData.finalDeflated < displayInitial ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                    }`}
                  >
                    {formatCurrencyBR(chartData.finalDeflated)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Chart 2: Índice do Poder de Compra (Base 100) */}
        <div className="bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#eff4ff]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#006a61]" />
                <h3 className="text-base font-semibold text-[#0b1c30]">Índice do Poder de Compra</h3>
              </div>
              <span className="text-xs text-[#76777d]">
                Base 100 fixada em {startMonthShort !== '—' ? startMonthShort : 'início do período'}
              </span>
            </div>
            <div
              className={`inline-flex items-center px-2.5 py-1 rounded-full font-mono text-xs font-bold ${
                !chartData
                  ? 'bg-[#eff4ff] text-[#76777d]'
                  : chartData.finalRealPct < 0
                  ? 'bg-[#ffdad6]/40 text-[#ba1a1a]'
                  : 'bg-[#86f2e4]/40 text-[#006a61]'
              }`}
            >
              {chartData
                ? `Final: ${chartData.finalIndexValue.toFixed(2).replace('.', ',')} pts (${formatSignedPercent(
                    chartData.finalRealPct
                  )})`
                : 'Base 100,00 pts'}
            </div>
          </div>

          {!chartData ? (
            <div className="py-12 my-4 text-center rounded-xl bg-[#eff4ff]/50 border border-dashed border-[#c6c6cd] text-xs font-mono text-[#76777d]">
              A trajetória Base 100 será calculada automaticamente assim que a renda inicial for cadastrada.
            </div>
          ) : (
            <>
              <div className="py-4">
                <div className="relative w-full h-52 flex items-end">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 540 180">
                    <defs>
                      <linearGradient id="indexGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#006a61" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#006a61" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line
                      stroke="#c6c6cd"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                      x1="0"
                      x2="540"
                      y1={chartData.base100Y}
                      y2={chartData.base100Y}
                    />
                    <text
                      fill="#76777d"
                      fontFamily="JetBrains Mono"
                      fontSize="10"
                      fontWeight="500"
                      x="5"
                      y={Math.max(12, chartData.base100Y - 8)}
                    >
                      BASE 100.00 (Equilíbrio)
                    </text>

                    <polygon fill="url(#indexGrad)" points={chartData.idxAreaPoints} />

                    <path
                      d={chartData.idxPath}
                      fill="none"
                      stroke="#006a61"
                      strokeLinecap="round"
                      strokeWidth="2.5"
                    />

                    <circle cx="0" cy={chartData.coords[0].idxY} fill="#006a61" r="4.5" />
                    <circle
                      cx="540"
                      cy={chartData.coords[chartData.coords.length - 1].idxY}
                      fill={chartData.finalRealPct < 0 ? '#ba1a1a' : '#006a61'}
                      r="5"
                    />
                  </svg>
                </div>
                <div className="flex justify-between text-xs font-mono text-[#76777d] mt-2">
                  <span>{chartData.tickLabels[0]} (100)</span>
                  <span>
                    {chartData.tickLabels[2]} ({chartData.coords[4].idxBase100.toFixed(1)})
                  </span>
                  <span>
                    {chartData.tickLabels[3]} ({chartData.coords[8].idxBase100.toFixed(1)})
                  </span>
                  <span>
                    {chartData.tickLabels[5]} ({chartData.finalIndexValue.toFixed(2)})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#eff4ff] rounded-lg p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006a61] text-[20px]">shopping_cart_checkout</span>
                  <div className="flex flex-col text-xs">
                    <span className="text-[#76777d]">Equivalência Física</span>
                    <span className="font-semibold text-[#0b1c30]">
                      {chartData.finalRealPct < 0
                        ? `Cesta ${Math.abs(chartData.finalRealPct).toFixed(2).replace('.', ',')}% menor`
                        : chartData.finalRealPct > 0
                        ? `Cesta +${chartData.finalRealPct.toFixed(2).replace('.', ',')}% maior`
                        : 'Cesta equivalente (0,00%)'}
                    </span>
                  </div>
                </div>
                <div className="bg-[#eff4ff] rounded-lg p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#497cff] text-[20px]">schedule</span>
                  <div className="flex flex-col text-xs">
                    <span className="text-[#76777d]">Dias de Trabalho (base 22d)</span>
                    <span className="font-semibold text-[#0b1c30]">
                      {chartData.workingDaysNeeded > 0
                        ? `Mais ${chartData.workingDaysNeeded.toFixed(1).replace('.', ',')} dias para empatar`
                        : 'Sem déficit de horas extras'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Interactive Rebalancing Simulator */}
      <div
        id="simulador-renda"
        className="bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col gap-6 border border-[#eff4ff]"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#eff4ff]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#0b1c30]">
                <span className="material-symbols-outlined text-[18px]">calculate</span>
              </span>
              <h2 className="text-lg font-semibold text-[#0b1c30]">Simulador de Reajuste e Atualização de Renda</h2>
            </div>
            <p className="text-xs text-[#45464d] mt-1">
              Atualize sua renda inicial, atual e datas de referência ou calcule o salário necessário para neutralizar o IPCA-Casa.
            </p>
          </div>

          {/* Presets */}
          <div className="inline-flex p-1 bg-[#eff4ff] rounded-lg gap-1 self-start md:self-auto font-mono text-xs flex-wrap">
            <button
              type="button"
              onClick={() => handlePreset('breakeven')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                activePreset === 'breakeven' ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Empate Inflacionário (0,0%)
            </button>
            <button
              type="button"
              onClick={() => handlePreset('gain1')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                activePreset === 'gain1' ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Ganho Real +1,0%
            </button>
            <button
              type="button"
              onClick={() => handlePreset('gain2')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                activePreset === 'gain2' ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Ganho Real +2,5%
            </button>
          </div>
        </div>

        {saveNotice && (
          <div
            className={`px-4 py-3 rounded-lg text-xs font-mono flex items-center justify-between gap-2 ${
              saveNotice.type === 'success'
                ? 'bg-[#86f2e4]/30 text-[#006a61] border border-[#006a61]/20'
                : 'bg-[#ffdad6]/60 text-[#ba1a1a] border border-[#ba1a1a]/20'
            }`}
          >
            <span>{saveNotice.text}</span>
            <button
              type="button"
              onClick={() => setSaveNotice(null)}
              className="text-current underline cursor-pointer shrink-0"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Controls (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono font-semibold text-[#0b1c30] uppercase">
                  Meta de Ganho Real Almejada
                </label>
                <span className="font-mono font-bold text-xs bg-[#eff4ff] px-2 py-0.5 rounded text-[#0b1c30]">
                  {formatSignedPercent(targetRealGain)} real
                </span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="5.0"
                step="0.25"
                value={targetRealGain}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTargetRealGain(val);
                  setActivePreset(val === 0 ? 'breakeven' : val === 1 ? 'gain1' : 'gain2');
                }}
                className="w-full h-2 bg-[#eff4ff] rounded-lg appearance-none cursor-pointer accent-[#000000]"
              />
              <div className="flex justify-between text-[#76777d] font-mono text-[10px]">
                <span>-2,0% (Defasagem)</span>
                <span>0,0% (Empate exato)</span>
                <span>+5,0% (Expansão real)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-xs uppercase text-[#45464d] font-semibold">
                  Renda Inicial / Base
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[#76777d] font-mono text-xs font-semibold">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#eff4ff] text-[#0b1c30] font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-xs uppercase text-[#45464d] font-semibold">
                  Renda Atual Recebida
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[#76777d] font-mono text-xs font-semibold">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={currentActualSalary}
                    onChange={(e) => setCurrentActualSalary(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#eff4ff] text-[#0b1c30] font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-xs uppercase text-[#45464d] font-semibold">
                  Data Inicial de Referência
                </label>
                <input
                  type="date"
                  value={initialDateInput}
                  onChange={(e) => setInitialDateInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-[#eff4ff] text-[#0b1c30] font-mono text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-xs uppercase text-[#45464d] font-semibold">
                  Data Final de Referência
                </label>
                <input
                  type="date"
                  value={finalDateInput}
                  onChange={(e) => setFinalDateInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-[#eff4ff] text-[#0b1c30] font-mono text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="font-mono text-xs uppercase text-[#45464d] font-semibold">
                  Taxa IPCA-Casa Aplicada na Simulação
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    value={appliedInflation}
                    onChange={(e) => setAppliedInflation(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 pl-3 pr-8 rounded-lg bg-[#eff4ff] text-[#0b1c30] font-mono text-sm focus:outline-none"
                  />
                  <span className="absolute right-3 text-[#76777d] font-mono text-xs font-semibold">%</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#eff4ff] rounded-lg flex items-start gap-2 text-xs text-[#45464d]">
              <span className="material-symbols-outlined text-[18px] text-[#76777d] shrink-0 mt-0.5">info</span>
              <span>
                Cálculo composto: <strong className="font-mono text-[#0b1c30]">Renda = Base × (1 + IPCA) × (1 + Ganho Real)</strong>.
              </span>
            </div>
          </div>

          {/* Result Card (5 cols) */}
          <div className="lg:col-span-5 bg-[#131b2e] text-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-[#dae2fd] font-semibold">
                Salário Alvo Necessário
              </span>
              <span className="px-2 py-0.5 rounded bg-[#ffffff]/10 text-xs font-mono font-medium">
                {targetRealGain === 0
                  ? 'Equilíbrio Neutro'
                  : targetRealGain > 0
                  ? `Ganho Real (+${targetRealGain.toFixed(1)}%)`
                  : 'Defasagem'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs uppercase text-[#bec6e0] font-mono">Renda Bruta Ajustada</span>
              <div className="text-3xl font-bold font-mono text-[#ffffff] tracking-tight mt-1">
                {hasSimBase ? formatCurrencyBR(neededSalary) : 'Informe a renda base'}
              </div>
              <span className="text-xs text-[#bec6e0] mt-1 font-mono">
                {!hasSimBase
                  ? 'Necessário salário inicial > R$ 0,00'
                  : monthlyGap >= 0
                  ? `+${formatCurrencyBR(monthlyGap)} acima do salário atual (${formatCurrencyBR(
                      currentActualSalary
                    )})`
                  : `-${formatCurrencyBR(Math.abs(monthlyGap))} abaixo do salário atual (${formatCurrencyBR(
                      currentActualSalary
                    )})`}
              </span>
            </div>

            <div className="pt-3 border-t border-[#ffffff]/15 flex flex-col gap-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#bec6e0]">Reajuste Total s/ Base:</span>
                <span className="font-bold text-[#ffffff]">
                  {hasSimBase ? formatSignedPercent(totalPercentageNeeded) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#bec6e0]">Diferença Mensal:</span>
                <span className="font-bold text-[#86f2e4]">
                  {hasSimBase
                    ? `${monthlyGap > 0 ? '+' : monthlyGap < 0 ? '-' : ''}${formatCurrencyBR(
                        Math.abs(monthlyGap)
                      )} /mês`
                    : '—'}
                </span>
              </div>
            </div>

            <button
              onClick={handleApplyToPlan}
              disabled={isSaving}
              className="w-full h-10 mt-1 bg-[#ffffff] text-[#0b1c30] rounded-lg text-xs font-semibold hover:bg-[#eff4ff] disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>{isSaving ? 'Sincronizando...' : 'Salvar Renda no Planejamento'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

