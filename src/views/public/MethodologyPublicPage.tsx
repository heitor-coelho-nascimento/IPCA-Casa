import React from 'react';

interface MethodologyPublicPageProps {
  onNavigate: (path: string) => void;
  onOpenRegister: () => void;
}

export const MethodologyPublicPage: React.FC<MethodologyPublicPageProps> = ({
  onNavigate,
  onOpenRegister,
}) => {
  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <main className="max-w-[1200px] mx-auto w-full px-6 lg:px-12 py-12 flex flex-col gap-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#76777d]">
        <a href="/" onClick={(e) => handleLink(e, '/')} className="hover:text-[#0b1c30] underline">
          Início
        </a>
        <span>/</span>
        <span className="text-[#0b1c30] font-semibold">Metodologia</span>
      </nav>

      <header className="flex flex-col gap-4 max-w-3xl">
        <span className="font-mono text-xs uppercase tracking-wider font-bold text-[#497cff]">
          Fundamentação Econométrica e Estatística
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0b1c30] tracking-tight leading-tight">
          Metodologia do IPCA-Casa: Índice de Laspeyres e Poder de Compra
        </h1>
        <p className="text-base text-[#45464d] leading-relaxed">
          Todas as análises exibidas pelo IPCA-Casa seguem fórmulas econométricas auditáveis. Não aplicamos pesos arbitrários nem aproximações obscuras: cada indicador deriva diretamente dos preços e gastos cadastrados na cesta do domicílio.
        </p>
      </header>

      <section aria-labelledby="formulas-titulo" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 id="formulas-titulo" className="text-lg font-bold text-[#0b1c30]">
            1. Peso Orçamentário por Item (wᵢ)
          </h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Representa a fração do orçamento mensal total alocada a cada produto ou serviço da família. A soma dos pesos da cesta ativa totaliza 100%.
          </p>
          <div className="p-3 bg-[#eff4ff] rounded-xl font-mono text-xs text-[#0b1c30]">
            wᵢ (%) = (Gasto Mensal do Item / Gasto Total Mensal) × 100
          </div>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">
            2. Variação Relativa de Preço (ΔPᵢ)
          </h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Mede a variação percentual unitária entre o preço base anterior e o preço corrente. Quando o preço base é ausente ou inválido (&le; 0), o item é sinalizado como incompleto e ignorado na taxa composta para não gerar falsa estabilidade de 0%.
          </p>
          <div className="p-3 bg-[#eff4ff] rounded-xl font-mono text-xs text-[#0b1c30]">
            ΔPᵢ (%) = ((Preço Atual - Preço Antigo) / Preço Antigo) × 100
          </div>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">
            3. Índice Ponderado de Laspeyres (IPCA-Casa)
          </h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Multiplica o peso orçamentário de cada item pela sua respectiva variação de preço, revelando a contribuição em pontos percentuais (p.p.) e somando todos os impactos.
          </p>
          <div className="p-3 bg-[#eff4ff] rounded-xl font-mono text-xs text-[#0b1c30]">
            Cᵢ (p.p.) = (wᵢ / 100) × ΔPᵢ &nbsp;|&nbsp; IPCA-Casa = Σ Cᵢ
          </div>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">
            4. Poder de Compra Real da Renda (r)
          </h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Desconta o efeito composto da inflação sobre a variação nominal do salário (g), calculando o ganho ou corrosão líquida e o salário de equilíbrio necessário para manter o mesmo consumo.
          </p>
          <div className="p-3 bg-[#eff4ff] rounded-xl font-mono text-xs text-[#0b1c30]">
            r = [ (1 + g/100) / (1 + π/100) - 1 ] × 100
          </div>
        </article>
      </section>

      <section aria-labelledby="impacto-bolso-titulo" className="bg-[#ffffff] p-6 lg:p-8 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-4">
        <h2 id="impacto-bolso-titulo" className="text-xl font-bold text-[#0b1c30]">
          5. Leitura Financeira em Reais (Impacto no Bolso) sem Dupla Contagem
        </h2>
        <p className="text-sm text-[#45464d] leading-relaxed">
          Para evitar ilusões estatísticas, o simulador de impacto apresenta três perspectivas separadas que não devem ser somadas entre si: o efeito sob a taxa oficial do IBGE, o efeito sob a taxa pessoal do IPCA-Casa e a diferença monetária direta observada nos itens.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-[#eff4ff] text-[#0b1c30]">
            <strong className="block text-[#006a61] mb-1">Impacto Mensal Estimado</strong>
            Gasto Mensal × (Taxa Inflação / 100)
          </div>
          <div className="p-4 rounded-xl bg-[#eff4ff] text-[#0b1c30]">
            <strong className="block text-[#006a61] mb-1">Corrosão Anual Projetada</strong>
            Impacto Mensal × 12 (mantido o padrão mensal)
          </div>
          <div className="p-4 rounded-xl bg-[#eff4ff] text-[#0b1c30]">
            <strong className="block text-[#006a61] mb-1">Acumulação IBGE Multimensal</strong>
            [ Π (1 + πₜ / 100) - 1 ] × 100
          </div>
        </div>
      </section>

      <section aria-labelledby="ibge-fonte-titulo" className="bg-[#eff4ff] p-6 lg:p-8 rounded-2xl border border-[#dce9ff] flex flex-col gap-4">
        <h2 id="ibge-fonte-titulo" className="text-xl font-bold text-[#0b1c30]">
          6. Integração com Dados Oficiais do IBGE (SIDRA)
        </h2>
        <p className="text-sm text-[#45464d] leading-relaxed">
          Os dados oficiais nacionais, por grupos de produtos/serviços e por regiões metropolitanas são obtidos por consultas estruturadas ao Sistema IBGE de Recuperação Automática (SIDRA), abrangendo a{' '}
          <strong>Tabela 1737</strong> (série histórica mensal, acumulada no ano e em 12 meses) e a{' '}
          <strong>Tabela 7060</strong> (variações mensais por grupos e localidades, além dos pesos da POF).
        </p>
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <a
            href="/ipca-oficial"
            onClick={(e) => handleLink(e, '/ipca-oficial')}
            className="px-4 py-2 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] transition-colors"
          >
            Consultar IPCA Oficial Atualizado
          </a>
          <a
            href="https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-ipca.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-[#ffffff] text-[#0b1c30] border border-[#c6c6cd] hover:bg-[#f8f9ff] transition-colors"
          >
            Página Oficial IPCA / IBGE ↗
          </a>
          <button
            type="button"
            onClick={onOpenRegister}
            className="px-4 py-2 rounded-lg bg-[#ffffff] text-[#006a61] border border-[#006a61]/30 hover:bg-[#86f2e4]/20 transition-colors cursor-pointer"
          >
            Criar Conta e Aplicar no Meu Orçamento
          </button>
        </div>
      </section>
    </main>
  );
};
