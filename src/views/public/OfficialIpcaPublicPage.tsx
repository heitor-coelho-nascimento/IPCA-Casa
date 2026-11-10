import React from 'react';
import { OfficialIPCAView } from '../OfficialIPCAView';

interface OfficialIpcaPublicPageProps {
  onNavigate: (path: string) => void;
  onOpenRegister: () => void;
  onEnterDemo: () => void;
}

export const OfficialIpcaPublicPage: React.FC<OfficialIpcaPublicPageProps> = ({
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
    <div className="flex flex-col w-full">
      <div className="max-w-[1440px] w-full mx-auto px-6 lg:px-12 pt-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#76777d]">
          <a href="/" onClick={(e) => handleLink(e, '/')} className="hover:text-[#0b1c30] underline">
            Início
          </a>
          <span>/</span>
          <span className="text-[#0b1c30] font-semibold">IPCA Oficial</span>
        </nav>
      </div>

      {/* Consulta pública direta ao serviço IBGE / SIDRA */}
      <OfficialIPCAView analyticsSurface="public" />

      {/* Contexto educativo público e CTAs sem dados privados */}
      <section className="max-w-[1440px] w-full mx-auto px-6 lg:px-12 pb-12">
        <div className="bg-[#131b2e] text-[#ffffff] rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <h2 className="text-xl font-bold">
              Quer comparar o IPCA oficial do IBGE com os gastos reais da sua casa?
            </h2>
            <p className="text-xs sm:text-sm text-[#dae2fd] leading-relaxed">
              O índice nacional reflete uma cesta média ponderada pela POF. Monte sua cesta pessoal no IPCA-Casa para descobrir se a inflação sentida no seu bolso está acima ou abaixo da média oficial.
            </p>
            <div className="flex flex-wrap gap-4 pt-1 text-xs font-mono text-[#86f2e4]">
              <a
                href="https://sidra.ibge.gov.br/tabela/1737"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#ffffff]"
              >
                Fonte: SIDRA Tabela 1737 ↗
              </a>
              <a
                href="https://sidra.ibge.gov.br/tabela/7060"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#ffffff]"
              >
                Fonte: SIDRA Tabela 7060 ↗
              </a>
              <a
                href="/metodologia"
                onClick={(e) => handleLink(e, '/metodologia')}
                className="underline hover:text-[#ffffff]"
              >
                Entender a Metodologia →
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={onEnterDemo}
              className="px-4 py-2.5 rounded-xl bg-[#213145] hover:bg-[#2c3f58] text-[#ffffff] text-xs font-semibold cursor-pointer transition-colors"
            >
              Testar Demonstração
            </button>
            <button
              type="button"
              onClick={onOpenRegister}
              className="px-5 py-2.5 rounded-xl bg-[#86f2e4] hover:bg-[#6bd8cb] text-[#005049] text-xs font-mono font-bold cursor-pointer transition-colors"
            >
              Calcular Meu IPCA-Casa
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
