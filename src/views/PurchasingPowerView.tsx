import React, { useState } from 'react';
import { EconomicCalculationSummary } from '../types';

interface PurchasingPowerViewProps {
  summary: EconomicCalculationSummary;
  onUpdateIncome: (initial: number, final: number) => void;
  isDemo: boolean;
}

export const PurchasingPowerView: React.FC<PurchasingPowerViewProps> = ({
  summary,
  onUpdateIncome,
  isDemo,
}) => {
  const { ipcaCasa12M, ipcaIBGE12M, spreadPP, purchasingPower } = summary;

  // Estado do simulador interativo de reajuste necessário
  const [baseSalary, setBaseSalary] = useState(purchasingPower.initialIncome || 10000);
  const [currentActualSalary, setCurrentActualSalary] = useState(purchasingPower.finalIncome || 10500);
  const [appliedInflation, setAppliedInflation] = useState(ipcaCasa12M || 6.85);
  const [targetRealGain, setTargetRealGain] = useState(0.0);
  const [activePreset, setActivePreset] = useState<'breakeven' | 'gain1' | 'gain2'>('breakeven');

  // Cálculos dinâmicos do simulador
  const inflationFactor = 1 + appliedInflation / 100;
  const realGainFactor = 1 + targetRealGain / 100;
  const neededSalary = baseSalary * inflationFactor * realGainFactor;
  const totalPercentageNeeded = ((neededSalary / baseSalary) - 1) * 100;
  const monthlyGap = neededSalary - currentActualSalary;

  const handlePreset = (type: 'breakeven' | 'gain1' | 'gain2') => {
    setActivePreset(type);
    if (type === 'breakeven') setTargetRealGain(0.0);
    if (type === 'gain1') setTargetRealGain(1.0);
    if (type === 'gain2') setTargetRealGain(2.5);
  };

  const handleApplyToPlan = () => {
    onUpdateIncome(baseSalary, currentActualSalary);
    alert('Valores de renda sincronizados com a análise econômica familiar!');
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
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-[#006a61] bg-[#86f2e4]/30 px-2.5 py-0.5 rounded-full font-semibold">
                Análise Temporal Consolidada
              </span>
              <span className="font-mono text-xs text-[#76777d]">BASE 2023.03 → 2024.03</span>
            </div>
            <h1 className="text-3xl font-bold text-[#0b1c30] tracking-tight mt-1">Renda e Poder de Compra</h1>
            <p className="text-xs text-[#45464d] max-w-2xl mt-1 leading-relaxed">
              Avaliação da defasagem inflacionária sobre o rendimento familiar no ciclo de 12 meses. O índice afere a taxa de corrosão do poder aquisitivo ponderada pelos itens reais da cesta do domicílio.
            </p>
          </div>

          {/* Parameter Bar Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 mt-4 border-t border-[#eff4ff]">
            <div className="flex flex-col bg-[#eff4ff] rounded-lg p-3">
              <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Renda Mar/2023</span>
              <span className="text-lg font-bold text-[#0b1c30] font-mono mt-0.5">
                R$ {baseSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-[#76777d] mt-1">Marco inicial</span>
            </div>
            <div className="flex flex-col bg-[#eff4ff] rounded-lg p-3">
              <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Renda Mar/2024</span>
              <span className="text-lg font-bold text-[#0b1c30] font-mono mt-0.5">
                R$ {currentActualSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-[#006a61] font-semibold font-mono mt-1">+5,00% nominal</span>
            </div>
            <div className="flex flex-col bg-[#131b2e] text-[#ffffff] rounded-lg p-3 shadow-inner">
              <span className="font-mono text-xs text-[#dae2fd] uppercase tracking-wider font-semibold">
                IPCA-Casa Pessoal
              </span>
              <span className="text-lg font-bold text-[#ba1a1a] font-mono mt-0.5">
                +{ipcaCasa12M.toFixed(2).replace('.', ',')}%
              </span>
              <span className="text-[11px] text-[#bec6e0] mt-1">Cesta efetiva apurada</span>
            </div>
            <div className="flex flex-col bg-[#eff4ff] rounded-lg p-3">
              <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">IPCA Oficial IBGE</span>
              <span className="text-lg font-bold text-[#497cff] font-mono mt-0.5">
                +{ipcaIBGE12M.toFixed(2).replace('.', ',')}%
              </span>
              <span className="text-[11px] text-[#76777d] mt-1 font-mono">Divergência: +{spreadPP.toFixed(2)} p.p.</span>
            </div>
          </div>
        </div>

        {/* Editorial Context */}
        <div className="w-full xl:w-80 bg-[#eff4ff] rounded-xl p-5 flex flex-col justify-between shadow-sm border border-[#e5eeff]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
              <span className="font-mono text-xs uppercase font-semibold tracking-wider text-[#ba1a1a]">
                Déficit Real Detectado
              </span>
            </div>
            <h3 className="text-base font-bold text-[#0b1c30]">Ilusão Monetária Familiar</h3>
            <p className="text-xs text-[#45464d] leading-relaxed">
              Embora o contracheque tenha aumentado nominalmente R$ 500, a elevação dos custos reais superou a correção salarial, gerando defasagem no poder aquisitivo.
            </p>
          </div>
          <div className="mt-4 p-3 bg-[#ffffff] rounded-lg border border-[#e5eeff] font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-[#45464d]">Salário Efetivo:</span>
              <span className="font-bold text-[#0b1c30]">R$ 10.500,00</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[#45464d]">Salário Deflacionado:</span>
              <span className="font-bold text-[#ba1a1a]">R$ 9.827,00</span>
            </div>
          </div>
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
              {purchasingPower.nominalIncomeGrowthPercent !== null
                ? `${purchasingPower.nominalIncomeGrowthPercent >= 0 ? '+' : ''}${purchasingPower.nominalIncomeGrowthPercent.toFixed(2).replace('.', ',')}%`
                : 'N/A'}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">
              {purchasingPower.initialIncome && purchasingPower.finalIncome
                ? `R$ ${purchasingPower.initialIncome.toLocaleString('pt-BR')} → R$ ${purchasingPower.finalIncome.toLocaleString('pt-BR')}`
                : '+R$ 500,00 no holerite bruto'}
            </span>
          </div>
          <div className="pt-1 flex items-center gap-1 font-mono text-xs text-[#006a61]">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            <span>Ajuste de dissídio</span>
          </div>
        </div>

        {/* Card 2: Inflação Pessoal IPCA-Casa */}
        <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between gap-2 border border-[#eff4ff]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Inflação Pessoal</span>
            <span className="w-8 h-8 rounded-lg bg-[#ffdad6]/40 flex items-center justify-center text-[#ba1a1a]">
              <span className="material-symbols-outlined text-[18px]">local_fire_department</span>
            </span>
          </div>
          <div className="flex flex-col">
            <div className="text-2xl font-bold text-[#ba1a1a] font-mono tracking-tight">
              +{ipcaCasa12M.toFixed(2).replace('.', ',')}%
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">IPCA-Casa (12 meses ponderados)</span>
          </div>
          <div className="pt-1 flex items-center gap-1 font-mono text-xs text-[#ba1a1a]">
            <span className="material-symbols-outlined text-[14px]">priority_high</span>
            <span>+{spreadPP.toFixed(2)}% vs. IBGE Geral</span>
          </div>
        </div>

        {/* Card 3: Poder de Compra Real */}
        <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between gap-2 border border-[#eff4ff]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Poder de Compra Real</span>
            <span className="w-8 h-8 rounded-lg bg-[#ffdad6]/40 flex items-center justify-center text-[#ba1a1a]">
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
            </span>
          </div>
          <div className="flex flex-col">
            <div className="text-2xl font-bold text-[#ba1a1a] font-mono tracking-tight">
              {purchasingPower.realPurchasingPowerChangePercent !== null
                ? `${purchasingPower.realPurchasingPowerChangePercent >= 0 ? '+' : ''}${purchasingPower.realPurchasingPowerChangePercent.toFixed(2).replace('.', ',')}%`
                : 'N/A'}
            </div>
            <span className="font-mono text-[11px] text-[#76777d] mt-0.5">
              [(1 + g) / (1 + π) - 1]
            </span>
          </div>
          <div className="pt-1 flex items-center gap-1 font-mono text-xs text-[#ba1a1a]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" />
            <span>Corrosão real líquida</span>
          </div>
        </div>

        {/* Card 4: Perda Monetária Real */}
        <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between gap-2 border border-[#eff4ff]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Perda Monetária Real</span>
            <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#0b1c30]">
              <span className="material-symbols-outlined text-[18px]">price_change</span>
            </span>
          </div>
          <div className="flex flex-col">
            <div className="text-2xl font-bold text-[#0b1c30] font-mono tracking-tight">
              {purchasingPower.monthlyPurchasingDeficitOrGain !== null ? (
                <>
                  {purchasingPower.monthlyPurchasingDeficitOrGain < 0 ? '-' : '+'}R$ {Math.abs(purchasingPower.monthlyPurchasingDeficitOrGain).toFixed(2).replace('.', ',')}
                  <span className="text-xs text-[#76777d] font-normal">/mês</span>
                </>
              ) : (
                'R$ 0,00'
              )}
            </div>
            <span className="text-xs text-[#45464d] mt-0.5">Déficit para manter padrão</span>
          </div>
          <div className="pt-1 font-mono text-xs text-[#76777d]">
            {purchasingPower.monthlyPurchasingDeficitOrGain !== null
              ? `R$ ${(Math.abs(purchasingPower.monthlyPurchasingDeficitOrGain) * 12).toFixed(2).replace('.', ',')} acumulado anual`
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
              Exemplo: R$ 10.000 → R$ 10.500 (+5%)
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
            <div className="mt-3 pt-2 border-t border-[#eff4ff] font-mono text-[11px] text-[#ba1a1a]">
              Exemplo: Cesta subiu +{ipcaCasa12M.toFixed(2)}% no período
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
            <div className="mt-3 pt-2 border-t border-[#eff4ff] font-mono text-[11px] text-[#ba1a1a]">
              {purchasingPower.realPurchasingPowerChangePercent !== null
                ? `Exemplo: Perda real líquida de ${purchasingPower.realPurchasingPowerChangePercent.toFixed(2)}%`
                : 'Insira os salários para calcular a variação real'}
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

                <polygon
                  fill="url(#lossGrad)"
                  points="0,110 45,108 90,107 135,105 180,103 225,102 270,100 315,98 360,97 405,95 450,96 495,95 540,94 540,128 495,124 450,121 405,119 360,116 315,114 270,113 225,112 180,111 135,111 90,110 45,110 0,110"
                />

                <path
                  d="M 0 110 L 45 108 L 90 107 L 135 105 L 180 103 L 225 102 L 270 100 L 315 98 L 360 97 L 405 95 L 450 96 L 495 95 L 540 94"
                  fill="none"
                  stroke="#0b1c30"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                />

                <path
                  d="M 0 110 L 45 110 L 90 110 L 135 111 L 180 111 L 225 112 L 270 113 L 315 114 L 360 116 L 405 119 L 450 121 L 495 124 L 540 128"
                  fill="none"
                  stroke="#ba1a1a"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                />

                <circle cx="0" cy="110" fill="#0b1c30" r="4.5" />
                <circle cx="540" cy="94" fill="#0b1c30" r="5" />
                <circle cx="540" cy="128" fill="#ba1a1a" r="5" />
              </svg>
            </div>
            <div className="flex justify-between text-xs font-mono text-[#76777d] mt-2">
              <span>Mar/23</span>
              <span>Mai/23</span>
              <span>Jul/23</span>
              <span>Set/23</span>
              <span>Nov/23</span>
              <span>Jan/24</span>
              <span>Mar/24</span>
            </div>
          </div>

          <div className="bg-[#eff4ff] rounded-lg p-3 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-[#76777d]">Renda Nominal:</span>
              <span className="font-bold text-[#0b1c30] ml-1">R$ 10.500,00</span>
            </div>
            <div>
              <span className="text-[#ba1a1a] font-bold">Gap: -R$ 673,00 vs poder real</span>
            </div>
            <div>
              <span className="text-[#76777d]">Renda Deflacionada:</span>
              <span className="font-bold text-[#ba1a1a] ml-1">R$ 9.827,00</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Índice do Poder de Compra (Base 100) */}
        <div className="bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#eff4ff]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#006a61]" />
                <h3 className="text-base font-semibold text-[#0b1c30]">Índice do Poder de Compra</h3>
              </div>
              <span className="text-xs text-[#76777d]">Base 100 fixada em Março de 2023</span>
            </div>
            <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#ffdad6]/40 text-[#ba1a1a] font-mono text-xs font-bold">
              Final: 98,27 pts (-1,73%)
            </div>
          </div>

          <div className="py-4">
            <div className="relative w-full h-52 flex items-end">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 540 180">
                <defs>
                  <linearGradient id="indexGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#006a61" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#006a61" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line stroke="#c6c6cd" strokeDasharray="3 3" strokeWidth="1.5" x1="0" x2="540" y1="50" y2="50" />
                <text fill="#76777d" fontFamily="JetBrains Mono" fontSize="10" fontWeight="500" x="5" y="42">
                  BASE 100.00 (Equilíbrio)
                </text>

                <polygon
                  fill="url(#indexGrad)"
                  points="0,50 45,52 90,54 135,56 180,62 225,68 270,72 315,79 360,86 405,94 450,105 495,116 540,126 540,170 0,170"
                />

                <path
                  d="M 0 50 L 45 52 L 90 54 L 135 56 L 180 62 L 225 68 L 270 72 L 315 79 L 360 86 L 405 94 L 450 105 L 495 116 L 540 126"
                  fill="none"
                  stroke="#006a61"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                />

                <circle cx="540" cy="126" fill="#006a61" r="5" />
                <circle cx="0" cy="50" fill="#006a61" r="4.5" />
              </svg>
            </div>
            <div className="flex justify-between text-xs font-mono text-[#76777d] mt-2">
              <span>Mar/23 (100)</span>
              <span>Mai/23 (99.8)</span>
              <span>Ago/23 (99.1)</span>
              <span>Nov/23 (98.9)</span>
              <span>Jan/24 (98.5)</span>
              <span>Mar/24 (98.27)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#eff4ff] rounded-lg p-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006a61] text-[20px]">shopping_cart_checkout</span>
              <div className="flex flex-col text-xs">
                <span className="text-[#76777d]">Equivalência Física</span>
                <span className="font-semibold text-[#0b1c30]">Cesta de compras 1,73% menor</span>
              </div>
            </div>
            <div className="bg-[#eff4ff] rounded-lg p-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#497cff] text-[20px]">schedule</span>
              <div className="flex flex-col text-xs">
                <span className="text-[#76777d]">Dias de Trabalho</span>
                <span className="font-semibold text-[#0b1c30]">Mais 4,2 dias para empatar</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Rebalancing Simulator */}
      <div className="bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col gap-6 border border-[#eff4ff]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#eff4ff]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#0b1c30]">
                <span className="material-symbols-outlined text-[18px]">calculate</span>
              </span>
              <h2 className="text-lg font-semibold text-[#0b1c30]">Simulador de Reajuste Necessário</h2>
            </div>
            <p className="text-xs text-[#45464d] mt-1">
              Calcule a renda nominal exata necessária para neutralizar o IPCA-Casa ou gerar ganho real de patrimônio familiar.
            </p>
          </div>

          {/* Presets */}
          <div className="inline-flex p-1 bg-[#eff4ff] rounded-lg gap-1 self-start md:self-auto font-mono text-xs">
            <button
              onClick={() => handlePreset('breakeven')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activePreset === 'breakeven' ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Empate Inflacionário (0,0%)
            </button>
            <button
              onClick={() => handlePreset('gain1')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activePreset === 'gain1' ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Ganho Real +1,0%
            </button>
            <button
              onClick={() => handlePreset('gain2')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activePreset === 'gain2' ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Ganho Real +2,5%
            </button>
          </div>
        </div>

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
                  {targetRealGain >= 0 ? '+' : ''}
                  {targetRealGain.toFixed(2).replace('.', ',')}% real
                </span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="5.0"
                step="0.25"
                value={targetRealGain}
                onChange={(e) => {
                  setTargetRealGain(parseFloat(e.target.value));
                  setActivePreset(parseFloat(e.target.value) === 0 ? 'breakeven' : parseFloat(e.target.value) === 1 ? 'gain1' : 'gain2');
                }}
                className="w-full h-2 bg-[#eff4ff] rounded-lg appearance-none cursor-pointer accent-[#000000]"
              />
              <div className="flex justify-between text-[#76777d] font-mono text-[10px]">
                <span>-2,0% (Defasagem)</span>
                <span>0,0% (Empate exato)</span>
                <span>+5,0% (Expansão real)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">Salário Base Considerado</span>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[#76777d] font-mono text-xs font-semibold">R$</span>
                  <input
                    type="number"
                    step="100"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#eff4ff] text-[#0b1c30] font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">Taxa IPCA-Casa Aplicada</span>
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
                {targetRealGain === 0 ? 'Equilíbrio Neutro' : targetRealGain > 0 ? `Ganho Real (+${targetRealGain.toFixed(1)}%)` : 'Defasagem'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs uppercase text-[#bec6e0] font-mono">Renda Bruta Ajustada</span>
              <div className="text-3xl font-bold font-mono text-[#ffffff] tracking-tight mt-1">
                R$ {neededSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-[#bec6e0] mt-1 font-mono">
                {monthlyGap >= 0
                  ? `+R$ ${monthlyGap.toFixed(2).replace('.', ',')} acima do salário atual (R$ 10.500)`
                  : `-R$ ${Math.abs(monthlyGap).toFixed(2).replace('.', ',')} abaixo do salário atual`}
              </span>
            </div>

            <div className="pt-3 border-t border-[#ffffff]/15 flex flex-col gap-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#bec6e0]">Reajuste Total s/ Base:</span>
                <span className="font-bold text-[#ffffff]">+{totalPercentageNeeded.toFixed(2).replace('.', ',')}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#bec6e0]">Diferença Mensal:</span>
                <span className="font-bold text-[#86f2e4]">{monthlyGap >= 0 ? '+' : ''}R$ {monthlyGap.toFixed(2).replace('.', ',')} /mês</span>
              </div>
            </div>

            <button
              onClick={handleApplyToPlan}
              className="w-full h-10 mt-1 bg-[#ffffff] text-[#0b1c30] rounded-lg text-xs font-semibold hover:bg-[#eff4ff] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Aplicar ao Planejamento Familiar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
