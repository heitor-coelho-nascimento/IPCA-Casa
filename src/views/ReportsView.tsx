import React from 'react';
import { EconomicCalculationSummary, FamilyProfile } from '../types';
import { trackExportData } from '../services/analytics';
import { IBGESeriesMetadata } from '../services/ibge';
import { formatDateRangeLabel, formatIsoDateBR, getTodayIsoDate } from '../utils/dates';

interface ReportsViewProps {
  summary: EconomicCalculationSummary;
  activeProfile?: FamilyProfile;
  ibgeData?: IBGESeriesMetadata | null;
  isDemo: boolean;
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

  const handlePrint = () => {
    trackExportData('print_pdf');
    window.print();
  };

  const todayIso = getTodayIsoDate();
  const incomePeriodLabel = purchasingPower.hasIncomeData
    ? formatDateRangeLabel(purchasingPower.initialDate, purchasingPower.finalDate, timeframeLabel)
    : timeframeLabel;

  const ibgeOriginLabel =
    ibgeData?.sourceMode === 'live'
      ? 'SIDRA/IBGE em tempo real'
      : ibgeData?.sourceMode === 'cached_live'
      ? 'SIDRA/IBGE em cache local'
      : 'Referência offline auditada';

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
              Relatório Executivo & Laudo Econômico de Inflação Familiar
            </span>
            <span className="text-xs text-[#45464d]">
              Documento formatado para prestação de contas, planejamento financeiro e exportação em PDF.
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
            Página 1 de 1 • Emitido em {formatIsoDateBR(todayIso)} para uso familiar pessoal
          </span>
        </div>
      </div>
    </div>
  );
};

