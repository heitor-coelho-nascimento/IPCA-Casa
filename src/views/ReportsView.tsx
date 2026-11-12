import React, { useMemo, useState } from 'react';
import { EconomicCalculationSummary, FamilyProfile, MonthlyClosure, ProfileMode } from '../types';
import { trackExportData } from '../services/analytics';
import { IBGESeriesMetadata } from '../services/ibge';
import { buildMonthlyClosureSnapshot, compareMonthlyClosures } from '../services/economics';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDateRangeLabel, formatIsoDateBR, getTodayIsoDate } from '../utils/dates';
import { getProfileModeCopy } from '../utils/profileMode';

interface ReportsViewProps {
  summary: EconomicCalculationSummary;
  activeProfile?: FamilyProfile;
  ibgeData?: IBGESeriesMetadata | null;
  isDemo: boolean;
  profileMode?: ProfileMode;
  monthlyClosures?: MonthlyClosure[];
  onSaveMonthlyClosure?: (closure: MonthlyClosure, allowOverwrite?: boolean) => void | Promise<void>;
  onDeleteMonthlyClosure?: (closureId: string) => void | Promise<void>;
}

function formatSignedPercent(value: number, digits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : safe < 0 ? '-' : ''}${Math.abs(safe).toFixed(digits).replace('.', ',')}%`;
}

function formatSignedPP(value: number, digits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : safe < 0 ? '-' : ''}${Math.abs(safe).toFixed(digits).replace('.', ',')} p.p.`;
}

