import React, { useEffect, useState, useMemo } from 'react';
import { EconomicCalculationSummary, PocketImpactPerspective } from '../types';
import {
  calculateEstimatedMonthlyImpact,
  calculateEstimatedAnnualImpact,
  calculateRealIncomeDifference,
  calculateObservedBasketDifference,
} from '../services/economics';
import { trackCalculateImpact } from '../services/analytics';

interface PocketImpactViewProps {
  summary: EconomicCalculationSummary;
  onUpdateIncome?: (initial: number, current: number) => void;
  isDemo?: boolean;
}

export const PocketImpactView: React.FC<PocketImpactViewProps> = ({
  summary,
  onUpdateIncome,
  isDemo = false,
}) => {
  // Dados de renda editáveis pelo usuário
  const [initialIncomeInput, setInitialIncomeInput] = useState<number>(
    summary.purchasingPower.initialIncome || 10000
  );
  const [currentIncomeInput, setCurrentIncomeInput] = useState<number>(
    summary.purchasingPower.finalIncome || 10500
  );
  const [incomeSavedMsg, setIncomeSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof summary.purchasingPower.initialIncome === 'number') {
      setInitialIncomeInput(summary.purchasingPower.initialIncome);
    }
    if (typeof summary.purchasingPower.finalIncome === 'number') {
      setCurrentIncomeInput(summary.purchasingPower.finalIncome);
    }
  }, [summary.purchasingPower.initialIncome, summary.purchasingPower.finalIncome]);

  // Gasto mensal de referência (editável com slider/input ou atrelado à cesta)
  const defaultSpend = summary.totalMonthlySpend > 0 ? summary.totalMonthlySpend : 3000;
  const [customSpend, setCustomSpend] = useState<number>(defaultSpend);
  const [useCustomSpend, setUseCustomSpend] = useState<boolean>(false);

  // Perspectiva selecionada para o cálculo
  const [perspective, setPerspective] = useState<PocketImpactPerspective>('ipca-casa');

  // Gasto efetivo considerado no cálculo
  const referenceSpend = useCustomSpend ? customSpend : defaultSpend;

  // Taxa de inflação conforme a perspectiva
  const activeRatePercent = useMemo(() => {
    if (perspective === 'ipca-oficial') {
      return summary.ipcaIBGE12M;
    }
    return summary.ipcaCasa12M;
  }, [perspective, summary.ipcaIBGE12M, summary.ipcaCasa12M]);

  // Cálculos centrais conforme especificação
  const monthlyImpact = useMemo(() => {
    return calculateEstimatedMonthlyImpact(referenceSpend, activeRatePercent);
  }, [referenceSpend, activeRatePercent]);

  const annualImpact = useMemo(() => {
    return calculateEstimatedAnnualImpact(referenceSpend, activeRatePercent);
  }, [referenceSpend, activeRatePercent]);

  const incomeCalc = useMemo(() => {
    return calculateRealIncomeDifference(initialIncomeInput, currentIncomeInput, activeRatePercent);
  }, [initialIncomeInput, currentIncomeInput, activeRatePercent]);

  const observedBasketDiff = useMemo(() => {
    return calculateObservedBasketDifference(summary.calculatedItems);
  }, [summary.calculatedItems]);

  const nominalIncomeChangeReais = currentIncomeInput - initialIncomeInput;
  const nominalIncomeChangePercent =
    initialIncomeInput > 0 ? (nominalIncomeChangeReais / initialIncomeInput) * 100 : 0;

  // Comparativo simultâneo das 3 perspectivas (sem somar)
  const officialMonthlyImpact = calculateEstimatedMonthlyImpact(referenceSpend, summary.ipcaIBGE12M);
  const personalMonthlyImpact = calculateEstimatedMonthlyImpact(referenceSpend, summary.ipcaCasa12M);

  const handleSaveIncome = () => {
    if (onUpdateIncome) {
      onUpdateIncome(initialIncomeInput, currentIncomeInput);
      trackCalculateImpact(perspective, 'pocket-impact');
      setIncomeSavedMsg('Rendas salvas e parâmetros recalculados com sucesso!');
    }
  };

  return (
    <div className="flex flex-col w-full px-6 lg:px-12 py-8 max-w-[1440px] mx-auto gap-8">
      {incomeSavedMsg && (
        <div className="p-3 bg-[#86f2e4]/20 border border-[#006a61]/30 rounded-xl text-xs font-mono text-[#005049] flex items-center justify-between">
          <span>{incomeSavedMsg}</span>
          <button type="button" onClick={() => setIncomeSavedMsg(null)} className="cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
      {/* Sub-Header Ribbon */}
      <div className="p-3 bg-[#eff4ff] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-[#e5eeff]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#006a61] animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-[#45464d] font-semibold">
            {isDemo ? 'Modo Demonstração — Valores Didáticos' : 'Cálculo Personalizado do Seu Orçamento'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-[#45464d]">
          <span className="material-symbols-outlined text-[16px] text-[#006a61]">payments</span>
          <span>Diferencial Exclusivo: Inflação em Reais (R$)</span>
        </div>
      </div>

      {/* Main Title & Concept Explanation */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#006a61] font-mono text-xs uppercase tracking-wider font-semibold">
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            <span>Inteligência Financeira Real</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-[#0b1c30] tracking-tight mt-1">
            Impacto no seu Bolso
          </h1>
          <p className="text-xs text-[#45464d] mt-1 max-w-3xl leading-relaxed">
            A inflação não é apenas um percentual estatístico abstrato. Veja exatamente quantos <strong>Reais (R$)</strong> a alta de preços drena do seu orçamento todo mês e quanto seu salário precisa aumentar para manter seu padrão de vida.
          </p>
        </div>

        {/* Perspective Selector Tabs */}
        <div className="flex flex-col gap-1 items-start md:items-end">
          <span className="text-[11px] font-mono text-[#76777d]">Selecione a Perspectiva de Cálculo:</span>
          <div className="flex items-center p-1 bg-[#eff4ff] rounded-xl border border-[#e5eeff]">
            <button
              type="button"
              onClick={() => {
                setPerspective('ipca-casa');
                trackCalculateImpact('ipca-casa', 'pocket-impact');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                perspective === 'ipca-casa'
                  ? 'bg-[#000000] text-[#ffffff] shadow-sm'
                  : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              IPCA-Casa ({summary.ipcaCasa12M.toFixed(2)}%)
            </button>
            <button
              type="button"
              onClick={() => {
                setPerspective('ipca-oficial');
                trackCalculateImpact('ipca-oficial', 'pocket-impact');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                perspective === 'ipca-oficial'
                  ? 'bg-[#000000] text-[#ffffff] shadow-sm'
                  : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              IPCA Oficial ({summary.ipcaIBGE12M.toFixed(2)}%)
            </button>
            <button
              type="button"
              onClick={() => {
                setPerspective('variacao-cesta');
                trackCalculateImpact('variacao-cesta', 'pocket-impact');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                perspective === 'variacao-cesta'
                  ? 'bg-[#000000] text-[#ffffff] shadow-sm'
                  : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Cesta Observada (R$)
            </button>
          </div>
        </div>
      </div>

      {/* Non-Summing Warning Banner */}
      <div className="p-3 bg-[#eff4ff] border border-[#e5eeff] rounded-xl flex items-center gap-3 text-xs text-[#45464d]">
        <span className="material-symbols-outlined text-[20px] text-[#497cff] shrink-0">
          tips_and_updates
        </span>
        <div className="leading-relaxed">
          <strong>Atenção Metodológica:</strong> Não some os resultados das três perspectivas! Elas representam abordagens analíticas alternativas: o <strong>IPCA Oficial</strong> reflete a média nacional do IBGE; o <strong>IPCA-Casa</strong> aplica os pesos da sua cesta pessoal; e a <strong>Cesta Observada</strong> afere a diferença direta em Reais entre os preços antigos e atuais que você registrou.
        </div>
      </div>

      {/* Hero Financial Impact Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Impacto Mensal em Reais */}
        <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">
              Custo Mensal da Inflação
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#ffdad6]/40 flex items-center justify-center text-[#ba1a1a]">
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono tracking-tight text-[#ba1a1a]">
              -R$ {monthlyImpact.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-[#76777d]">/mês</span>
            </div>
            <p className="text-xs text-[#45464d] mt-1">
              Gasto mensal de R$ {referenceSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sujeito a {activeRatePercent.toFixed(2)}% de inflação.
            </p>
          </div>
          <div className="pt-2 border-t border-[#eff4ff] text-[11px] font-mono text-[#76777d]">
            Fórmula: Gasto × ({activeRatePercent.toFixed(2)} / 100)
          </div>
        </div>

        {/* Card 2: Impacto em 12 Meses (sem dupla contagem) */}
        <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">
              Corrosão em 12 Meses
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#0b1c30]">
              <span className="material-symbols-outlined text-[18px]">date_range</span>
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono tracking-tight text-[#0b1c30]">
              -R$ {annualImpact.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-[#76777d]">/ano</span>
            </div>
            <p className="text-xs text-[#45464d] mt-1">
              Projeção sob a premissa de manutenção do gasto mensal, sem dupla contagem de taxas.
            </p>
          </div>
          <div className="pt-2 border-t border-[#eff4ff] text-[11px] font-mono text-[#76777d]">
            Fórmula: Impacto Mensal × 12
          </div>
        </div>

        {/* Card 3: Renda Necessária para Preservar Poder de Compra */}
        <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">
              Salário de Equilíbrio
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#006a61]">
              <span className="material-symbols-outlined text-[18px]">balance</span>
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono tracking-tight text-[#006a61]">
              R$ {incomeCalc.neededIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-[#45464d] mt-1">
              Valor necessário para empatar com a alta de preços e comprar exatamente o mesmo conjunto de bens.
            </p>
          </div>
          <div className="pt-2 border-t border-[#eff4ff] text-[11px] font-mono text-[#76777d]">
            Fórmula: Renda Inicial × (1 + {activeRatePercent.toFixed(2)}%)
          </div>
        </div>

        {/* Card 4: Saldo Real da Família */}
        <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">
              Saldo Real no Bolso
            </span>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                incomeCalc.hasLoss ? 'bg-[#ffdad6]/40 text-[#ba1a1a]' : 'bg-[#86f2e4]/30 text-[#006a61]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {incomeCalc.hasLoss ? 'money_off' : 'attach_money'}
              </span>
            </span>
          </div>
          <div className="my-3">
            <div
              className={`text-3xl font-bold font-mono tracking-tight ${
                incomeCalc.hasLoss ? 'text-[#ba1a1a]' : 'text-[#006a61]'
              }`}
            >
              {incomeCalc.differenceReais >= 0 ? '+R$ ' : '-R$ '}
              {Math.abs(incomeCalc.differenceReais).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-[#45464d] mt-1">
              {incomeCalc.hasLoss
                ? 'Sua renda atual está abaixo do necessário para preservar seu poder de compra.'
                : 'Sua renda acompanhou a inflação com ganho real de poder aquisitivo.'}
            </p>
          </div>
          <div className="pt-2 border-t border-[#eff4ff] text-[11px] font-mono text-[#76777d]">
            Fórmula: Renda Atual - Salário Necessário
          </div>
        </div>
      </div>

      {/* Seção Interativa: Parâmetros de Renda & Gastos Editáveis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Painel de Edição da Renda e Gastos (6 colunas) */}
        <div className="lg:col-span-6 bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#0b1c30]">
                <span className="material-symbols-outlined text-[20px]">tune</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Parâmetros Financeiros do seu Domicílio
                </h3>
                <p className="text-xs text-[#45464d]">
                  Altere a renda e os gastos para simular o impacto financeiro em tempo real.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d] font-medium">
                Renda Mensal no Início do Período (R$):
              </label>
              <input
                type="number"
                step="100"
                value={initialIncomeInput}
                onChange={(e) => setInitialIncomeInput(parseFloat(e.target.value) || 0)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono font-bold text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
              <span className="text-[11px] text-[#76777d]">Salário base de 12 meses atrás</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d] font-medium">
                Renda Mensal Atual (R$):
              </label>
              <input
                type="number"
                step="100"
                value={currentIncomeInput}
                onChange={(e) => setCurrentIncomeInput(parseFloat(e.target.value) || 0)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono font-bold text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
              <span className="text-[11px] text-[#76777d]">
                Reajuste observado: {nominalIncomeChangePercent >= 0 ? '+' : ''}
                {nominalIncomeChangePercent.toFixed(2)}% ({nominalIncomeChangeReais >= 0 ? '+R$ ' : '-R$ '}
                {Math.abs(nominalIncomeChangeReais).toFixed(2)})
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[#eff4ff]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#45464d] font-medium">
                Gasto Mensal de Referência:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseCustomSpend(false)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                    !useCustomSpend ? 'bg-[#131b2e] text-[#ffffff]' : 'bg-[#eff4ff] text-[#45464d]'
                  }`}
                >
                  Da Cesta (R$ {defaultSpend.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomSpend(true)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                    useCustomSpend ? 'bg-[#131b2e] text-[#ffffff]' : 'bg-[#eff4ff] text-[#45464d]'
                  }`}
                >
                  Personalizado
                </button>
              </div>
            </div>

            {useCustomSpend && (
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min="1000"
                  max="30000"
                  step="250"
                  value={customSpend}
                  onChange={(e) => setCustomSpend(parseFloat(e.target.value) || 1000)}
                  className="flex-1 accent-[#000000] cursor-pointer"
                />
                <input
                  type="number"
                  step="100"
                  value={customSpend}
                  onChange={(e) => setCustomSpend(parseFloat(e.target.value) || 0)}
                  className="w-32 h-9 px-2 rounded-lg border border-[#c6c6cd] text-xs font-mono text-right font-bold text-[#0b1c30]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#eff4ff]">
            <span className="text-xs text-[#76777d]">Cálculos reagem instantaneamente às alterações</span>
            <button
              type="button"
              onClick={handleSaveIncome}
              className="h-9 px-4 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm"
            >
              Salvar Parâmetros
            </button>
          </div>
        </div>

        {/* Comparação Lado a Lado das 3 Perspectivas (6 colunas) */}
        <div className="lg:col-span-6 bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#497cff]">
                <span className="material-symbols-outlined text-[20px]">compare_arrows</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Comparativo entre Metodologias
                </h3>
                <p className="text-xs text-[#45464d]">
                  Veja como cada método enxerga o mesmo orçamento familiar.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Perspectiva 1: IPCA Oficial IBGE */}
            <div
              onClick={() => setPerspective('ipca-oficial')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                perspective === 'ipca-oficial'
                  ? 'border-[#497cff] bg-[#eff4ff]/60'
                  : 'border-[#eff4ff] hover:border-[#c6c6cd] bg-[#ffffff]'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#0b1c30]">
                  1. Pelo IPCA Oficial do IBGE (+{summary.ipcaIBGE12M.toFixed(2)}%)
                </span>
                <span className="text-xs text-[#45464d] mt-0.5">
                  Média estatística do país para famílias de 1 a 40 salários mínimos.
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-sm text-[#ba1a1a] block">
                  -R$ {officialMonthlyImpact.toFixed(2).replace('.', ',')}
                  <span className="text-[10px] text-[#76777d]">/mês</span>
                </span>
                <span className="font-mono text-[11px] text-[#76777d]">
                  -R$ {(officialMonthlyImpact * 12).toFixed(2).replace('.', ',')}/ano
                </span>
              </div>
            </div>

            {/* Perspectiva 2: IPCA-Casa (Ponderado pela Cesta Pessoal) */}
            <div
              onClick={() => setPerspective('ipca-casa')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                perspective === 'ipca-casa'
                  ? 'border-[#000000] bg-[#eff4ff]/60'
                  : 'border-[#eff4ff] hover:border-[#c6c6cd] bg-[#ffffff]'
              }`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#0b1c30]">
                    2. Pelo IPCA-Casa (+{summary.ipcaCasa12M.toFixed(2)}%)
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#006a61] text-[#ffffff]">
                    Sua Cesta
                  </span>
                </div>
                <span className="text-xs text-[#45464d] mt-0.5">
                  Fórmula de Laspeyres aplicando a ponderação real dos seus hábitos.
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-sm text-[#ba1a1a] block">
                  -R$ {personalMonthlyImpact.toFixed(2).replace('.', ',')}
                  <span className="text-[10px] text-[#76777d]">/mês</span>
                </span>
                <span className="font-mono text-[11px] text-[#76777d]">
                  -R$ {(personalMonthlyImpact * 12).toFixed(2).replace('.', ',')}/ano
                </span>
              </div>
            </div>

            {/* Perspectiva 3: Variação Real Efetiva dos Itens */}
            <div
              onClick={() => setPerspective('variacao-cesta')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                perspective === 'variacao-cesta'
                  ? 'border-[#006a61] bg-[#86f2e4]/15'
                  : 'border-[#eff4ff] hover:border-[#c6c6cd] bg-[#ffffff]'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#0b1c30]">
                  3. Diferença Direta nos Preços Registrados
                </span>
                <span className="text-xs text-[#45464d] mt-0.5">
                  Soma em reais da diferença direta entre o preço novo e antigo multiplicado pelas quantidades.
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-sm text-[#0b1c30] block">
                  {observedBasketDiff >= 0 ? '+R$ ' : '-R$ '}
                  {Math.abs(observedBasketDiff).toFixed(2).replace('.', ',')}
                  <span className="text-[10px] text-[#76777d]">/mês</span>
                </span>
                <span className="font-mono text-[11px] text-[#76777d]">
                  Observado nos itens
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decomposição do Impacto por Categorias e Maiores Vilões em R$ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Categorias que mais pesam (7 colunas) */}
        <div className="lg:col-span-7 bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
            <div>
              <h3 className="text-base font-bold text-[#0b1c30]">
                Categorias que Mais Pressionam o Orçamento
              </h3>
              <p className="text-xs text-[#45464d]">
                Distribuição do gasto mensal e contribuição na alta do custo de vida.
              </p>
            </div>
            <span className="text-xs font-mono text-[#76777d]">Em Reais e %</span>
          </div>

          <div className="flex flex-col gap-3">
            {summary.groupContributions.map((grp) => {
              const groupMonthlyImpact = (grp.totalSpend * (grp.weightedContribution / (grp.weightPercent || 1)));
              return (
                <div key={grp.group} className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#eff4ff]/40">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0b1c30] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: grp.color }} />
                      <span>{grp.group}</span>
                    </span>
                    <span className="font-mono font-bold text-[#0b1c30]">
                      R$ {grp.totalSpend.toFixed(2).replace('.', ',')}{' '}
                      <span className="text-[#76777d] font-normal">({grp.weightPercent.toFixed(1)}%)</span>
                    </span>
                  </div>

                  <div className="w-full bg-[#eff4ff] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, grp.weightPercent)}%`, backgroundColor: grp.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-[#76777d]">
                    <span>{grp.itemCount} itens monitorados</span>
                    <span className="text-[#ba1a1a] font-semibold">
                      Contribuição: +{grp.weightedContribution.toFixed(2).replace('.', ',')} p.p.
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Itens com Maior Impacto em Reais (5 colunas) */}
        <div className="lg:col-span-5 bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
            <div>
              <h3 className="text-base font-bold text-[#0b1c30]">
                Itens com Maior Peso no Bolso
              </h3>
              <p className="text-xs text-[#45464d]">
                Os produtos e serviços que mais encareceram seu orçamento.
              </p>
            </div>
            <span className="material-symbols-outlined text-[#ba1a1a] text-[20px]">warning</span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[480px] overflow-y-auto pr-1">
            {summary.topVillains.slice(0, 6).map((item, idx) => {
              const itemImpactReais = (item.monthlySpend * ((item.priceChangePercent ?? 0) / 100));
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#eff4ff]/40 border border-[#e5eeff] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#0b1c30] text-[#ffffff] font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-semibold text-[#0b1c30] truncate">{item.name}</span>
                      <span className="text-[11px] text-[#76777d] font-mono">
                        Gasto: R$ {item.monthlySpend.toFixed(2)} • Alta: +{(item.priceChangePercent ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <span className="text-xs font-bold text-[#ba1a1a] block">
                      +R$ {itemImpactReais.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-[10px] text-[#76777d]">+{item.weightedContribution.toFixed(2)} p.p.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
