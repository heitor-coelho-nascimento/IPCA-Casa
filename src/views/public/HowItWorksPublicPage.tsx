import React from 'react';

interface HowItWorksPublicPageProps {
  onNavigate: (path: string) => void;
  onOpenRegister: () => void;
  onEnterDemo: () => void;
}

export const HowItWorksPublicPage: React.FC<HowItWorksPublicPageProps> = ({
  onNavigate,
  onOpenRegister,
  onEnterDemo,
}) => {
  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <main className="max-w-[1200px] mx-auto w-full px-6 lg:px-12 py-12 flex flex-col gap-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#76777d]">
        <a href="/" onClick={(e) => handleLink(e, '/')} className="hover:text-[#0b1c30] underline">
          Início
        </a>
        <span>/</span>
        <span className="text-[#0b1c30] font-semibold">Como Funciona</span>
      </nav>

      <header className="flex flex-col gap-4 max-w-3xl">
        <span className="font-mono text-xs uppercase tracking-wider font-bold text-[#006a61]">
          Fluxo de Análise do Orçamento Doméstico
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0b1c30] tracking-tight leading-tight">
          Como funciona o IPCA-Casa para medir sua inflação pessoal
        </h1>
        <p className="text-base text-[#45464d] leading-relaxed">
          Em vez de usar uma cesta genérica igual para todo o país, o IPCA-Casa organiza os gastos reais da sua casa em 9 grupos compatíveis com o IBGE e calcula o impacto mensal e anual em Reais (R$) no seu salário.
        </p>
      </header>

      {/* 5 Etapas Claras */}
      <section aria-labelledby="etapas-titulo" className="flex flex-col gap-6">
        <h2 id="etapas-titulo" className="text-2xl font-bold text-[#0b1c30]">
          Passo a passo do cálculo familiar
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
            <span className="font-mono text-xs font-bold text-[#497cff]">01. CADASTRO DA CESTA</span>
            <h3 className="text-lg font-bold text-[#0b1c30]">Mapeie seus gastos mensais</h3>
            <p className="text-sm text-[#45464d] leading-relaxed">
              Informe os itens mais relevantes do seu orçamento — como aluguel, alimentação, energia, plano de saúde, transporte e mensalidades — classificando entre essenciais ou supérfluos.
            </p>
          </article>

          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
            <span className="font-mono text-xs font-bold text-[#497cff]">02. REGISTRO DE PREÇOS</span>
            <h3 className="text-lg font-bold text-[#0b1c30]">Compare períodos sem distorção</h3>
            <p className="text-sm text-[#45464d] leading-relaxed">
              Registre o preço antigo e o preço atual (ou cotações mensais sucessivas). Itens sem preço inicial válido são ignorados na variação para nunca distorcer sua taxa média como 0%.
            </p>
          </article>

          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
            <span className="font-mono text-xs font-bold text-[#006a61]">03. PONDERAÇÃO REAL</span>
            <h3 className="text-lg font-bold text-[#0b1c30]">Descubra seus vilões orçamentários</h3>
            <p className="text-sm text-[#45464d] leading-relaxed">
              Pelo Índice de Laspeyres, um item que pesa 20% do seu orçamento e sobe 10% gera muito mais dor no bolso do que um tempero que subiu 50% mas representa apenas 0,3% dos seus gastos.
            </p>
          </article>

          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
            <span className="font-mono text-xs font-bold text-[#ba1a1a]">04. IMPACTO NO BOLSO</span>
            <h3 className="text-lg font-bold text-[#0b1c30]">Traduza percentuais para Reais (R$)</h3>
            <p className="text-sm text-[#45464d] leading-relaxed">
              Veja quanto a alta de preços consome por mês e em 12 meses e descubra qual deveria ser o seu salário de equilíbrio para preservar exatamente o mesmo poder de compra.
            </p>
          </article>

          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
            <span className="font-mono text-xs font-bold text-[#497cff]">05. BENCHMARK IBGE</span>
            <h3 className="text-lg font-bold text-[#0b1c30]">Compare com o IPCA Oficial</h3>
            <p className="text-sm text-[#45464d] leading-relaxed">
              Avalie a distância (spread em pontos percentuais) entre a sua inflação doméstica e as séries oficiais do IBGE/SIDRA (Tabelas 1737 e 7060) nacionais e regionais.
            </p>
          </article>

          <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
            <span className="font-mono text-xs font-bold text-[#006a61]">06. PLANOS DE AÇÃO</span>
            <h3 className="text-lg font-bold text-[#0b1c30]">Simule substituições e economia</h3>
            <p className="text-sm text-[#45464d] leading-relaxed">
              Modele trocas inteligentes de marca (Plano A), redução de consumo de energia/água/combustível (Plano B) e retorno real da economia acumulada (Plano C).
            </p>
          </article>
        </div>
      </section>

      {/* Ilustração Comparativa */}
      <section
        aria-labelledby="comparativo-visual-titulo"
        className="bg-[#ffffff] p-6 lg:p-8 rounded-3xl border border-[#eff4ff] shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        <div className="lg:col-span-6 flex flex-col gap-4">
          <h2 id="comparativo-visual-titulo" className="text-2xl font-bold text-[#0b1c30]">
            Por que sua casa sente uma inflação diferente da TV?
          </h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            O IBGE divulga uma média calculada sobre o padrão de consumo das famílias urbanas entre 1 e 40 salários mínimos. Se sua família gasta proporcionalmente mais com mensalidade escolar, plano de saúde ou alimentação fresca, sua inflação efetiva pode superar ou ficar abaixo do índice oficial.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="/metodologia"
              onClick={(e) => handleLink(e, '/metodologia')}
              className="px-4 py-2 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-semibold transition-colors"
            >
              Ver Fórmulas da Metodologia →
            </a>
            <a
              href="/ipca-oficial"
              onClick={(e) => handleLink(e, '/ipca-oficial')}
              className="px-4 py-2 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#497cff] text-xs font-semibold transition-colors"
            >
              Consultar IPCA Oficial IBGE →
            </a>
          </div>
        </div>

        <div className="lg:col-span-6">
          <picture>
            <source srcSet="/images/ipca-comparativo-ilustracao.avif" type="image/avif" />
            <source srcSet="/images/ipca-comparativo-ilustracao.webp" type="image/webp" />
            <img
              src="/images/ipca-comparativo-ilustracao.png"
              alt="Diagrama comparando a média nacional do IPCA Oficial do IBGE com o cálculo ponderado da cesta familiar no IPCA-Casa"
              width={800}
              height={450}
              loading="lazy"
              decoding="async"
              className="w-full h-auto rounded-2xl border border-[#eff4ff]"
            />
          </picture>
        </div>
      </section>

      {/* CTAs */}
      <section className="bg-[#131b2e] text-[#ffffff] rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2 max-w-xl">
          <h2 className="text-2xl font-bold">Pronto para calcular o impacto no seu orçamento?</h2>
          <p className="text-sm text-[#dae2fd]">
            Experimente agora o modo demonstração com dados educativos ou crie sua conta gratuita com isolamento completo de dados.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            type="button"
            onClick={onEnterDemo}
            className="px-5 py-3 rounded-xl bg-[#213145] hover:bg-[#2c3f58] text-[#ffffff] text-xs font-semibold cursor-pointer transition-colors"
          >
            Testar Demonstração
          </button>
          <button
            type="button"
            onClick={onOpenRegister}
            className="px-5 py-3 rounded-xl bg-[#86f2e4] hover:bg-[#6bd8cb] text-[#005049] text-xs font-mono font-bold cursor-pointer transition-colors"
          >
            Criar Conta Gratuita
          </button>
        </div>
      </section>
    </main>
  );
};
