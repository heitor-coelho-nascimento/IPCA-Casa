import React, { useMemo, useState } from 'react';
import { EconomicCalculationSummary, FamilyProfile } from '../types';
import { IBGESeriesMetadata } from '../services/ibge';
import { formatIsoDateBR } from '../utils/dates';

export interface HeaderProps {
  isSidebarCollapsed: boolean;
  activeProfile: FamilyProfile;
  profiles: FamilyProfile[];
  onSelectProfile: (profileId: string) => void;
  ibgeData?: IBGESeriesMetadata | null;
  summary?: EconomicCalculationSummary | null;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  onOpenNewItem?: () => void;
  onResetToDemo?: () => void;
  onNavigateToSettings?: () => void;
  onCreateProfile?: () => void;
  selectedTimeframe?: string;
  onSelectTimeframe?: (tf: '12M' | 'YTD' | '1M') => void;
  onSwitchToEmptyBasket?: () => void;
  onSwitchToDemoBasket?: () => void;
  isDemo?: boolean;
  userAvatarUrl?: string;
}

interface DynamicAlert {
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: 'danger' | 'success' | 'info';
}

function formatSignedPercent(val: number): string {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2).replace('.', ',')}%`;
}

function formatBRLCompact(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarCollapsed,
  activeProfile,
  profiles,
  onSelectProfile,
  ibgeData = null,
  summary = null,
  searchTerm = '',
  onSearchChange = () => {},
  onNavigateToSettings = () => {},
  onCreateProfile,
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

  const currentLabel =
    timeframes.find((t) => t.id === selectedTimeframe)?.label || 'Últimos 12 meses';

  const toggleMenu = (target: 'profile' | 'timeframe' | 'notifications') => {
    setShowProfileMenu(target === 'profile' ? (prev) => !prev : false);
    setShowTimeframeMenu(target === 'timeframe' ? (prev) => !prev : false);
    setShowNotifications(target === 'notifications' ? (prev) => !prev : false);
  };

  const alerts = useMemo<DynamicAlert[]>(() => {
    const list: DynamicAlert[] = [];

    if (ibgeData && (ibgeData.sourceMode === 'contingency' || ibgeData.sourceMode === 'cached_live')) {
      list.push({
        id: 'ibge-mode',
        title:
          ibgeData.sourceMode === 'cached_live'
            ? 'Série IBGE em Cache Local'
            : 'Série IBGE em Contingência Offline',
        description:
          ibgeData.sourceMode === 'cached_live'
            ? `Exibindo último retorno oficial salvo (${formatIsoDateBR(ibgeData.cachedFromAt || ibgeData.consultedAt)}).`
            : 'Sem resposta da API SIDRA no momento. Exibindo referência auditada até nova conexão.',
        icon: 'cloud_off',
        tone: 'info',
      });
    }

    if (!summary) return list;

    if (summary.totalItemsCount === 0) {
      list.push({
        id: 'empty-basket',
        title: 'Cesta Familiar Vazia',
        description:
          'Cadastre produtos ou serviços em Minha Cesta Familiar para apurar a inflação real da residência.',
        icon: 'shopping_basket',
        tone: 'info',
      });
      return list;
    }

    const topVillain = summary.topVillains.find((v) => v.weightedContribution > 0);
    if (topVillain) {
      list.push({
        id: 'top-villain',
        title: `Maior Pressão: ${topVillain.name}`,
        description: `Contribuição de +${topVillain.weightedContribution.toFixed(2).replace('.', ',')} p.p. com peso de ${topVillain.weightPercent.toFixed(1).replace('.', ',')}% na cesta.`,
        icon: 'trending_up',
        tone: 'danger',
      });
    }

    if (summary.eligibleItemsCount > 0 && ibgeData) {
      if (summary.spreadPP >= 0.5) {
        list.push({
          id: 'spread-high',
          title: 'Inflação Pessoal Acima do IBGE',
          description: `Seu IPCA-Casa está +${summary.spreadPP.toFixed(2).replace('.', ',')} p.p. acima do IPCA oficial (${formatSignedPercent(ibgeData.accumulated12MRate)}).`,
          icon: 'warning',
          tone: 'danger',
        });
      } else if (summary.spreadPP <= -0.5) {
        list.push({
          id: 'spread-low',
          title: 'Cesta Abaixo do IPCA Oficial',
          description: `Sua composição familiar está ${summary.spreadPP.toFixed(2).replace('.', ',')} p.p. abaixo da média nacional no período.`,
          icon: 'check_circle',
          tone: 'success',
        });
      }
    }

    if (
      summary.purchasingPower.hasIncomeData &&
      summary.purchasingPower.monthlyPurchasingDeficitOrGain !== null &&
      summary.purchasingPower.monthlyPurchasingDeficitOrGain < 0
    ) {
      list.push({
        id: 'income-deficit',
        title: 'Perda Real do Poder de Compra',
        description: `Defasagem mensal estimada em ${formatBRLCompact(summary.purchasingPower.monthlyPurchasingDeficitOrGain)} frente à inflação da sua cesta.`,
        icon: 'price_change',
        tone: 'danger',
      });
    }

    return list;
  }, [summary, ibgeData]);

  const hasCriticalAlert = alerts.some((a) => a.tone === 'danger');

  const ibgeHeaderText = useMemo(() => {
    if (!ibgeData || !Number.isFinite(ibgeData.accumulated12MRate)) {
      return 'IPCA Oficial IBGE: Carregando...';
    }
    return `IPCA Oficial IBGE: ${formatSignedPercent(ibgeData.accumulated12MRate)}`;
  }, [ibgeData]);

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
              onClick={() => toggleMenu('profile')}
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
                    type="button"
                    onClick={() => {
                      onSelectProfile(p.id);
                      setShowProfileMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${
                      p.id === activeProfile.id
                        ? 'bg-[#eff4ff] text-[#0b1c30] font-semibold'
                        : 'text-[#45464d] hover:bg-[#f8f9ff]'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{p.name}</span>
                      <span className="text-[11px] text-[#76777d] font-normal truncate">
                        {p.referenceRegion}
                      </span>
                    </div>
                    {p.id === activeProfile.id && (
                      <span className="material-symbols-outlined text-[16px] text-[#006a61] shrink-0">
                        check
                      </span>
                    )}
                  </button>
                ))}
                <div className="border-t border-[#eff4ff] mt-1 pt-1 flex flex-col gap-1">
                  {onCreateProfile && !isDemo && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onCreateProfile();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#006a61] font-medium hover:bg-[#eff4ff] rounded-lg cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                      <span>Novo Perfil Familiar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigateToSettings();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#0b1c30] hover:bg-[#eff4ff] rounded-lg cursor-pointer"
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
              onClick={() => toggleMenu('timeframe')}
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
                    type="button"
                    onClick={() => {
                      onSelectTimeframe(tf.id);
                      setShowTimeframeMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                      selectedTimeframe === tf.id
                        ? 'bg-[#eff4ff] font-semibold text-[#0b1c30]'
                        : 'text-[#45464d] hover:bg-[#f8f9ff]'
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
            onClick={() => {
              setShowProfileMenu(false);
              setShowTimeframeMenu(false);
              setShowNotifications(false);
              setShowIBGEMetadata(true);
            }}
            className="hidden xl:flex items-center gap-2 bg-[#dce9ff] hover:bg-[#d3e4fe] px-3 py-1 rounded-full cursor-pointer transition-colors"
            type="button"
            title="Clique para auditar a série oficial do IBGE"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                ibgeData?.sourceMode === 'live'
                  ? 'bg-[#006a61] animate-pulse'
                  : 'bg-[#497cff]'
              }`}
            />
            <span className="font-mono text-[12px] text-[#497cff] font-semibold">
              {ibgeHeaderText}
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
              placeholder="Buscar na cesta familiar..."
              aria-label="Buscar na cesta familiar"
              className="h-9 pl-9 pr-8 w-64 rounded-lg bg-[#eff4ff] text-[#0b1c30] placeholder:text-[#45464d] text-sm focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#006a61] transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Limpar busca"
                className="absolute right-2.5 text-[#76777d] hover:text-[#0b1c30] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Notifications Button */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('notifications')}
              className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
              type="button"
              title="Notificações e Alertas"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {hasCriticalAlert && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ba1a1a]" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-[#ffffff] rounded-xl shadow-xl border border-[#eff4ff] p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-[#eff4ff]">
                  <span className="font-semibold text-sm text-[#0b1c30]">Alertas do Orçamento</span>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                      alerts.length > 0
                        ? 'text-[#006a61] bg-[#86f2e4]/30'
                        : 'text-[#76777d] bg-[#eff4ff]'
                    }`}
                  >
                    {alerts.length} {alerts.length === 1 ? 'Ativo' : 'Ativos'}
                  </span>
                </div>

                {alerts.length === 0 ? (
                  <div className="py-5 px-2 text-center text-xs text-[#76777d]">
                    Nenhum alerta ativo para o perfil selecionado.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mt-2 text-xs max-h-72 overflow-y-auto">
                    {alerts.map((al) => (
                      <div key={al.id} className="p-2.5 rounded-lg bg-[#eff4ff] text-[#0b1c30]">
                        <div
                          className={`font-semibold flex items-center gap-1 ${
                            al.tone === 'danger'
                              ? 'text-[#ba1a1a]'
                              : al.tone === 'success'
                              ? 'text-[#006a61]'
                              : 'text-[#497cff]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">{al.icon}</span>
                          <span className="truncate">{al.title}</span>
                        </div>
                        <p className="text-[#45464d] mt-0.5 leading-relaxed">{al.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#eff4ff]">
            {userAvatarUrl && !avatarLoadError ? (
              <img
                src={userAvatarUrl}
                alt={`Foto de perfil de ${activeProfile.name}`}
                width={32}
                height={32}
                loading="lazy"
                decoding="async"
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
                  .filter(Boolean)
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
                type="button"
                onClick={() => setShowIBGEMetadata(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#eff4ff] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between py-1 border-b border-[#eff4ff] gap-4">
                <span className="text-[#45464d]">Fonte Primária:</span>
                <span className="font-medium text-[#0b1c30] text-right">
                  {ibgeData?.source || 'SIDRA / IBGE'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff] gap-4">
                <span className="text-[#45464d]">Tabelas Consultadas:</span>
                <span className="font-mono font-medium text-[#0b1c30] text-right">
                  {ibgeData?.tableCode || '1737 / 7060'} (IPCA)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff] gap-4">
                <span className="text-[#45464d]">Variáveis Pesquisadas:</span>
                <span className="font-mono font-medium text-[#0b1c30] text-right">
                  {ibgeData?.variableCode || '63, 69, 2265, 66'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff] gap-4">
                <span className="text-[#45464d]">Abrangência Geográfica:</span>
                <span className="font-medium text-[#0b1c30] text-right">
                  {ibgeData?.coverage || 'Brasil (Nacional)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff] gap-4">
                <span className="text-[#45464d]">Período de Referência:</span>
                <span className="font-medium text-[#0b1c30] text-right">
                  {ibgeData?.referencePeriod || 'Aguardando resposta da API SIDRA'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eff4ff] gap-4">
                <span className="text-[#45464d]">Taxa Acumulada 12 Meses:</span>
                <span className="font-mono font-bold text-[#497cff] text-base">
                  {ibgeData && Number.isFinite(ibgeData.accumulated12MRate)
                    ? formatSignedPercent(ibgeData.accumulated12MRate)
                    : 'Indisponível'}
                </span>
              </div>
              {ibgeData && (
                <div className="flex justify-between py-1 border-b border-[#eff4ff] gap-4">
                  <span className="text-[#45464d]">Última Referência / Consulta:</span>
                  <span className="font-mono text-xs text-[#0b1c30]">
                    {formatIsoDateBR(ibgeData.cachedFromAt || ibgeData.consultedAt)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-1 gap-4">
                <span className="text-[#45464d]">Status da Conexão:</span>
                <span
                  className={`font-mono text-xs px-2 py-0.5 rounded font-semibold ${
                    ibgeData?.sourceMode === 'live'
                      ? 'bg-[#86f2e4]/30 text-[#006a61]'
                      : ibgeData?.sourceMode === 'cached_live'
                      ? 'bg-[#dce9ff] text-[#497cff]'
                      : 'bg-[#ffdad6] text-[#ba1a1a]'
                  }`}
                >
                  {ibgeData?.sourceMode === 'live'
                    ? 'Tempo Real (SIDRA/IBGE)'
                    : ibgeData?.sourceMode === 'cached_live'
                    ? 'Cache Local do Último Retorno Real'
                    : ibgeData
                    ? 'Referência de Contingência Offline'
                    : 'Consultando...'}
                </span>
              </div>
              {ibgeData?.lastErrorMessage && (
                <p className="text-[11px] font-mono text-[#76777d] bg-[#eff4ff] p-2 rounded-lg">
                  Motivo: {ibgeData.lastErrorMessage}
                </p>
              )}
            </div>

            <div className="bg-[#eff4ff] p-3 rounded-xl text-xs text-[#45464d] leading-relaxed">
              <strong>Nota Metodológica:</strong> O IPCA mede a variação de preços para famílias com rendimento de 1 a 40 salários mínimos nas regiões metropolitanas. A comparação com o IPCA-Casa utiliza a metodologia de índice de Laspeyres ponderado.
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowIBGEMetadata(false)}
                className="px-5 py-2 bg-[#000000] text-[#ffffff] rounded-lg text-sm font-medium hover:bg-[#213145] transition-colors cursor-pointer"
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

