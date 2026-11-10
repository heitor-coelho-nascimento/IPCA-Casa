import React from 'react';

export interface PublicNavigationHandlers {
  onNavigate: (path: string) => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onEnterDemo: () => void;
  onOpenTerms?: () => void;
}

interface PublicLayoutProps extends PublicNavigationHandlers {
  currentPath: string;
  children: React.ReactNode;
}

const NAV_LINKS = [
  { path: '/', label: 'Início' },
  { path: '/como-funciona', label: 'Como Funciona' },
  { path: '/metodologia', label: 'Metodologia' },
  { path: '/ipca-oficial', label: 'IPCA Oficial' },
  { path: '/privacidade', label: 'Privacidade' },
];

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  currentPath,
  onNavigate,
  onOpenLogin,
  onOpenRegister,
  onEnterDemo,
  onOpenTerms,
  children,
}) => {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col justify-between selection:bg-[#dae2fd]">
      {/* Top Navigation */}
      <header className="min-h-20 px-4 sm:px-6 lg:px-16 py-3 border-b border-[#eff4ff] bg-[#ffffff]/85 backdrop-blur-md sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3">
        <a
          href="/"
          onClick={(e) => handleLinkClick(e, '/')}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-[#000000] text-[#ffffff] flex items-center justify-center font-bold text-base shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              analytics
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl text-[#0b1c30] leading-none tracking-tight">
              IPCA-Casa
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#45464d] mt-0.5">
              Inteligência Financeira Real
            </span>
          </div>
        </a>

        <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = currentPath === link.path;
            return (
              <a
                key={link.path}
                href={link.path}
                onClick={(e) => handleLinkClick(e, link.path)}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#eff4ff] text-[#0b1c30]'
                    : 'text-[#45464d] hover:text-[#0b1c30] hover:bg-[#eff4ff]/60'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onEnterDemo}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#45464d] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              science
            </span>
            <span>Testar Demonstração</span>
          </button>

          <button
            type="button"
            onClick={onOpenLogin}
            className="px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold text-[#0b1c30] hover:bg-[#eff4ff] transition-colors cursor-pointer"
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={onOpenRegister}
            className="px-4 sm:px-5 py-2.5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all shadow-sm cursor-pointer"
          >
            Criar Conta Gratuita
          </button>
        </div>

        {/* Mobile/Tablet Secondary Public Links */}
        <nav
          aria-label="Atalhos das páginas públicas"
          className="w-full flex lg:hidden items-center gap-2 overflow-x-auto pt-1 border-t border-[#eff4ff]"
        >
          {NAV_LINKS.map((link) => {
            const active = currentPath === link.path;
            return (
              <a
                key={link.path}
                href={link.path}
                onClick={(e) => handleLinkClick(e, link.path)}
                aria-current={active ? 'page' : undefined}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  active ? 'bg-[#131b2e] text-[#ffffff]' : 'text-[#45464d] hover:bg-[#eff4ff]'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">{children}</div>

      {/* Institutional Footer with Internal Crawl Links */}
      <footer className="px-6 lg:px-16 py-8 border-t border-[#eff4ff] bg-[#ffffff] text-xs text-[#45464d]">
        <div className="max-w-[1340px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#0b1c30]">IPCA-Casa</span>
              <span>• Calculadora da Inflação Familiar e Poder de Compra Real</span>
            </div>
            <p className="text-[11px] text-[#76777d]">
              Integração direta com séries públicas do IBGE / SIDRA (Tabelas 1737 e 7060). Uso educacional e de planejamento doméstico.
            </p>
          </div>

          <nav aria-label="Links institucionais do rodapé" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.path}
                href={link.path}
                onClick={(e) => handleLinkClick(e, link.path)}
                className="hover:text-[#0b1c30] underline underline-offset-4"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={onEnterDemo}
              className="hover:text-[#0b1c30] underline underline-offset-4 cursor-pointer"
            >
              Modo Demonstração
            </button>
            {onOpenTerms && (
              <button
                type="button"
                onClick={onOpenTerms}
                className="hover:text-[#0b1c30] underline underline-offset-4 cursor-pointer"
              >
                Termos de Uso
              </button>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
};
