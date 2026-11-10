import React, { useState } from 'react';
import { EconomicCalculationSummary } from '../types';
import { NavTab } from '../components/Sidebar';

interface OverviewViewProps {
  summary: EconomicCalculationSummary;
  onNavigateTab: (tab: NavTab) => void;
  onOpenNewItem: () => void;
  onOpenQuickPrice: () => void;
  isDemo: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  onNavigateTab,
  onOpenNewItem,
  onOpenQuickPrice,
  isDemo,
}) => {
  const [showDemoBanner, setShowDemoBanner] = useState(isDemo);

  const {
    totalMonthlySpend,
    ipcaCasa12M,
    ipcaIBGE12M,
    spreadPP,
    groupContributions,
    topVillains,
    calculatedItems,
    purchasingPower,
  } = summary;

  // Formatação de moeda BRL
  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [intPart, decPart] = formatCurrency(totalMonthlySpend).split(',');

  // Amostra de 5 produtos recentes
  const recentItems = calculatedItems.slice(0, 5);

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
                      Parâmetro: Família Modelo (4 integrantes, São Paulo - SP)
                    </span>
                  </div>
                  <p className="text-xs text-[#45464d] mt-0.5">
                    Todos os índices, pesos ponderados e histórico de preços representam uma simulação com base na POF/IBGE customizada.
                  </p>
                </div>
              </div>
              <button
                className="self-end sm:self-center p-1 rounded-lg text-[#45464d] hover:bg-[#d3e4fe] hover:text-[#0b1c30] transition-colors"
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
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-[#45464d] font-medium">
                Relatório Executivo
              </span>
              <span className="w-1 h-1 rounded-full bg-[#c6c6cd]" />
              <span className="font-mono text-xs text-[#006a61] font-semibold">
                Ciclo Atualizado: Março/2024
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
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2 text-[#86f2e4] font-mono text-xs uppercase tracking-wider font-bold">
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              <span>O Verdadeiro Impacto da Inflação no seu Bolso</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              A alta de preços consome{' '}
              <span className="text-[#ffb4ab]">
                -R$ {((totalMonthlySpend * ipcaCasa12M) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{' '}
              do seu orçamento todo mês.
            </h2>
            <p className="text-xs text-[#bec6e0] leading-relaxed">
              Em 12 meses, sob a hipótese de manutenção do mesmo gasto mensal ({`R$ ${totalMonthlySpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}), a perda real acumulada chega a{' '}
              <strong className="text-[#ffffff]">
                -R$ {(((totalMonthlySpend * ipcaCasa12M) / 100) * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
              . Descubra como neutralizar essa perda e recompor o poder de compra da sua família.
            </p>
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
                R$ {intPart}<span className="text-[#45464d] font-normal text-lg">,{decPart}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#ffdad6]/40 text-[#ba1a1a] px-2 py-0.5 rounded-md w-fit font-mono text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" />
              <span>+6,20% a/a</span>
            </div>
          </div>

          {/* KPI 2: IPCA-Casa (Inflação Pessoal) */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">IPCA-Casa (12M)</span>
              <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">local_fire_department</span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Inflação da Família</span>
              <div className="text-2xl font-bold text-[#ba1a1a] tracking-tight tabular-nums font-mono">
                +{ipcaCasa12M.toFixed(2).replace('.', ',')}%
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#45464d] text-xs">
              <span className="material-symbols-outlined text-[14px]">history</span>
              <span>Acumulado 12 meses</span>
            </div>
          </div>

          {/* KPI 3: IPCA Oficial IBGE */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">IPCA Oficial</span>
              <span className="material-symbols-outlined text-[18px] text-[#497cff]">account_balance</span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">IBGE Nacional</span>
              <div className="text-2xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                +{ipcaIBGE12M.toFixed(2).replace('.', ',')}%
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#497cff] font-mono text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#497cff]" />
              <span>Mar/23 — Mar/24</span>
            </div>
          </div>

          {/* KPI 4: Diferencial (Spread) */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">Diferencial</span>
              <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">difference</span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Sobre a Média Oficial</span>
              <div className="text-2xl font-bold text-[#ba1a1a] tracking-tight tabular-nums font-mono">
                +{spreadPP.toFixed(2).replace('.', ',')} <span className="text-xs font-normal">p.p.</span>
              </div>
            </div>
            <div className="bg-[#ffdad6]/40 text-[#93000a] px-2 py-0.5 rounded text-left text-[11px] font-medium">
              Cesta acima do país
            </div>
          </div>

          {/* KPI 5: Variação Renda Nominal */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">Renda Nominal</span>
              <span className="material-symbols-outlined text-[18px] text-[#006a61]">trending_up</span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Ajuste de Salário</span>
              <div className="text-2xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                {purchasingPower.nominalIncomeGrowthPercent !== null
                  ? `${purchasingPower.nominalIncomeGrowthPercent >= 0 ? '+' : ''}${purchasingPower.nominalIncomeGrowthPercent.toFixed(2).replace('.', ',')}%`
                  : 'N/A'}
              </div>
            </div>
            <div className="text-[#45464d] font-mono text-[11px] tabular-nums">
              {purchasingPower.initialIncome ? `R$ ${purchasingPower.initialIncome.toLocaleString('pt-BR')} → R$ ${purchasingPower.finalIncome?.toLocaleString('pt-BR')}` : 'Sem dados salariais'}
            </div>
          </div>

          {/* KPI 6: Poder de Compra Real */}
          <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between text-[#45464d]">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">Poder de Compra</span>
              <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">shopping_cart_checkout</span>
            </div>
            <div className="my-2">
              <span className="text-[11px] text-[#45464d] font-medium">Efeito Real Pós-Inflação</span>
              <div className="text-2xl font-bold text-[#ba1a1a] tracking-tight tabular-nums font-mono">
                {purchasingPower.realPurchasingPowerChangePercent !== null
                  ? `${purchasingPower.realPurchasingPowerChangePercent >= 0 ? '+' : ''}${purchasingPower.realPurchasingPowerChangePercent.toFixed(2).replace('.', ',')}%`
                  : 'N/A'}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#45464d] font-mono text-[11px]">
              <span className="material-symbols-outlined text-[14px] text-[#ba1a1a]">arrow_downward</span>
              <span>Perda de compra real</span>
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
                    Mensal
                  </span>
                </div>
                <p className="text-xs text-[#45464d] mt-0.5">
                  Comparação do índice pessoal ponderado contra o referencial nacional IBGE
                </p>
              </div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-[#000000]" />
                  <span className="text-[#0b1c30] font-semibold">
                    IPCA-Casa (+{ipcaCasa12M.toFixed(2).replace('.', ',')}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-[#497cff]" />
                  <span className="text-[#45464d]">
                    IPCA IBGE (+{ipcaIBGE12M.toFixed(2).replace('.', ',')}%)
                  </span>
                </div>
              </div>
            </div>

            {/* SVG Gráfico de Linhas Interativo */}
            <div className="relative w-full h-64 mt-4">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 760 260">
                <defs>
                  <linearGradient id="ipcaCasaGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#000000" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Linhas de Grade */}
                <line stroke="#eff4ff" strokeWidth="1" x1="40" x2="740" y1="20" y2="20" />
                <text className="font-mono text-[10px] fill-[#76777d]" textAnchor="end" x="30" y="24">8%</text>
                <line stroke="#eff4ff" strokeWidth="1" x1="40" x2="740" y1="75" y2="75" />
                <text className="font-mono text-[10px] fill-[#76777d]" textAnchor="end" x="30" y="79">6%</text>
                <line stroke="#eff4ff" strokeWidth="1" x1="40" x2="740" y1="130" y2="130" />
                <text className="font-mono text-[10px] fill-[#76777d]" textAnchor="end" x="30" y="134">4%</text>
                <line stroke="#eff4ff" strokeWidth="1" x1="40" x2="740" y1="185" y2="185" />
                <text className="font-mono text-[10px] fill-[#76777d]" textAnchor="end" x="30" y="189">2%</text>
                <line stroke="#c6c6cd" strokeWidth="1" x1="40" x2="740" y1="230" y2="230" />
                <text className="font-mono text-[10px] fill-[#76777d]" textAnchor="end" x="30" y="234">0%</text>

                {/* Área Preenchida IPCA-Casa */}
                <polygon
                  fill="url(#ipcaCasaGrad)"
                  points="60,140 120,135 180,128 240,118 300,112 360,100 420,90 480,82 540,70 600,60 660,54 720,45 720,230 60,230"
                />
                {/* Linha IBGE (Azul Tracejado) */}
                <polyline
                  fill="none"
                  stroke="#497cff"
                  strokeDasharray="4 4"
                  strokeWidth="2.5"
                  points="60,165 120,162 180,158 240,152 300,148 360,145 420,140 480,135 540,130 600,125 660,120 720,115"
                />
                {/* Linha IPCA-Casa (Preto Sólido) */}
                <polyline
                  fill="none"
                  stroke="#000000"
                  strokeWidth="3"
                  points="60,140 120,135 180,128 240,118 300,112 360,100 420,90 480,82 540,70 600,60 660,54 720,45"
                />
                {/* Pontos Finais */}
                <circle cx="720" cy="45" fill="#000000" r="5" />
                <circle cx="720" cy="45" fill="#000000" fillOpacity="0.2" r="9" />
                <circle cx="720" cy="115" fill="#497cff" r="4" />

                {/* Rótulos dos Meses */}
                <text className="font-mono text-[11px] fill-[#76777d]" textAnchor="middle" x="60" y="250">Abr/23</text>
                <text className="font-mono text-[11px] fill-[#76777d]" textAnchor="middle" x="180" y="250">Jun/23</text>
                <text className="font-mono text-[11px] fill-[#76777d]" textAnchor="middle" x="300" y="250">Ago/23</text>
                <text className="font-mono text-[11px] fill-[#76777d]" textAnchor="middle" x="420" y="250">Out/23</text>
                <text className="font-mono text-[11px] fill-[#76777d]" textAnchor="middle" x="540" y="250">Dez/23</text>
                <text className="font-mono text-[11px] fill-[#76777d]" textAnchor="middle" x="660" y="250">Fev/24</text>
                <text className="font-mono text-[11px] fill-[#0b1c30] font-semibold" textAnchor="middle" x="720" y="250">Mar/24</text>
              </svg>
            </div>

            <div className="pt-4 flex items-center justify-between font-mono text-xs text-[#45464d] border-t border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
                <span>Afastamento crítico a partir de Out/2023 por alimentos e moradia.</span>
              </div>
              <span className="font-semibold text-[#0b1c30]">Base: POF 2017-2018 calibrada</span>
            </div>
          </div>

          {/* Gráfico 3: Distribuição do Orçamento (4 colunas) */}
          <div className="lg:col-span-4 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0b1c30]">Cesta de Consumo</h2>
                <span className="material-symbols-outlined text-[#76777d] text-[18px]">pie_chart</span>
              </div>
              <p className="text-xs text-[#45464d] mt-0.5">Ponderação orçamentária por grupo</p>
            </div>

            {/* Donut SVG Centralizado */}
            <div className="relative flex items-center justify-center my-4">
              <svg className="w-44 h-44" viewBox="0 0 200 200">
                <circle cx="100" cy="100" fill="transparent" r="70" stroke="#000000" strokeDasharray="149.5 290.3" strokeDashoffset="0" strokeWidth="24" />
                <circle cx="100" cy="100" fill="transparent" r="70" stroke="#497cff" strokeDasharray="114.3 325.5" strokeDashoffset="-149.5" strokeWidth="24" />
                <circle cx="100" cy="100" fill="transparent" r="70" stroke="#006a61" strokeDasharray="70.3 369.5" strokeDashoffset="-263.8" strokeWidth="24" />
                <circle cx="100" cy="100" fill="transparent" r="70" stroke="#86f2e4" strokeDasharray="52.7 387.1" strokeDashoffset="-334.1" strokeWidth="24" />
                <circle cx="100" cy="100" fill="transparent" r="70" stroke="#bec6e0" strokeDasharray="35.1 404.7" strokeDashoffset="-386.8" strokeWidth="24" />
                <circle cx="100" cy="100" fill="transparent" r="70" stroke="#d3e4fe" strokeDasharray="17.5 422.3" strokeDashoffset="-421.9" strokeWidth="24" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-mono text-[10px] text-[#76777d] uppercase tracking-wider">Maior Peso</span>
                <span className="text-2xl font-bold text-[#0b1c30]">
                  {groupContributions[0] ? `${groupContributions[0].weightPercent.toFixed(0)}%` : '34%'}
                </span>
                <span className="text-xs font-medium text-[#0b1c30] truncate max-w-[100px]">
                  {groupContributions[0]?.group || 'Alimentação'}
                </span>
              </div>
            </div>

            {/* Legenda de Grupos */}
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
          </div>
        </div>

        {/* 3. Gastos Trimestrais & Vilões do Orçamento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Evolução Trimestral do Gasto (5 colunas) */}
          <div className="lg:col-span-5 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0b1c30]">Gasto Mensal Médio</h2>
                <span className="font-mono text-xs text-[#76777d]">Por Trimestre (R$)</span>
              </div>
              <p className="text-xs text-[#45464d] mt-0.5">Pressão do orçamento em base trimestral</p>
            </div>

            <div className="grid grid-cols-4 items-end gap-3 h-48 my-4 px-2">
              <div className="flex flex-col items-center gap-2 h-full justify-end group">
                <span className="font-mono text-xs text-[#76777d] font-medium">7.950</span>
                <div className="w-full bg-[#dce9ff] rounded-t-lg transition-all duration-300" style={{ height: '72%' }} />
                <span className="font-mono text-xs text-[#76777d]">2T/23</span>
              </div>
              <div className="flex flex-col items-center gap-2 h-full justify-end group">
                <span className="font-mono text-xs text-[#76777d] font-medium">8.120</span>
                <div className="w-full bg-[#dce9ff] rounded-t-lg transition-all duration-300" style={{ height: '78%' }} />
                <span className="font-mono text-xs text-[#76777d]">3T/23</span>
              </div>
              <div className="flex flex-col items-center gap-2 h-full justify-end group">
                <span className="font-mono text-xs text-[#76777d] font-medium">8.290</span>
                <div className="w-full bg-[#dce9ff] rounded-t-lg transition-all duration-300" style={{ height: '85%' }} />
                <span className="font-mono text-xs text-[#76777d]">4T/23</span>
              </div>
              <div className="flex flex-col items-center gap-2 h-full justify-end group">
                <span className="font-mono text-xs text-[#0b1c30] font-bold">8.450</span>
                <div className="w-full bg-[#000000] rounded-t-lg transition-all duration-300 shadow-sm" style={{ height: '94%' }} />
                <span className="font-mono text-xs text-[#0b1c30] font-bold">1T/24</span>
              </div>
            </div>

            <div className="p-3 bg-[#eff4ff] rounded-lg flex items-center justify-between text-xs font-mono">
              <span className="text-[#45464d]">Aceleração trimestral acumulada:</span>
              <span className="font-bold text-[#ba1a1a]">+R$ 500,00/mês</span>
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
                Contribuição em pontos percentuais (p.p.) na taxa total acumulada (+{ipcaCasa12M.toFixed(2).replace('.', ',')}%)
              </p>
            </div>

            <div className="flex flex-col gap-3 my-3">
              {topVillains.slice(0, 4).map((item) => {
                const widthPercent = Math.min(100, Math.max(15, (item.weightedContribution / (ipcaCasa12M || 1)) * 100 * 2.5));
                return (
                  <div key={item.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0b1c30] flex items-center gap-1.5 truncate max-w-[320px]">
                        <span className="material-symbols-outlined text-[16px] text-[#ba1a1a]">warning</span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="font-mono font-bold text-[#0b1c30]">
                        +{item.weightedContribution.toFixed(2).replace('.', ',')} p.p.{' '}
                        <span className="text-[#76777d] font-normal">
                          ({(item.priceChangePercent ?? 0) >= 0 ? '+' : ''}{(item.priceChangePercent ?? 0).toFixed(1).replace('.', ',')}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-[#eff4ff] h-2 rounded-full overflow-hidden">
                      <div className="bg-[#000000] h-full rounded-full transition-all duration-500" style={{ width: `${widthPercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs font-mono text-[#45464d] flex items-center justify-between pt-2 border-t border-[#eff4ff]">
              <span>Estes 4 itens respondem por mais de 60% da inflação sentida</span>
              <button
                onClick={() => onNavigateTab('analise-da-inflacao')}
                className="text-[#0b1c30] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
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
                <p className="text-xs text-[#45464d]">Movimentação aferida nas últimas notas fiscais sincronizadas</p>
              </div>
              <span className="font-mono text-xs text-[#76777d]">
                Mostrando {recentItems.length} de {calculatedItems.length} itens monitorados
              </span>
            </div>

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
                            (item.priceChangePercent ?? 0) < 0 ? 'bg-[#006a61]' : item.weightedContribution >= 0.8 ? 'bg-[#ba1a1a]' : 'bg-[#76777d]'
                          }`}
                        />
                        <span className="truncate max-w-[220px]">{item.name}</span>
                      </td>
                      <td className="py-3 px-3 text-[#45464d]">{item.group.split(' ')[0]}</td>
                      <td className="py-3 px-3 text-right font-mono text-[#76777d]">
                        R$ {item.oldPrice.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        R$ {item.currentPrice.toFixed(2).replace('.', ',')}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono font-bold ${
                          (item.priceChangePercent ?? 0) > 0 ? 'text-[#ba1a1a]' : (item.priceChangePercent ?? 0) < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                        }`}
                      >
                        {(item.priceChangePercent ?? 0) >= 0 ? '+' : ''}
                        {(item.priceChangePercent ?? 0).toFixed(1).replace('.', ',')}%
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

            <div className="mt-4 pt-3 flex items-center justify-between border-t border-[#eff4ff] text-xs">
              <span className="font-mono text-[#76777d]">Última leitura de cupom fiscal: Ontem, às 19:42</span>
              <button
                onClick={() => onNavigateTab('minha-cesta-familiar')}
                className="font-semibold text-[#0b1c30] hover:text-[#497cff] flex items-center gap-1 cursor-pointer"
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
                <h2 className="text-base font-semibold text-[#0b1c30]">Alertas Inteligentes</h2>
                <span className="material-symbols-outlined text-[#76777d] text-[20px]">notifications_active</span>
              </div>

              <div className="flex flex-col gap-2.5 mt-3 text-xs">
                {/* Alerta 1 */}
                <div className="p-3 rounded-lg bg-[#eff4ff] flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-[#ba1a1a] shrink-0 mt-0.5">warning</span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#0b1c30]">Bandeira Tarifária Amarela</span>
                    <p className="text-[#45464d] mt-0.5">
                      A conta de luz terá acréscimo de R$ 1,88 a cada 100 kWh consumidos no próximo ciclo.
                    </p>
                    <span className="font-mono text-[#76777d] mt-1">Impacto estimado: +R$ 28,00</span>
                  </div>
                </div>

                {/* Alerta 2 */}
                <div className="p-3 rounded-lg bg-[#eff4ff] flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-[#ba1a1a] shrink-0 mt-0.5">trending_up</span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#0b1c30]">Azeite em Máxima Histórica</span>
                    <p className="text-[#45464d] mt-0.5">
                      O produto superou R$ 44,00 no supermercado habitual. Avalie substitutos para cocção.
                    </p>
                    <span className="font-mono text-[#006a61] font-semibold mt-1">Economia potencial: R$ 38,00/mês</span>
                  </div>
                </div>

                {/* Alerta 3 */}
                <div className="p-3 rounded-lg bg-[#eff4ff] flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-[#006a61] shrink-0 mt-0.5">check_circle</span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#0b1c30]">Paridade Etanol Favorável</span>
                    <p className="text-[#45464d] mt-0.5">
                      Preço do etanol a 68% da gasolina nos postos da sua rota diária em SP.
                    </p>
                    <span className="font-mono text-[#006a61] font-medium mt-1">Recomendação: abastecer com Etanol</span>
                  </div>
                </div>
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
                    ? `Déficit Real de R$ ${Math.abs(purchasingPower.monthlyPurchasingDeficitOrGain).toFixed(2).replace('.', ',')}`
                    : 'Poder de Compra sob Análise'}
                </h3>
                <p className="text-xs text-[#bec6e0] mt-1 leading-relaxed">
                  Para recompor o poder de compra mantendo a mesma cesta, o orçamento familiar requer um ajuste salarial ou substituição tática de itens.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('estrategias-de-economia')}
                className="w-full h-9 rounded-lg bg-[#ffffff] text-[#0b1c30] text-xs font-semibold hover:bg-[#eff4ff] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                type="button"
              >
                <span>Simular Substituições de Itens</span>
                <span className="material-symbols-outlined text-[16px]">tune</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