function formatMoneyBR(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  summary,
  activeProfile,
  ibgeData = null,
  isDemo,
  profileMode = 'pessoal',
  monthlyClosures = [],
  onSaveMonthlyClosure,
  onDeleteMonthlyClosure,
}) => {
  const {
    totalMonthlySpend,
    ipcaCasa12M,
    ipcaIBGE12M,
    spreadPP,
    groupContributions,
    topVillains,
    purchasingPower,
    calculatedItems,
    timeframeLabel,
  } = summary;

  const modeCopy = getProfileModeCopy(profileMode);
  const isBiz = modeCopy.mode === 'negocio';
  const todayIso = getTodayIsoDate();

  const [closureMonthKey, setClosureMonthKey] = useState<string>(todayIso.slice(0, 7));
  const [closureNotes, setClosureNotes] = useState<string>('');
  const [isSavingClosure, setIsSavingClosure] = useState(false);
  const [pendingOverwriteClosure, setPendingOverwriteClosure] = useState<MonthlyClosure | null>(null);
  const [closureToDelete, setClosureToDelete] = useState<MonthlyClosure | null>(null);

  const sortedClosures = useMemo(
    () => [...monthlyClosures].sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    [monthlyClosures]
  );

  const monthComparison = useMemo(() => {
    if (sortedClosures.length < 2) return null;
    return compareMonthlyClosures(sortedClosures[0], sortedClosures[1]);
  }, [sortedClosures]);

  const handlePrint = () => {
    trackExportData('print_pdf');
    window.print();
  };

  const handleTriggerSaveClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveMonthlyClosure) return;
    const snapshot = buildMonthlyClosureSnapshot({
      profileId: activeProfile?.id || 'default',
      monthKey: closureMonthKey,
      summary,
      ibgeData,
      profileMode: modeCopy.mode,
      isDemo,
      notes: closureNotes.trim() || undefined,
    });

    const alreadyExists = monthlyClosures.some((c) => c.monthKey === snapshot.monthKey);
    if (alreadyExists) {
      setPendingOverwriteClosure(snapshot);
      return;
    }

    setIsSavingClosure(true);
    try {
      await onSaveMonthlyClosure(snapshot, false);
      setClosureNotes('');
    } finally {
      setIsSavingClosure(false);
    }
  };

  const handleConfirmOverwriteClosure = async () => {
    if (!pendingOverwriteClosure || !onSaveMonthlyClosure) return;
    const target = pendingOverwriteClosure;
    setPendingOverwriteClosure(null);
    setIsSavingClosure(true);
    try {
      await onSaveMonthlyClosure(target, true);
      setClosureNotes('');
    } finally {
      setIsSavingClosure(false);
    }
  };

  const handleConfirmDeleteClosure = async () => {
    if (!closureToDelete || !onDeleteMonthlyClosure) return;
    const id = closureToDelete.id;
    setClosureToDelete(null);
    await onDeleteMonthlyClosure(id);
  };

  const incomePeriodLabel = purchasingPower.hasIncomeData
    ? formatDateRangeLabel(purchasingPower.initialDate, purchasingPower.finalDate, timeframeLabel)
    : timeframeLabel;

  const ibgeOriginLabel =
    ibgeData?.sourceMode === 'live' && !ibgeData.isContingencyData
      ? 'SIDRA/IBGE em tempo real'
      : ibgeData?.sourceMode === 'cached_live'
      ? 'SIDRA/IBGE em cache local'
      : 'Contingência offline';

  return (
    <div className="flex flex-col w-full px-6 lg:px-12 py-8 max-w-[1440px] mx-auto gap-8 print:p-0 print:max-w-none">
      {/* Action Bar (hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#eff4ff] rounded-xl border border-[#e5eeff] print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006a61] text-[#ffffff] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">description</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#0b1c30]">
              {isBiz
                ? 'Fechamentos Mensais & Relatório de Custos do Negócio'
                : 'Fechamentos Mensais & Relatório do Orçamento Familiar'}
            </span>
            <span className="text-xs text-[#45464d]">
              Salve snapshots mensais para comparar meses anteriores ou exporte o documento completo em PDF.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="h-10 px-5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>Imprimir / Gerar PDF</span>
          </button>
        </div>
      </div>

      {/* Fechamento Mensal (Snapshots & Comparação Mês a Mês) */}
      <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#eff4ff]">
          <div>
            <h2 className="text-base font-bold text-[#0b1c30]">Fechamento Mensal (Snapshots)</h2>
            <p className="text-xs text-[#45464d]">
              Registre a fotografia consolidada do mês para acompanhar a evolução de gastos, margem e inflação ao longo do tempo.
            </p>
          </div>
          <span className="font-mono text-xs text-[#006a61] font-semibold">
            {sortedClosures.length} {sortedClosures.length === 1 ? 'mês fechado' : 'meses fechados'}
          </span>
        </div>

        {onSaveMonthlyClosure && (
          <form
            onSubmit={handleTriggerSaveClosure}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-4 rounded-xl bg-[#eff4ff] border border-[#e5eeff] print:hidden"
          >
            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="text-[11px] font-mono uppercase text-[#45464d] font-semibold">
                Competência (Mês/Ano)
              </label>
              <input
                type="month"
                required
                value={closureMonthKey}
                onChange={(e) => setClosureMonthKey(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] bg-[#ffffff] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <div className="md:col-span-6 flex flex-col gap-1">
              <label className="text-[11px] font-mono uppercase text-[#45464d] font-semibold">
                Observação do Fechamento (opcional)
              </label>
              <input
                type="text"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                placeholder={
                  isBiz
                    ? 'Ex: Reajuste de farinha e energia no mês'
                    : 'Ex: Mês com aumento na conta de luz'
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] bg-[#ffffff] text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={isSavingClosure}
                className="w-full h-10 px-4 rounded-lg bg-[#006a61] text-[#ffffff] hover:bg-[#004e47] text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">event_available</span>
                <span>{isSavingClosure ? 'Salvando...' : 'Fechar Mês e Salvar Snapshot'}</span>
              </button>
            </div>
          </form>
        )}

        {monthComparison && sortedClosures.length >= 2 && (
          <div className="p-4 rounded-xl bg-[#131b2e] text-[#ffffff] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#86f2e4] font-semibold">
                Comparação Mês a Mês ({sortedClosures[1].monthLabel} → {sortedClosures[0].monthLabel})
              </span>
              <p className="text-xs text-[#dae2fd] leading-relaxed">{monthComparison.summaryText}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-[#bec6e0]">Diferença de gasto</span>
                <span
                  className={`font-bold ${
                    monthComparison.spendDiffReais > 0 ? 'text-[#ffb4ab]' : 'text-[#86f2e4]'
                  }`}
                >
                  {monthComparison.spendDiffReais >= 0 ? '+R$ ' : '-R$ '}
                  {formatMoneyBR(Math.abs(monthComparison.spendDiffReais))}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-[#bec6e0]">Variação IPCA-Casa</span>
                <span className="font-bold text-[#ffffff]">
                  {formatSignedPP(monthComparison.ipcaCasaDiffPP)}
                </span>
              </div>
            </div>
          </div>
        )}

        {sortedClosures.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#eff4ff]/50 text-center text-xs font-mono text-[#76777d]">
            Nenhum fechamento mensal salvo ainda. Use o botão acima para salvar o primeiro snapshot.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#eff4ff] text-[#45464d] font-mono uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">Mês</th>
                  <th className="py-2.5 px-3 font-semibold text-right">{modeCopy.spendLabel}</th>
                  <th className="py-2.5 px-3 font-semibold text-right">IPCA-Casa</th>
                  <th className="py-2.5 px-3 font-semibold text-right">IBGE</th>
                  <th className="py-2.5 px-3 font-semibold">Maior Vilão</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Fechado em</th>
                  {onDeleteMonthlyClosure && (
                    <th className="py-2.5 px-3 font-semibold text-center print:hidden">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff] text-[#0b1c30]">
                {sortedClosures.map((cls) => (
                  <tr key={cls.id} className="hover:bg-[#eff4ff]/50">
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {cls.monthLabel}
                      {cls.dataOrigin === 'demonstrativo' && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-[#eff4ff] text-[10px] text-[#45464d] font-normal">
                          Demo
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      R$ {formatMoneyBR(cls.totalMonthlySpend)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        cls.ipcaCasaPercent > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                      }`}
                    >
                      {formatSignedPercent(cls.ipcaCasaPercent)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#45464d]">
                      {formatSignedPercent(cls.ipcaOficialPercent)}
                    </td>
                    <td className="py-2.5 px-3 text-[#45464d]">
                      {cls.topDriverName
                        ? `${cls.topDriverName}${
                            typeof cls.topDriverChangePercent === 'number'
                              ? ` (${formatSignedPercent(cls.topDriverChangePercent, 1)})`
                              : ''
                          }`
                        : cls.topCategory || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#76777d]">
                      {formatIsoDateBR(cls.closedAt)}
                    </td>
                    {onDeleteMonthlyClosure && (
                      <td className="py-2.5 px-3 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => setClosureToDelete(cls)}
                          className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[#76777d] hover:bg-[#ffdad6] hover:text-[#ba1a1a] transition-colors cursor-pointer"
                          title="Excluir fechamento"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Report Document Sheet */}
      <div className="bg-[#ffffff] rounded-2xl p-8 lg:p-12 shadow-sm border border-[#eff4ff] flex flex-col gap-8 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-[#0b1c30]">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-[#006a61] font-mono text-xs uppercase tracking-wider font-bold">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Laudo Econométrico Oficial • IPCA-Casa</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#0b1c30] tracking-tight mt-1">
              Demonstrativo de Inflação Familiar Ponderada
            </h1>
            <span className="text-xs text-[#45464d] mt-1">
              Metodologia de Laspeyres Ponderada por Gastos Reais da Família
              {activeProfile
                ? ` • ${activeProfile.name} (${activeProfile.referenceRegion}, ${activeProfile.membersCount} ${
                    activeProfile.membersCount === 1 ? 'integrante' : 'integrantes'
                  })`
                : ''}
            </span>
          </div>

          <div className="flex flex-col sm:items-end text-xs font-mono text-[#45464d] gap-0.5">
            <span className="font-bold text-[#0b1c30]">Data de Emissão: {formatIsoDateBR(todayIso)}</span>
            <span>Período de Referência: {incomePeriodLabel}</span>
            <span className="text-[#006a61] font-semibold">
              {isDemo ? 'Família Modelo (Demonstração)' : activeProfile?.name || 'Cesta Familiar Cadastrada'}
            </span>
            <span className="text-[11px] text-[#76777d]">
              IBGE: {ibgeOriginLabel}
              {ibgeData?.latestMonthLabel ? ` (${ibgeData.latestMonthLabel})` : ''}
            </span>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[#eff4ff] rounded-xl flex flex-col border border-[#e5eeff]">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
              IPCA-Casa ({timeframeLabel})
            </span>
            <span
              className={`text-2xl font-bold font-mono mt-1 ${
                ipcaCasa12M > 0 ? 'text-[#ba1a1a]' : ipcaCasa12M < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
              }`}
            >
              {formatSignedPercent(ipcaCasa12M)}
            </span>
            <span className="text-[11px] text-[#76777d] mt-0.5">
              {calculatedItems.length === 0 ? 'cesta sem itens ativos' : 'inflação real sentida'}
            </span>
          </div>

          <div className="p-4 bg-[#eff4ff] rounded-xl flex flex-col border border-[#e5eeff]">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
              IPCA Oficial (IBGE)
            </span>
            <span className="text-2xl font-bold font-mono text-[#0b1c30] mt-1">
              {formatSignedPercent(ipcaIBGE12M)}
            </span>
            <span className="text-[11px] text-[#76777d] mt-0.5">
              {ibgeData?.latestMonthLabel ? `média nacional (${ibgeData.latestMonthLabel})` : 'média macroeconômica'}
            </span>
          </div>

          <div className="p-4 bg-[#eff4ff] rounded-xl flex flex-col border border-[#e5eeff]">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
              Spread Familiar
            </span>
            <span
              className={`text-2xl font-bold font-mono mt-1 ${
                spreadPP > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
              }`}
            >
              {formatSignedPP(spreadPP)}
            </span>
            <span className="text-[11px] text-[#76777d] mt-0.5">diferença relativa</span>
          </div>

          <div className="p-4 bg-[#eff4ff] rounded-xl flex flex-col border border-[#e5eeff]">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
              Despesa Mensal Base
            </span>
            <span className="text-2xl font-bold font-mono text-[#0b1c30] mt-1">
              R$ {formatMoneyBR(totalMonthlySpend)}
            </span>
            <span className="text-[11px] text-[#76777d] mt-0.5">
              {calculatedItems.length} {calculatedItems.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
            </span>
          </div>
        </div>

        {/* Methodology Section */}
        <div className="p-5 bg-[#eff4ff] rounded-xl flex flex-col gap-3 border border-[#e5eeff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#497cff]">functions</span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0b1c30]">
              Fundamentação Metodológica: Índice de Preços de Laspeyres
            </span>
          </div>
          <p className="text-xs text-[#45464d] leading-relaxed">
            {'O IPCA-Casa adota a formulação clássica de Laspeyres, onde as ponderações orçamentárias (w_i) são fixadas com base na despesa domiciliar corrente do período de referência. Cada variação de preço relativo (ΔP_i = (P_1,i - P_0,i) / P_0,i) é multiplicada pela sua proporção no gasto total familiar (w_i = G_i / ∑G):'}
          </p>
          <div className="p-3 bg-[#ffffff] rounded-lg font-mono text-xs text-[#0b1c30] flex flex-col sm:flex-row items-center justify-around gap-2 border border-[#c6c6cd]/30">
            <div>
              <strong>Fórmula do IPCA-Casa:</strong> <span className="text-[#006a61]">{'IPCA_casa = ∑ (w_i × ΔP_i)'}</span>
            </div>
            <div className="hidden sm:block text-[#c6c6cd]">|</div>
            <div>
              <strong>Contribuição Ponderada:</strong> <span className="text-[#497cff]">{'C_i = w_i × ΔP_i'}</span>
            </div>
          </div>
        </div>

        {/* Group Breakdown Table */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-[#0b1c30]">
            1. Ponderação & Contribuição por Grupo de Consumo (Classificação IBGE)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#eff4ff] text-[#45464d] font-mono uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">Grupo de Consumo</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gasto Mensal</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Peso Orçamentário (w)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Inflação do Grupo</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Contribuição (p.p.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff] text-[#0b1c30]">
                {groupContributions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 px-3 text-center text-[#76777d] font-mono">
                      Nenhum grupo com despesa registrada nesta cesta familiar até o momento.
                    </td>
                  </tr>
                ) : (
                  groupContributions.map((gc) => {
                    const groupRate =
                      gc.weightPercent > 0 ? gc.weightedContribution / (gc.weightPercent / 100) : 0;
                    return (
                      <tr key={gc.group} className="hover:bg-[#eff4ff]/60">
                        <td className="py-2.5 px-3 font-semibold">{gc.group}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          R$ {formatMoneyBR(gc.totalSpend)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {gc.weightPercent.toFixed(2).replace('.', ',')}%
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            groupRate > 0 ? 'text-[#ba1a1a]' : groupRate < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                          }`}
                        >
                          {formatSignedPercent(groupRate)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            gc.weightedContribution > 0
                              ? 'text-[#ba1a1a]'
                              : gc.weightedContribution < 0
                              ? 'text-[#006a61]'
                              : 'text-[#0b1c30]'
                          }`}
                        >
                          {formatSignedPP(gc.weightedContribution)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Villains Section */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-[#0b1c30]">
            2. Principais Vilões do Orçamento Familiar (Maior Impacto Ponderado)
          </h2>
          {topVillains.length === 0 ? (
            <div className="p-4 bg-[#eff4ff] rounded-xl text-xs font-mono text-[#76777d] border border-[#e5eeff]">
              Cadastre itens com preço base e preço atual para identificar os maiores impactos ponderados da cesta.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {topVillains.slice(0, 6).map((item, idx) => {
                const isRelief = item.weightedContribution < 0;
                const pct = item.priceChangePercent ?? 0;
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-[#eff4ff] rounded-xl flex flex-col justify-between border border-[#e5eeff]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#0b1c30] truncate">
                        #{idx + 1} {item.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                          isRelief
                            ? 'bg-[#86f2e4]/40 text-[#006a61]'
                            : 'bg-[#ba1a1a]/15 text-[#ba1a1a]'
                        }`}
                      >
                        {formatSignedPP(item.weightedContribution)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] font-mono text-[#76777d]">
                      <span>Variação: {formatSignedPercent(pct, 1)}</span>
                      <span>Peso: {item.weightPercent.toFixed(2).replace('.', ',')}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Power of Purchase Analysis */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-[#0b1c30]">
            3. Diagnóstico do Poder de Compra & Equilíbrio Salarial
          </h2>
          <div className="p-4 bg-[#eff4ff] rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-[#e5eeff]">
            <div className="flex flex-col text-xs">
              <span className="font-bold text-[#0b1c30]">
                {purchasingPower.realPurchasingPowerChangePercent !== null &&
                purchasingPower.realPurchasingPowerChangePercent >= 0
                  ? 'Evolução Real Positiva no Salário Familiar:'
                  : 'Variação Real Sentida no Salário Familiar:'}
              </span>
              <p className="text-[#45464d] mt-1 leading-relaxed">
                Com o IPCA-Casa acumulado em <strong>{formatSignedPercent(ipcaCasa12M)}</strong>
                {purchasingPower.nominalIncomeGrowthPercent !== null && (
                  <>
                    {' '}e o reajuste salarial nominal observado de{' '}
                    <strong>{formatSignedPercent(purchasingPower.nominalIncomeGrowthPercent)}</strong>
                  </>
                )}
                {purchasingPower.realPurchasingPowerChangePercent !== null ? (
                  <>
                    , o poder de compra real da família registrou variação de{' '}
                    <strong
                      className={
                        purchasingPower.realPurchasingPowerChangePercent < 0
                          ? 'text-[#ba1a1a]'
                          : 'text-[#006a61]'
                      }
                    >
                      {formatSignedPercent(purchasingPower.realPurchasingPowerChangePercent)}
                    </strong>
                    .
                  </>
                ) : (
                  ', aguardando cadastro de renda inicial e atual para apuração da variação real do poder de compra.'
                )}
              </p>
            </div>
            {purchasingPower.neededSalaryForBreakeven !== null &&
              purchasingPower.finalIncome !== null && (
                <div className="p-3 bg-[#ffffff] rounded-lg shrink-0 font-mono text-xs flex flex-col items-end border border-[#c6c6cd]/30">
                  <span className="text-[#76777d]">Salário Necessário para Breakeven:</span>
                  <span className="text-lg font-bold text-[#006a61]">
                    R$ {formatMoneyBR(purchasingPower.neededSalaryForBreakeven)}
                  </span>
                  {(() => {
                    const gap = purchasingPower.neededSalaryForBreakeven - purchasingPower.finalIncome;
                    return (
                      <span className={`text-[10px] ${gap > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'}`}>
                        {gap > 0
                          ? `Defasagem mensal: R$ ${formatMoneyBR(gap)}`
                          : gap < 0
                          ? `Folga mensal: +R$ ${formatMoneyBR(Math.abs(gap))}`
                          : 'Em ponto de equilíbrio exato'}
                      </span>
                    );
                  })()}
                </div>
              )}
          </div>
        </div>

        {/* Audit Signatures / Footer */}
        <div className="pt-8 mt-4 border-t border-[#eff4ff] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#76777d] gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#006a61]">verified_user</span>
            <span>
              IPCA-Casa • {ibgeData?.source || 'IBGE SIDRA (Tabelas 1737 e 7060)'}
            </span>
          </div>
          <span>
            Página 1 de 1 • Emitido em {formatIsoDateBR(todayIso)} • {modeCopy.modeTitle}
          </span>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingOverwriteClosure)}
        title="Substituir Fechamento Existente"
        message={
          pendingOverwriteClosure
            ? `Já existe um fechamento salvo para ${pendingOverwriteClosure.monthLabel}. Deseja substituir o snapshot anterior pelos valores atuais?`
            : ''
        }
        confirmLabel="Sim, Substituir"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmOverwriteClosure}
        onCancel={() => setPendingOverwriteClosure(null)}
      />

      <ConfirmModal
        isOpen={Boolean(closureToDelete)}
        title="Excluir Fechamento Mensal"
        message={
          closureToDelete
            ? `Deseja realmente excluir o snapshot de fechamento de ${closureToDelete.monthLabel}?`
            : ''
        }
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDeleteClosure}
        onCancel={() => setClosureToDelete(null)}
      />
    </div>
  );
};

