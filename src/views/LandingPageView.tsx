import React, { useState } from 'react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { LANDING_FAQS } from '../config/seo';
import { trackCalculateImpact } from '../services/analytics';

interface LandingPageViewProps {
  onOpenRegister: () => void;
  onGoogleLogin: () => void;
  googleLoading?: boolean;
  onEnterDemo: () => void;
  onNavigate: (path: string) => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenRegister,
  onGoogleLogin,
  googleLoading = false,
  onEnterDemo,
  onNavigate,
}) => {
  // Mini simulador interativo na hero
  const [simSpend, setSimSpend] = useState<number>(4500);
  const [simInflation, setSimInflation] = useState<number>(5.8);

  const monthlyLoss = (simSpend * simInflation) / 100;
  const annualLoss = monthlyLoss * 12;

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 lg:px-16 py-12 max-w-[1340px] mx-auto w-full gap-16">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
        {/* Left Column: Headlines & Call to Actions */}
        <div className="lg:col-span-7 flex flex-col gap-6 text-left">
          <div className="inline-flex items-center gap-2 self-start text-[#006a61] font-mono text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#006a61]" aria-hidden="true" />
            <span>O Verdadeiro Impacto da Inflação no seu Bolso</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0b1c30] tracking-tight leading-[1.1]">
            Descubra quanto a inflação drena do seu salário em{' '}
            <span className="underline decoration-[#497cff] decoration-4 underline-offset-8">
              Reais (R$)
            </span>
            , não só em percentuais.
          </h1>

          <p className="text-base text-[#45464d] leading-relaxed max-w-xl">
            O IPCA oficial calcula uma média nacional abstrata. O <strong>IPCA-Casa</strong> calcula o impacto exato nos seus gastos cotidianos, na sua cesta de compras e no seu poder de compra salarial real.
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-2">
            <GoogleSignInButton
              onClick={onGoogleLogin}
              loading={googleLoading}
              label="Entrar com Google"
              className="h-12 px-6 text-sm shadow-sm"
            />

            <button
              type="button"
              onClick={onOpenRegister}
              className="h-12 px-7 rounded-xl bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-sm font-mono font-semibold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Criar Minha Conta</span>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                arrow_forward
              </span>
            </button>

            <button
              type="button"
              onClick={onEnterDemo}
              className="h-12 px-6 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-[#e5eeff]"
            >
              <span className="material-symbols-outlined text-[18px] text-[#006a61]" aria-hidden="true">
                play_circle
              </span>
              <span>Explorar Modo Demonstração</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#76777d] font-mono pt-4 border-t border-[#eff4ff]">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#006a61]" aria-hidden="true">
                check_circle
              </span>
              Sem CPF ou dados bancários
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#006a61]" aria-hidden="true">
                check_circle
              </span>
              Integração oficial IBGE / SIDRA
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#006a61]" aria-hidden="true">
                check_circle
              </span>
              Isolamento total dos dados
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Live Mini-Simulator */}
        <div className="lg:col-span-5 bg-[#ffffff] rounded-3xl p-7 shadow-xl border border-[#eff4ff] flex flex-col gap-6 relative">
          <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
            <div>
              <span className="text-xs font-mono font-bold text-[#006a61] uppercase tracking-wider block">
                Simulação Rápida em Tempo Real
              </span>
              <h2 className="text-lg font-bold text-[#0b1c30] mt-0.5">
                Teste seu Impacto em Reais
              </h2>
            </div>
            <span className="material-symbols-outlined text-[#497cff] text-[24px]" aria-hidden="true">
              payments
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="hero-sim-spend" className="font-semibold text-[#0b1c30]">
                  Seus Gastos Mensais:
                </label>
                <span className="font-mono font-bold text-sm text-[#0b1c30]">
                  R$ {simSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <input
                id="hero-sim-spend"
                type="range"
                min="1500"
                max="20000"
                step="250"
                value={simSpend}
                onChange={(e) => {
                  setSimSpend(parseFloat(e.target.value));
                  trackCalculateImpact('hero-simulator', 'hero-simulator');
                }}
                className="accent-[#000000] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#76777d]">
                <span>R$ 1.500</span>
                <span>R$ 10.000</span>
                <span>R$ 20.000</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="hero-sim-inflation" className="font-semibold text-[#0b1c30]">
                  Taxa de Inflação Simulada:
                </label>
                <span className="font-mono font-bold text-sm text-[#ba1a1a]">
                  +{simInflation.toFixed(1)}%
                </span>
              </div>
              <input
                id="hero-sim-inflation"
                type="range"
                min="2"
                max="15"
                step="0.2"
                value={simInflation}
                onChange={(e) => {
                  setSimInflation(parseFloat(e.target.value));
                  trackCalculateImpact('hero-simulator', 'hero-simulator');
                }}
                className="accent-[#ba1a1a] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#76777d]">
                <span>2.0%</span>
                <span>Cenário de teste</span>
                <span>15.0%</span>
              </div>
            </div>
          </div>

          {/* Calculated Result Card */}
          <div className="p-4 bg-[#eff4ff] rounded-2xl flex flex-col gap-3 border border-[#e5eeff]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#45464d] font-medium">Impacto Mensal no Bolso:</span>
              <span className="text-2xl font-bold font-mono text-[#ba1a1a]">
                -R$ {monthlyLoss.toFixed(2).replace('.', ',')}
                <span className="text-xs font-normal text-[#76777d]">/mês</span>
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#e5eeff] text-xs">
              <span className="text-[#45464d] font-medium">Corrosão em 12 Meses:</span>
              <span className="font-bold font-mono text-[#0b1c30]">
                -R$ {annualLoss.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenRegister}
            className="w-full h-11 rounded-xl bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Calcular com Meus Dados Reais</span>
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </div>
      </section>

      {/* 3 Pillars Section */}
      <section aria-labelledby="pilares-titulo" className="w-full flex flex-col gap-6 pt-8 border-t border-[#eff4ff]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 id="pilares-titulo" className="text-2xl font-bold text-[#0b1c30]">
              Por que acompanhar a inflação pessoal da sua casa?
            </h2>
            <p className="text-sm text-[#45464d] mt-1">
              Três frentes para enxergar o efeito real dos preços no orçamento familiar.
            </p>
          </div>
          <a
            href="/como-funciona"
            onClick={(e) => handleLinkClick(e, '/como-funciona')}
            className="text-xs font-mono font-semibold text-[#006a61] underline underline-offset-4 hover:text-[#0b1c30]"
          >
            Ver guia completo de uso →
          </a>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] flex flex-col gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#ffdad6]/40 text-[#ba1a1a] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                payments
              </span>
            </div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              1. Impacto no seu Bolso (R$)
            </h3>
            <p className="text-xs text-[#45464d] leading-relaxed">
              Descubra quanto dinheiro a inflação realmente consome por mês e quanto seu salário precisa aumentar para recuperar o equilíbrio financeiro.
            </p>
          </article>

          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] flex flex-col gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#006a61] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                shopping_basket
              </span>
            </div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              2. Sua Cesta Pessoal Ponderada
            </h3>
            <p className="text-xs text-[#45464d] leading-relaxed">
              Cálculo baseado na fórmula matemática de Laspeyres. Cada item tem o peso exato do seu hábito de consumo e não de uma média estatística.
            </p>
          </article>

          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] flex flex-col gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#497cff] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                public
              </span>
            </div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              3. Dados Oficiais do IBGE
            </h3>
            <p className="text-xs text-[#45464d] leading-relaxed">
              Conexão direta com a API pública do SIDRA (Tabelas 1737 e 7060) para comparar a inflação da sua casa com os índices oficiais nacionais e regionais.
            </p>
          </article>
        </div>
      </section>

      {/* Comparative Visual + Internal Educational Cross-links */}
      <section
        aria-labelledby="comparativo-ibge-titulo"
        className="w-full bg-[#ffffff] rounded-3xl p-6 lg:p-8 border border-[#eff4ff] shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        <div className="lg:col-span-6 flex flex-col gap-4">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#497cff]">
            Transparência Metodológica
          </span>
          <h2 id="comparativo-ibge-titulo" className="text-2xl font-bold text-[#0b1c30]">
            IPCA Oficial do IBGE vs. Inflação Percebida pela Família
          </h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            A média divulgada mensalmente pelo IBGE considera pesos fixos nacionais da Pesquisa de Orçamentos Familiares (POF). Já o IPCA-Casa pondera exatamente os itens que pesam na sua casa e mostra o reflexo direto no seu poder de compra.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="/ipca-oficial"
              onClick={(e) => handleLinkClick(e, '/ipca-oficial')}
              className="px-4 py-2.5 rounded-xl bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-colors"
            >
              Ver IPCA Oficial do IBGE
            </a>
            <a
              href="/metodologia"
              onClick={(e) => handleLinkClick(e, '/metodologia')}
              className="px-4 py-2.5 rounded-xl bg-[#eff4ff] text-[#0b1c30] hover:bg-[#e5eeff] text-xs font-semibold transition-colors"
            >
              Conhecer Fórmulas (Laspeyres)
            </a>
            <a
              href="/privacidade"
              onClick={(e) => handleLinkClick(e, '/privacidade')}
              className="px-4 py-2.5 rounded-xl bg-[#f8f9ff] text-[#45464d] hover:bg-[#eff4ff] text-xs font-semibold transition-colors"
            >
              Privacidade & Isolamento
            </a>
          </div>
        </div>

        <div className="lg:col-span-6">
          <picture>
            <img
              src="/assets/aistudio/image_7ff3e2de.png"
              alt="Metodologia comparativa: Por que a inflação da sua casa difere da média nacional — IPCA Oficial (IBGE) vs. IPCA da Família e impacto real no poder de compra"
              width={1024}
              height={559}
              loading="lazy"
              decoding="async"
              className="w-full h-auto rounded-2xl border border-[#eff4ff]"
            />
          </picture>
        </div>
      </section>

      {/* Public FAQ matching Schema.org FAQPage */}
      <section aria-labelledby="faq-titulo" className="w-full flex flex-col gap-6 pt-4">
        <div>
          <h2 id="faq-titulo" className="text-2xl font-bold text-[#0b1c30]">
            Perguntas Frequentes sobre Inflação Pessoal e IPCA-Casa
          </h2>
          <p className="text-sm text-[#45464d] mt-1">
            Esclarecimentos diretos sobre fontes oficiais do IBGE, cálculos e proteção de dados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LANDING_FAQS.map((faq) => (
            <article
              key={faq.question}
              className="bg-[#ffffff] p-5 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-2"
            >
              <h3 className="text-sm font-bold text-[#0b1c30]">{faq.question}</h3>
              <p className="text-xs text-[#45464d] leading-relaxed">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

