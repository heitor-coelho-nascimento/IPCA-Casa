import React, { useState } from 'react';
import { EconomicCalculationSummary } from '../types';
import { NavTab } from '../components/Sidebar';

interface InflationAnalysisViewProps {
  summary: EconomicCalculationSummary;
  onNavigateTab: (tab: NavTab) => void;
  isDemo: boolean;
}

export const InflationAnalysisView: React.FC<InflationAnalysisViewProps> = ({
  summary,
  onNavigateTab,
  isDemo,
}) => {
  const [showFormula, setShowFormula] = useState(true);
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [filterText, setFilterText] = useState('');
  const [activeTimeframe, setActiveTimeframe] = useState<'12M' | 'YTD' | '1M'>('12M');

  const {
    ipcaCasa12M,
    ipcaIBGE12M,
    spreadPP,
    groupContributions,
    calculatedItems,
    topIncreases,
    topVillains,
  } = summary;

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

  const totalDisplayedContribution = filteredItems.reduce((acc, it) => acc + it.weightedContribution, 0);

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
          <span className="text-[#45464d]">SIDRA/IBGE Oficial: Março 2024</span>
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
                Decomposição Econométrica
              </span>
              <span className="text-[#76777d]">•</span>
              <span className="font-mono text-xs text-[#45464d]">{isDemo ? 'Cesta de Demonstração (Valores Fictícios)' : 'Orçamento Familiar'}</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-[#0b1c30] tracking-tight">
              Análise da Inflação Real & Impacto Familiar
            </h1>
            <p className="text-xs text-[#45464d] max-w-2xl leading-relaxed">
              Compreenda o impacto desproporcional dos preços na sua cesta de consumo doméstica ponderada pela fórmula de Índice de Laspeyres face ao Índice Oficial Nacional.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="bg-[#eff4ff] rounded-lg p-1 flex items-center gap-1">
              <button
                onClick={() => setActiveTimeframe('12M')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                  activeTimeframe === '12M' ? 'bg-[#ffffff] text-[#0b1c30] font-bold shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                Acumulado 12M
              </button>
              <button
                onClick={() => setActiveTimeframe('YTD')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                  activeTimeframe === 'YTD' ? 'bg-[#ffffff] text-[#0b1c30] font-bold shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                Ano Atual (YTD)
              </button>
              <button
                onClick={() => setActiveTimeframe('1M')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                  activeTimeframe === '1M' ? 'bg-[#ffffff] text-[#0b1c30] font-bold shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                Mês Anterior
              </button>
            </div>

            <button
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
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ba1a1a]" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">IPCA-Casa Ponderado</span>
                <span className="text-xs text-[#76777d]">Sua inflação sentida</span>
              </div>
              <span className="material-symbols-outlined text-[#ba1a1a] text-[22px]">local_fire_department</span>
            </div>
            <div className="my-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[#ba1a1a] tracking-tight tabular-nums font-mono">
                +{ipcaCasa12M.toFixed(2).replace('.', ',')}%
              </span>
              <span className="text-xs font-mono text-[#76777d]">a.a.</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-[#eff4ff] px-3 py-1.5 rounded-lg font-mono">
              <span className="text-[#0b1c30]">Base: Mar/23 – Mar/24</span>
              <span className="text-[#ba1a1a] font-semibold">+0,32% no último mês</span>
            </div>
          </div>

          {/* Card 2: IPCA Oficial IBGE */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden border border-[#eff4ff]">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#497cff]" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">IPCA Oficial IBGE</span>
                <span className="text-xs text-[#76777d]">Média Nacional (POF)</span>
              </div>
              <span className="material-symbols-outlined text-[#497cff] text-[22px]">account_balance</span>
            </div>
            <div className="my-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                +{ipcaIBGE12M.toFixed(2).replace('.', ',')}%
              </span>
              <span className="text-xs font-mono text-[#76777d]">a.a.</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-[#eff4ff] px-3 py-1.5 rounded-lg font-mono">
              <span className="text-[#0b1c30]">Teto Meta BC: 4,50%</span>
              <span className="text-[#497cff] font-semibold">No Limite</span>
            </div>
          </div>

          {/* Card 3: Diferencial Pessoal */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden border border-[#eff4ff]">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ba1a1a]" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">Spread Inflacionário</span>
                <span className="text-xs text-[#76777d]">Diferença p.p. vs IBGE</span>
              </div>
              <span className="material-symbols-outlined text-[#ba1a1a] text-[22px]">trending_up</span>
            </div>
            <div className="my-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[#ba1a1a] tracking-tight tabular-nums font-mono">
                +{spreadPP.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-xs font-mono text-[#ba1a1a] font-semibold">p.p.</span>
            </div>
            <div className="bg-[#ffdad6]/40 px-3 py-1.5 rounded-lg flex items-center justify-between font-mono text-xs">
              <span className="text-[#ba1a1a] font-semibold">52% acima da média do país</span>
              <span className="material-symbols-outlined text-[#ba1a1a] text-[16px]">priority_high</span>
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
              <span className="text-xs font-mono text-[#76777d]">itens monitorados</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-[#eff4ff] px-3 py-1.5 rounded-lg font-mono">
              <span className="text-[#0b1c30]">9 Grupos de Despesa</span>
              <span className="text-[#006a61] font-semibold">98,2% da Renda</span>
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
                      IPCA<sub>Casa</sub> = ∑ (Peso<sub>i</sub> × ΔP<sub>i</sub>) = +{ipcaCasa12M.toFixed(2).replace('.', ',')}%
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
                      Ex: Aluguel = 18,2%
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
                      Ex: Carnes = +14,2%
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
                      Ex: 5,8% × 14,2% = +0,82 p.p.
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
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#ba1a1a]" />
                  <h2 className="text-lg font-semibold text-[#0b1c30]">Decomposição de Contribuição por Grupo</h2>
                </div>
                <p className="text-xs text-[#45464d] mt-0.5">
                  Quantos pontos percentuais (p.p.) cada setor injetou no IPCA-Casa (+{ipcaCasa12M.toFixed(2).replace('.', ',')}%)
                </p>
              </div>
              <span className="font-mono text-xs bg-[#eff4ff] text-[#0b1c30] px-2 py-1 rounded font-semibold">
                Total: +{ipcaCasa12M.toFixed(2).replace('.', ',')} p.p.
              </span>
            </div>

            <div className="flex flex-col gap-4 my-4">
              {groupContributions.map((gc) => {
                const shareOfTotalInflation = ipcaCasa12M > 0 ? (gc.weightedContribution / ipcaCasa12M) * 100 : 0;
                return (
                  <div key={gc.group} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[#45464d]">{gc.icon}</span>
                        <span className="font-semibold text-[#0b1c30]">{gc.group}</span>
                        <span className="font-mono text-[#76777d]">(Peso {gc.weightPercent.toFixed(1)}%)</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={`font-bold ${gc.weightedContribution < 0 ? 'text-[#006a61]' : 'text-[#ba1a1a]'}`}>
                          {gc.weightedContribution >= 0 ? '+' : ''}
                          {gc.weightedContribution.toFixed(2).replace('.', ',')} p.p.
                        </span>
                        <span className="text-[#76777d]">({shareOfTotalInflation.toFixed(1)}% do total)</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#eff4ff] overflow-hidden flex">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, Math.max(2, Math.abs(shareOfTotalInflation)))}%`,
                          backgroundColor: gc.weightedContribution < 0 ? '#006a61' : gc.color || '#ba1a1a',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-[#eff4ff] rounded-lg flex items-center justify-between text-xs font-mono border-t border-[#eff4ff]">
              <span className="text-[#45464d]">Alimentação + Habitação concentram:</span>
              <span className="font-bold text-[#ba1a1a] bg-[#ffffff] px-2.5 py-1 rounded shadow-sm">
                64,1% de Toda a Inflação da Casa
              </span>
            </div>
          </div>

          {/* Right: Scatter Plot Simulation (5 colunas) */}
          <div className="lg:col-span-5 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex flex-col pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0b1c30]">Variação vs. Peso no Orçamento</h2>
                <span className="material-symbols-outlined text-[#76777d] text-[20px]">bubble_chart</span>
              </div>
              <p className="text-xs text-[#45464d] mt-0.5">
                Identificação dos <em>Verdadeiros Vilões</em> (alto peso × alta variação) vs <em>Ruídos de Gôndola</em>.
              </p>
            </div>

            {/* Scatter Canvas Simulation */}
            <div className="relative w-full h-64 bg-[#eff4ff] rounded-xl p-3 flex flex-col justify-between overflow-hidden border border-[#e5eeff]">
              {/* Quadrant backgrounds */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-50 pointer-events-none">
                <div className="bg-[#ffffff] border-b border-r border-[#c6c6cd]/20" />
                <div className="bg-[#ffdad6]/30 border-b border-[#c6c6cd]/20 flex items-start justify-end p-2">
                  <span className="font-mono text-[9px] text-[#ba1a1a] font-bold uppercase">Quadrante Crítico</span>
                </div>
                <div className="bg-[#86f2e4]/20 border-r border-[#c6c6cd]/20 flex items-end p-2">
                  <span className="font-mono text-[9px] text-[#006a61] font-bold uppercase">Zona de Segurança</span>
                </div>
                <div className="bg-[#ffffff]" />
              </div>

              {/* Data points */}
              {/* Ponto 1: Aluguel */}
              <div className="absolute" style={{ left: '68%', bottom: '60%' }}>
                <div className="group relative cursor-pointer">
                  <div className="w-5 h-5 rounded-full bg-[#ba1a1a] flex items-center justify-center text-[#ffffff] shadow-md animate-pulse">
                    <span className="text-[9px] font-bold font-mono">1</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-[#131b2e] text-[#ffffff] p-2 rounded shadow-lg whitespace-nowrap z-20 text-[11px]">
                    <span className="font-bold">Aluguel Residencial</span>
                    <span>Peso: 18,2% | Alta: +9,2%</span>
                    <span className="text-[#ffdad6] font-semibold">+1,67 p.p. no índice</span>
                  </div>
                </div>
              </div>

              {/* Ponto 2: Azeite */}
              <div className="absolute" style={{ left: '15%', bottom: '85%' }}>
                <div className="group relative cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-[#565e74] text-[#ffffff] flex items-center justify-center shadow">
                    <span className="text-[8px] font-bold font-mono">2</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-[#131b2e] text-[#ffffff] p-2 rounded shadow-lg whitespace-nowrap z-20 text-[11px]">
                    <span className="font-bold">Azeite de Oliva</span>
                    <span>Peso: 0,8% | Alta: +48,5%</span>
                    <span className="text-[#bec6e0]">Impacto: +0,38 p.p. (Ruído alto)</span>
                  </div>
                </div>
              </div>

              {/* Ponto 3: Energia Elétrica */}
              <div className="absolute" style={{ left: '55%', bottom: '52%' }}>
                <div className="group relative cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-[#ba1a1a] flex items-center justify-center text-[#ffffff] shadow">
                    <span className="text-[8px] font-bold font-mono">3</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-[#131b2e] text-[#ffffff] p-2 rounded shadow-lg whitespace-nowrap z-20 text-[11px]">
                    <span className="font-bold">Energia Elétrica</span>
                    <span>Peso: 6,5% | Alta: +11,4%</span>
                    <span className="text-[#ffdad6] font-semibold">+0,74 p.p.</span>
                  </div>
                </div>
              </div>

              {/* Ponto 4: Plano de Saúde */}
              <div className="absolute" style={{ left: '60%', bottom: '45%' }}>
                <div className="group relative cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-[#497cff] text-[#ffffff] flex items-center justify-center shadow">
                    <span className="text-[8px] font-bold font-mono">4</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-[#131b2e] text-[#ffffff] p-2 rounded shadow-lg whitespace-nowrap z-20 text-[11px]">
                    <span className="font-bold">Plano de Saúde</span>
                    <span>Peso: 10,2% | Alta: +8,5%</span>
                    <span className="text-[#dae2fd] font-semibold">+0,86 p.p.</span>
                  </div>
                </div>
              </div>

              {/* Ponto 5: Carnes */}
              <div className="absolute" style={{ left: '45%', bottom: '65%' }}>
                <div className="group relative cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-[#ba1a1a] flex items-center justify-center text-[#ffffff] shadow">
                    <span className="text-[8px] font-bold font-mono">5</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-[#131b2e] text-[#ffffff] p-2 rounded shadow-lg whitespace-nowrap z-20 text-[11px]">
                    <span className="font-bold">Carnes Bovinas</span>
                    <span>Peso: 5,8% | Alta: +14,2%</span>
                    <span className="text-[#ffdad6] font-semibold">+0,82 p.p.</span>
                  </div>
                </div>
              </div>

              {/* Ponto 6: Leite UHT (Alívio) */}
              <div className="absolute" style={{ left: '25%', bottom: '15%' }}>
                <div className="group relative cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-[#006a61] text-[#ffffff] flex items-center justify-center shadow">
                    <span className="text-[8px] font-bold font-mono">6</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-[#131b2e] text-[#ffffff] p-2 rounded shadow-lg whitespace-nowrap z-20 text-[11px]">
                    <span className="font-bold">Leite UHT</span>
                    <span>Peso: 0,8% | Queda: -8,8%</span>
                    <span className="text-[#86f2e4]">Alívio: -0,07 p.p.</span>
                  </div>
                </div>
              </div>

              {/* Axes indicators */}
              <div className="flex justify-between text-[10px] font-mono text-[#76777d] z-10">
                <span>Δ Preço Nominal (%) →</span>
                <span>Alta Severidade</span>
              </div>
              <div className="flex justify-between items-end text-[10px] font-mono text-[#76777d] z-10">
                <span>↑ Peso no Bolso (%)</span>
                <span>Passe o mouse nos nós</span>
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
            <div className="flex items-center justify-between pb-2 border-b border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#45464d]">percent</span>
                <h3 className="text-base font-semibold text-[#0b1c30]">Top 5 Maiores Aumentos (%)</h3>
              </div>
              <span className="font-mono text-xs text-[#76777d]">Nominal Bruto</span>
            </div>
            <p className="text-xs text-[#45464d] my-2">
              Itens com a maior explosão de preço na prateleira, desconsiderando o seu orçamento.
            </p>

            <div className="flex flex-col gap-2">
              {topIncreases.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-xs text-[#76777d] w-4">#{idx + 1}</span>
                    <div>
                      <span className="text-xs font-semibold text-[#0b1c30] block">{item.name}</span>
                      <span className="font-mono text-[11px] text-[#76777d]">
                        {item.group} • Peso {item.weightPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-[#ba1a1a] block">
                      {(item.priceChangePercent ?? 0) >= 0 ? '+' : ''}
                      {(item.priceChangePercent ?? 0).toFixed(1).replace('.', ',')}%
                    </span>
                    <span className="font-mono text-[11px] text-[#76777d]">
                      R$ {item.oldPrice.toFixed(2)} → R$ {item.currentPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Maiores Vilões do Orçamento */}
          <div className="bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between pb-2 border-b border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#ba1a1a]">bomb</span>
                <h3 className="text-base font-semibold text-[#0b1c30]">Top 5 Vilões do Bolso (Ponderado)</h3>
              </div>
              <span className="font-mono text-xs text-[#ba1a1a] font-semibold">Impacto em p.p.</span>
            </div>
            <p className="text-xs text-[#45464d] my-2">
              Os 5 itens responsáveis pela maior fatia da inflação que a família enfrentou.
            </p>

            <div className="flex flex-col gap-2">
              {topVillains.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#ffdad6]/20 hover:bg-[#ffdad6]/35 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-xs text-[#ba1a1a] w-4">#{idx + 1}</span>
                    <div>
                      <span className="text-xs font-semibold text-[#0b1c30] block">{item.name}</span>
                      <span className="font-mono text-[11px] text-[#76777d]">
                        Peso: {item.weightPercent.toFixed(1)}% • Alta: +{(item.priceChangePercent ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-[#ba1a1a] block">
                      +{item.weightedContribution.toFixed(2).replace('.', ',')} p.p.
                    </span>
                    <span className="font-mono text-[11px] text-[#76777d]">
                      {((item.weightedContribution / (ipcaCasa12M || 1)) * 100).toFixed(1)}% do índice
                    </span>
                  </div>
                </div>
              ))}
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
                <option value="Alimentação e bebidas">Alimentação e bebidas</option>
                <option value="Habitação">Habitação</option>
                <option value="Transportes">Transportes</option>
                <option value="Saúde e cuidados pessoais">Saúde e cuidados pessoais</option>
                <option value="Educação">Educação</option>
                <option value="Comunicação">Comunicação</option>
                <option value="Vestuário">Vestuário</option>
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
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#eff4ff]/60 transition-colors">
                    <td className="py-3 px-4 font-semibold flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          (item.priceChangePercent ?? 0) < 0 ? 'bg-[#006a61]' : item.weightedContribution >= 0.8 ? 'bg-[#ba1a1a]' : 'bg-[#76777d]'
                        }`}
                      />
                      <span>{item.name}</span>
                    </td>
                    <td className="py-3 px-3 text-[#45464d] font-mono">{item.group.split(' ')[0]}</td>
                    <td className="py-3 px-3 text-right font-mono font-medium">{item.weightPercent.toFixed(2).replace('.', ',')}%</td>
                    <td className="py-3 px-3 text-right font-mono text-[#76777d]">R$ {item.oldPrice.toFixed(2).replace('.', ',')}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">R$ {item.currentPrice.toFixed(2).replace('.', ',')}</td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-bold ${
                        (item.priceChangePercent ?? 0) > 0 ? 'text-[#ba1a1a]' : (item.priceChangePercent ?? 0) < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                      }`}
                    >
                      {(item.priceChangePercent ?? 0) >= 0 ? '+' : ''}
                      {(item.priceChangePercent ?? 0).toFixed(2).replace('.', ',')}%
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        item.weightedContribution > 0 ? 'text-[#ba1a1a]' : item.weightedContribution < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                      }`}
                    >
                      {item.weightedContribution >= 0 ? '+' : ''}
                      {item.weightedContribution.toFixed(2).replace('.', ',')} p.p.
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
                        {item.impactLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-[#eff4ff] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#45464d] border-t border-[#e5eeff]">
            <span>
              Exibindo {filteredItems.length} de {calculatedItems.length} itens ponderados • Soma das contribuições filtradas:{' '}
              <strong className="text-[#0b1c30]">+{totalDisplayedContribution.toFixed(2).replace('.', ',')} p.p.</strong>
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
                Sua inflação é puxada principalmente por rigidez orçamentária em <strong>Moradia e Saúde</strong>. Substituir marcas de azeite tem impacto irrisório (&lt; 0,08 p.p.), enquanto a renegociação ou otimização de serviços de alto peso pode aliviar até 1,5 p.p. no ano.
              </p>
            </div>
          </div>
          <button
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
