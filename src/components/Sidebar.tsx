import React, { useEffect } from 'react';

export type NavTab =
  | 'visao-geral'
  | 'impacto-no-bolso'
  | 'ipca-oficial'
  | 'minha-cesta-familiar'
  | 'precos-e-historico'
  | 'analise-da-inflacao'
  | 'renda-e-poder-de-compra'
  | 'estrategias-de-economia'
  | 'relatorios'
  | 'configuracoes';

export interface SidebarProps {
  currentTab?: NavTab;
  activeTab?: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDemo: boolean;
  onToggleDemo?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout?: () => void;
  userName?: string;
  userAvatar?: string;
  authProvider?: 'local' | 'google' | 'password' | 'email';
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  activeTab,
  onSelectTab,
  isDemo,
  isCollapsed,
  onToggleCollapse,
  onLogout,
  userName,
  userAvatar,
  authProvider,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const effectiveTab = activeTab || currentTab || 'visao-geral';

  // Bloqueio de scroll do body e suporte a Escape quando o drawer mobile estiver aberto
  useEffect(() => {
    if (isMobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCloseMobile?.();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isMobileOpen, onCloseMobile]);

  const navItems = [
    { id: 'visao-geral' as NavTab, label: 'Visão geral', icon: 'grid_view' },
    { id: 'impacto-no-bolso' as NavTab, label: 'Impacto no seu Bolso', icon: 'payments', highlight: true },
    { id: 'ipca-oficial' as NavTab, label: 'IPCA Oficial (IBGE)', icon: 'public' },
    { id: 'minha-cesta-familiar' as NavTab, label: 'Minha cesta familiar', icon: 'shopping_basket' },
    { id: 'precos-e-historico' as NavTab, label: 'Preços e histórico', icon: 'stacked_line_chart' },
    { id: 'analise-da-inflacao' as NavTab, label: 'Análise da inflação', icon: 'finance_mode' },
    { id: 'renda-e-poder-de-compra' as NavTab, label: 'Renda e poder de compra', icon: 'price_change' },
    { id: 'estrategias-de-economia' as NavTab, label: 'Estratégias de economia', icon: 'lightbulb' },
    { id: 'relatorios' as NavTab, label: 'Relatórios executivos', icon: 'article' },
    { id: 'configuracoes' as NavTab, label: 'Configurações', icon: 'tune' },
  ];

  const handleItemClick = (id: NavTab) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavList = (collapsed: boolean) => (
    <nav className="p-3 sm:p-4 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-210px)]">
      {navItems.map((item) => {
        const isActive = effectiveTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleItemClick(item.id)}
            className={`w-full h-10 px-3 rounded-lg flex items-center gap-3 transition-colors text-left cursor-pointer ${
              isActive
                ? 'bg-[#131b2e] text-[#ffffff] font-semibold shadow-[0_1px_3px_0_rgba(15,23,42,0.08)]'
                : item.highlight
                ? 'bg-[#86f2e4]/15 text-[#006a61] hover:bg-[#86f2e4]/25 font-medium'
                : 'text-[#45464d] hover:bg-[#eff4ff] hover:text-[#0b1c30]'
            }`}
            title={item.label}
          >
            <span
              className={`material-symbols-outlined text-[20px] shrink-0 ${
                isActive ? 'text-[#ffffff]' : item.highlight ? 'text-[#006a61]' : 'text-[#45464d]'
              }`}
            >
              {item.icon}
            </span>
            {!collapsed && (
              <span className="text-[13px] truncate flex-1">{item.label}</span>
            )}
            {!collapsed && item.highlight && !isActive && (
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-[#006a61] text-[#ffffff] uppercase tracking-wider">
                R$
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const renderUserFooter = (collapsed: boolean) => (
    <div className="p-4 border-t border-[#eff4ff] flex flex-col gap-2">
      {!collapsed && userName && (
        <div className="px-2 py-1 flex items-center gap-2.5">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={`Avatar de ${userName}`}
              width={28}
              height={28}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover border border-[#e5eeff] shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#131b2e] text-[#ffffff] flex items-center justify-center text-[11px] font-semibold shrink-0">
              {userName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[#0b1c30] truncate">{userName}</div>
            <div className="text-[10px] font-mono text-[#76777d] truncate">
              {isDemo
                ? 'Sessão Demo'
                : authProvider === 'google'
                ? 'Conta Google'
                : 'Conta Verificada'}
            </div>
          </div>
        </div>
      )}

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className={`w-full h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-medium text-[#ba1a1a] hover:bg-[#ffdad6]/30 transition-colors cursor-pointer ${
            collapsed ? 'px-0' : 'px-3'
          }`}
          title={isDemo ? 'Sair do Modo Demonstração' : 'Encerrar Sessão'}
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          {!collapsed && <span>{isDemo ? 'Sair da Demonstração' : 'Encerrar Sessão'}</span>}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* 1. Desktop Sidebar (fixo/sticky no fluxo normal de tela) */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0 bg-[#ffffff] border-r border-[#eff4ff] select-none transition-all duration-300 z-30 ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-[#eff4ff]">
            <div
              className="flex items-center gap-3 overflow-hidden cursor-pointer"
              onClick={() => onSelectTab('visao-geral')}
            >
              <div className="w-8 h-8 rounded-lg bg-[#000000] text-[#ffffff] flex items-center justify-center shrink-0 font-bold text-base shadow-sm">
                <span className="material-symbols-outlined text-[20px]">analytics</span>
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-lg text-[#0b1c30] leading-none tracking-tight">
                    IPCA-Casa
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#45464d] mt-0.5">
                    Índice Familiar Real
                  </span>
                </div>
              )}
            </div>
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isCollapsed ? 'menu' : 'menu_open'}
              </span>
            </button>
          </div>

          {/* Demo Mode Notice */}
          {isDemo && !isCollapsed && (
            <div className="mx-4 mt-3 p-2.5 rounded-lg bg-[#eff4ff] border border-[#e5eeff] text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#006a61]">
                <span className="material-symbols-outlined text-[16px]">science</span>
                <span>Modo Demonstração</span>
              </div>
              <p className="text-[11px] text-[#45464d] mt-0.5 leading-tight">
                Dados fictícios ilustrativos. Não alteram dados de contas reais.
              </p>
            </div>
          )}

          {renderNavList(isCollapsed)}
        </div>

        {renderUserFooter(isCollapsed)}
      </aside>

      {/* 2. Mobile Drawer & Overlay Backdrop */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop com fechamento ao tocar fora */}
          <div
            className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Painel do Drawer */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu de Navegação Principal"
            className="relative w-72 max-w-[85vw] h-full bg-[#ffffff] shadow-2xl z-50 flex flex-col justify-between select-none"
          >
            <div className="flex flex-col">
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#eff4ff]">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => handleItemClick('visao-geral')}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#000000] text-[#ffffff] flex items-center justify-center shrink-0 font-bold text-base shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">analytics</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-lg text-[#0b1c30] leading-none tracking-tight">
                      IPCA-Casa
                    </span>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#45464d] mt-0.5">
                      Índice Familiar Real
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Fechar menu"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {isDemo && (
                <div className="mx-4 mt-3 p-2.5 rounded-lg bg-[#eff4ff] border border-[#e5eeff] text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#006a61]">
                    <span className="material-symbols-outlined text-[16px]">science</span>
                    <span>Modo Demonstração</span>
                  </div>
                  <p className="text-[11px] text-[#45464d] mt-0.5 leading-tight">
                    Dados fictícios ilustrativos. Não alteram dados de contas reais.
                  </p>
                </div>
              )}

              {renderNavList(false)}
            </div>

            {renderUserFooter(false)}
          </div>
        </div>
      )}
    </>
  );
};
