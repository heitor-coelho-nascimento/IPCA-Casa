import React, { useState } from 'react';
import { FamilyProfile } from '../types';
import { IBGESeriesMetadata } from '../services/ibge';

export interface HeaderProps {
  isSidebarCollapsed: boolean;
  activeProfile: FamilyProfile;
  profiles: FamilyProfile[];
  onSelectProfile: (profileId: string) => void;
  ibgeData?: IBGESeriesMetadata | null;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  onOpenNewItem?: () => void;
  onResetToDemo?: () => void;
  onNavigateToSettings?: () => void;
  onCreateProfile?: () => void;
  selectedTimeframe?: string;
  onSelectTimeframe?: (tf: any) => void;
  onSwitchToEmptyBasket?: () => void;
  onSwitchToDemoBasket?: () => void;
  isDemo?: boolean;
  userAvatarUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarCollapsed,
  activeProfile,
  profiles,
  onSelectProfile,
  ibgeData = null,
  searchTerm = '',
  onSearchChange = () => {},
  onOpenNewItem = () => {},
  onResetToDemo = () => {},
  onNavigateToSettings = () => {},
  onCreateProfile = () => {},
  onSwitchToEmptyBasket = () => {},
  onSwitchToDemoBasket = () => {},
  selectedTimeframe = '12M',
  onSelectTimeframe = () => {},
  isDemo = false,
  userAvatarUrl,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showIBGEMetadata, setShowIBGEMetadata] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const timeframes: { id: '12M' | 'YTD' | '1M'; label: string }[] = [
    { id: '12M', label: 'Últimos 12 meses' },
    { id: 'YTD', label: 'Ano Atual (YTD)' },
    { id: '1M', label: 'Último Mês' },
  ];

  const currentLabel = timeframes.find((t) => t.id === selectedTimeframe)?.label || 'Últimos 12 meses';

  return (
    <>
      <header
        className={`fixed top-0 right-0 h-16 bg-[#f8f9ff]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-6 transition-all duration-300 ${
          isSidebarCollapsed ? 'left-20' : 'left-72'
        }`}
      >
        {/* Left: Selectors & IBGE Tag */}
        <div className="flex items-center gap-3">
          {/* Profile Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 bg-[#eff4ff] hover:bg-[#e5eeff] px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-[#45464d]">group</span>
              <span className="text-[14px] font-medium text-[#0b1c30] max-w-[190px] truncate">
                {activeProfile.name}
              </span>
              <span className="material-symbols-outlined text-[16px] text-[#45464d]">expand_more</span>
            </button>

            {showProfileMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#ffffff] rounded-xl shadow-xl border border-[#eff4ff] p-2 z-50">
                <div className="px-2.5 py-1.5 text-[11px] font-mono text-[#76777d] uppercase tracking-wider">
                  Selecione o Perfil Familiar
                </div>
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectProfile(p.id);
                      setShowProfileMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      p.id === activeProfile.id
                        ? 'bg-[#eff4ff] text-[#0b1c30] font-semibold'
                        : 'text-[#45464d] hover:bg-[#f8f9ff]'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span>{p.name}</span>
                      <span className="text-[11px] text-[#76777d] font-normal">{p.referenceRegion}</span>
                    </div>
                    {p.id === activeProfile.id && (
                      <span className="material-symbols-outlined text-[16px] text-[#006a61]">check</span>
                    )}
                  </button>
                ))}
                <div className="border-t border-[#eff4ff] mt-1 pt-1 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigateToSettings();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#0b1c30] hover:bg-[#eff4ff] rounded-lg"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span>Gerenciar Perfis & Região</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeframe Switcher */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowTimeframeMenu(!showTimeframeMenu)}
              className="flex items-center gap-2 bg-[#eff4ff] hover:bg-[#e5eeff] px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-[#45464d]">calendar_today</span>
              <span className="text-[13px] font-mono text-[#0b1c30] font-medium">{currentLabel}</span>
              <span className="material-symbols-outlined text-[16px] text-[#45464d]">expand_more</span>
            </button>

            {showTimeframeMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-52 bg-[#ffffff] rounded-xl shadow-xl border border-[#eff4ff] p-1.5 z-50">
                {timeframes.map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => {
                      onSelectTimeframe(tf.id);
                      setShowTimeframeMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                      selectedTimeframe === tf.id ? 'bg-[#eff4ff] font-semibold text-[#0b1c30]' : 'text-[#45464d] hover:bg-[#f8f9ff]'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Official IBGE Indicator Button */}
          <button
            onClick={() => setShowIBGEMetadata(true)}
            className="hidden xl:flex items-center gap-2 bg-[#dce9ff] hover:bg-[#d3e4fe] px-3 py-1 rounded-full cursor-pointer transition-colors"
            type="button"
            title="Clique para auditar a série oficial do IBGE"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#497cff] animate-pulse" />
            <span className="font-mono text-[12px] text-[#497cff] font-semibold">
              IPCA Oficial IBGE: {ibgeData ? `+${ibgeData.accumulated12MRate.toFixed(2).replace('.', ',')}%` : '+4,50%'}
            </span>
            <span className="material-symbols-outlined text-[14px] text-[#497cff]">info</span>
          </button>
        </div>

        {/* Right: Search, Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative hidden md:flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-[18px] text-[#45464d]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar gastos, itens ou subíndices..."
              className="h-9 pl-9 pr-8 w-64 rounded-lg bg-[#eff4ff] text-[#0b1c30] placeholder:text-[#45464d] text-sm focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#006a61] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 text-[#76777d] hover:text-[#0b1c30]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Notifications Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors"
              type="button"
              title="Notificações e Alertas"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ba1a1a]" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-[#ffffff] rounded-xl shadow-xl border border-[#eff4ff] p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-[#eff4ff]">
                  <span className="font-semibold text-sm text-[#0b1c30]">Alertas do Orçamento</span>
                  <span className="text-[11px] font-mono text-[#006a61] bg-[#86f2e4]/30 px-2 py-0.5 rounded">3 Ativos</span>
                </div>
                <div className="flex flex-col gap-2 mt-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#eff4ff] text-[#0b1c30]">
                    <div className="font-semibold flex items-center gap-1 text-[#ba1a1a]">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      Bandeira Amarela na Energia
                    </div>
                    <p className="text-[#45464d] mt-0.5">Impacto estimado de +R$ 28,00 no próximo ciclo residencial.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#eff4ff] text-[#0b1c30]">
                    <div className="font-semibold flex items-center gap-1 text-[#ba1a1a]">
                      <span className="material-symbols-outlined text-[14px]">trending_up</span>
                      Azeite em Máxima Histórica
                    </div>
                    <p className="text-[#45464d] mt-0.5">Alta de +48,8% acumulada. Sugestão: óleo de girassol + azeite composto.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#eff4ff] text-[#0b1c30]">
                    <div className="font-semibold flex items-center gap-1 text-[#006a61]">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Paridade Etanol Favorável
                    </div>
                    <p className="text-[#45464d] mt-0.5">Etanol a 68% da gasolina nos postos da sua rota em SP.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar with Settings & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#eff4ff]">
            {userAvatarUrl && !avatarLoadError ? (
              <img
                src={userAvatarUrl}
                alt={activeProfile.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarLoadError(true)}
                onClick={onNavigateToSettings}
                title={`Perfil: ${activeProfile.name}`}
                className="w-8 h-8 rounded-full object-cover cursor-pointer shadow-sm border border-[#e5eeff] hover:opacity-90 transition-opacity"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full bg-[#131b2e] text-[#ffffff] flex items-center justify-center font-semibold text-xs cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
                title={`Perfil: ${activeProfile.name}`}
                onClick={onNavigateToSettings}
              >
                {activeProfile.name
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join('') || 'IC'}
              </div>
            )}
            {isDemo && (
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#eff4ff] text-[#45464d] border border-[#e5eeff]">
                Demonstração
              </span>
            )}
          </div>
        </div>
      </header>

      {/* IBGE SIDRA Metadata Modal */}
      {showIBGEMetadata && (
        <div className="fixed inset-0 bg-[#213145]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] rounded-2xl max-w-lg w-full shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[#497cff]">account_balance</span>
                <span className="font-semibold text-lg text-[#0b1c30]">Metadados Oficiais - SIDRA/IBGE</span>
              </div>
              <button
                onClick={() => setShowIBGEMetadata(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#eff4ff]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between py-1 border-b border-[#eff4ff]">
                <span className="text-[#45464d]">Fonte Primária:</span>
                <span className="font-medium text-[#0b1c30]">{ibgeData?.source || 'SIDRA / IBGE'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff]">
                <span className="text-[#45464d]">Código da Tabela Oficial:</span>
                <span className="font-mono font-medium text-[#0b1c30]">Tabela 1737 (IPCA)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff]">
                <span className="text-[#45464d]">Variável Pesquisada:</span>
                <span className="font-mono font-medium text-[#0b1c30]">Variável 63 (Variação mensal %)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff]">
                <span className="text-[#45464d]">Abrangência Geográfica:</span>
                <span className="font-medium text-[#0b1c30]">{ibgeData?.coverage || 'Brasil (Nacional)'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff]">
                <span className="text-[#45464d]">Período de Referência:</span>
                <span className="font-medium text-[#0b1c30]">{ibgeData?.referencePeriod || 'Mar/2023 a Mar/2024'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff]">
                <span className="text-[#45464d]">Taxa Acumulada 12 Meses:</span>
                <span className="font-mono font-bold text-[#497cff] text-base">
                  +{ibgeData?.accumulated12MRate.toFixed(2).replace('.', ',')}%
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#45464d]">Status da Conexão:</span>
                <span className={`font-mono text-xs px-2 py-0.5 rounded font-semibold ${
                  ibgeData?.isContingencyData ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#86f2e4]/30 text-[#006a61]'
                }`}>
                  {ibgeData?.isContingencyData ? 'Cache de Contingência Auditado' : 'Conexão em Tempo Real com API IBGE'}
                </span>
              </div>
            </div>

            <div className="bg-[#eff4ff] p-3 rounded-xl text-xs text-[#45464d] leading-relaxed">
              <strong>Nota Metodológica:</strong> O IPCA mede a variação de preços para famílias com rendimento de 1 a 40 salários mínimos nas regiões metropolitanas. A comparação com o IPCA-Casa utiliza o mesmo período temporal e a metodologia de cálculo ponderado de Laspeyres.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowIBGEMetadata(false)}
                className="px-5 py-2 bg-[#000000] text-[#ffffff] rounded-lg text-sm font-medium hover:bg-[#213145] transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
