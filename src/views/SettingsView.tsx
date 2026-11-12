import React, { useEffect, useState } from 'react';
import { FamilyProfile, MonthlyClosure, ProfileMode, UserAccount } from '../types';
import { StorageService } from '../services/storage';
import { IBGESeriesMetadata, IBGEService } from '../services/ibge';
import { trackExportData } from '../services/analytics';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatIsoDateBR, getTodayIsoDate } from '../utils/dates';
import { getProfileModeCopy, resolveProfileMode } from '../utils/profileMode';

interface SettingsViewProps {
  activeProfile: FamilyProfile;
  profiles?: FamilyProfile[];
  ibgeData?: IBGESeriesMetadata | null;
  monthlyClosures?: MonthlyClosure[];
  onUpdateProfile: (profile: FamilyProfile) => void | Promise<void>;
  onSelectProfile?: (profileId: string) => void;
  onCreateProfile?: (params: {
    name: string;
    membersCount: number;
    referenceRegion: string;
    profileMode?: ProfileMode;
    priceAlertThresholdPercent?: number;
  }) => void | Promise<void>;
  onDeleteProfile?: (profileId: string) => void | Promise<void>;
  onWipeAllUserData?: () => void | Promise<void>;
  onSwitchToEmptyBasket: () => void;
  onSwitchToDemoBasket: () => void;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
  isDemo: boolean;
  onRefreshData: () => void;
  currentUser?: UserAccount | null;
  isFirebaseMode?: boolean;
  onExportBackupData?: () => unknown;
}

const REGION_OPTIONS = [
  { value: 'Brasil', label: 'Brasil (Nacional)' },
  { value: 'São Paulo - SP', label: 'São Paulo - SP' },
  { value: 'Rio de Janeiro - RJ', label: 'Rio de Janeiro - RJ' },
  { value: 'Belo Horizonte - MG', label: 'Belo Horizonte - MG' },
  { value: 'Porto Alegre - RS', label: 'Porto Alegre - RS' },
  { value: 'Curitiba - PR', label: 'Curitiba - PR' },
  { value: 'Salvador - BA', label: 'Salvador - BA' },
  { value: 'Recife - PE', label: 'Recife - PE' },
  { value: 'Fortaleza - CE', label: 'Fortaleza - CE' },
  { value: 'Brasília - DF', label: 'Brasília - DF' },
  { value: 'Goiânia - GO', label: 'Goiânia - GO' },
  { value: 'Belém - PA', label: 'Belém - PA' },
];

function formatSignedRate(val: number | undefined | null): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const sign = val > 0 ? '+' : val < 0 ? '-' : '';
  return `${sign}${Math.abs(val).toFixed(2).replace('.', ',')}%`;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeProfile,
  profiles = [],
  ibgeData = null,
  monthlyClosures,
  onUpdateProfile,
  onSelectProfile,
  onCreateProfile,
  onDeleteProfile,
  onWipeAllUserData,
  onSwitchToEmptyBasket,
  onSwitchToDemoBasket,
  onNotify,
  isDemo,
  onRefreshData,
  currentUser = null,
  isFirebaseMode = false,
  onExportBackupData,
}) => {
  const [profileName, setProfileName] = useState(activeProfile.name);
  const [region, setRegion] = useState(activeProfile.referenceRegion);
  const [membersCount, setMembersCount] = useState(activeProfile.membersCount);
  const [profileMode, setProfileMode] = useState<ProfileMode>(() =>
    resolveProfileMode(activeProfile.profileMode)
  );
  const [alertThreshold, setAlertThreshold] = useState<number>(
    activeProfile.priceAlertThresholdPercent ?? 10
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Novo perfil
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileMembers, setNewProfileMembers] = useState(2);
  const [newProfileRegion, setNewProfileRegion] = useState('Brasil');
  const [newProfileMode, setNewProfileMode] = useState<ProfileMode>('pessoal');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Confirmação para excluir perfil ou limpar dados (LGPD)
  const [profilePendingDelete, setProfilePendingDelete] = useState<FamilyProfile | null>(null);
  const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // IBGE SIDRA sync state
  const [isSyncingIBGE, setIsSyncingIBGE] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(activeProfile.name);
    setRegion(activeProfile.referenceRegion);
    setMembersCount(activeProfile.membersCount);
    setProfileMode(resolveProfileMode(activeProfile.profileMode));
    setAlertThreshold(activeProfile.priceAlertThresholdPercent ?? 10);
    setProfileFeedback(null);
  }, [
    activeProfile.id,
    activeProfile.name,
    activeProfile.referenceRegion,
    activeProfile.membersCount,
    activeProfile.profileMode,
    activeProfile.priceAlertThresholdPercent,
  ]);

  const modeCopy = getProfileModeCopy(profileMode);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);
    const trimmedName = profileName.trim();
    if (trimmedName.length < 2) {
      setProfileFeedback({ type: 'error', text: 'O nome do perfil precisa ter pelo menos 2 caracteres.' });
      return;
    }

    const safeThreshold = Number.isFinite(alertThreshold)
      ? Math.max(1, Math.min(100, Math.round(alertThreshold * 10) / 10))
      : 10;

    const updated: FamilyProfile = {
      ...activeProfile,
      name: trimmedName,
      referenceRegion: region,
      membersCount: Math.max(1, Math.min(50, Math.round(membersCount) || 1)),
      profileMode,
      priceAlertThresholdPercent: safeThreshold,
      updatedAt: new Date().toISOString(),
    };

    setIsSavingProfile(true);
    try {
      await onUpdateProfile(updated);
      setProfileFeedback({
        type: 'success',
        text: 'Configurações do perfil salvas com sucesso!',
      });
    } catch {
      setProfileFeedback({
        type: 'error',
        text: 'Não foi possível salvar as alterações do perfil.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateNewProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateProfile) return;
    if (newProfileName.trim().length < 2) {
      onNotify?.('error', 'Informe um nome com ao menos 2 caracteres para o novo perfil.');
      return;
    }
    setIsCreatingProfile(true);
    try {
      await onCreateProfile({
        name: newProfileName.trim(),
        membersCount: newProfileMembers,
        referenceRegion: newProfileRegion,
        profileMode: newProfileMode,
        priceAlertThresholdPercent: 10,
      });
      setNewProfileName('');
      setNewProfileMembers(2);
      setNewProfileRegion('Brasil');
      setNewProfileMode('pessoal');
      setShowCreateProfile(false);
    } catch {
      onNotify?.('error', 'Não foi possível criar o novo perfil.');
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleConfirmDeleteProfile = async () => {
    if (!profilePendingDelete || !onDeleteProfile) return;
    const target = profilePendingDelete;
    setProfilePendingDelete(null);
    await onDeleteProfile(target.id);
  };

  const handleConfirmWipeAll = async () => {
    if (!onWipeAllUserData) return;
    setIsWipeConfirmOpen(false);
    setIsWiping(true);
    try {
      await onWipeAllUserData();
    } finally {
      setIsWiping(false);
    }
  };

  const handleForceSyncIBGE = async () => {
    setIsSyncingIBGE(true);
    setSyncMessage(null);
    try {
      const metadata = await IBGEService.refresh();
      const statusText =
        metadata.sourceMode === 'live'
          ? `Sincronização SIDRA concluída! Série atualizada até ${metadata.latestMonthLabel} (Mensal: ${formatSignedRate(
              metadata.latestMonthlyRate
            )}, 12M: ${formatSignedRate(metadata.accumulated12MRate)}).`
          : metadata.sourceMode === 'cached_live'
          ? `SIDRA instável no momento. Mantendo último dado real em cache (${metadata.latestMonthLabel}).`
          : 'SIDRA indisponível no momento. Exibindo série de referência offline auditada.';
      setSyncMessage(statusText);
      onRefreshData();
    } catch {
      setSyncMessage('Falha na conexão direta com a API SIDRA do IBGE. Cache mantido.');
    } finally {
      setIsSyncingIBGE(false);
    }
  };

  const handleExportFullBackup = () => {
    const backup = onExportBackupData
      ? onExportBackupData()
      : {
          profile: StorageService.getProfile(),
          profiles: StorageService.getProfiles(),
          items: StorageService.getAllStoredItems(),
          prices: StorageService.getAllPrices(),
          income: StorageService.getAllStoredIncome(),
          monthlyClosures:
            monthlyClosures ?? StorageService.getMonthlyClosures(activeProfile.id),
          plansA: StorageService.getPlansA(),
          plansB: StorageService.getPlansB(),
          planC: StorageService.getPlanC(),
          exportedAt: new Date().toISOString(),
          version: '3.3.0',
        };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ipca_casa_backup_${getTodayIsoDate()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    trackExportData('backup_json');
    onNotify?.('success', 'Arquivo de backup JSON gerado para download.');
  };

  const visibleProfiles = profiles.length > 0 ? profiles : [activeProfile];
  const ibgeBadgeConfig =
    ibgeData?.sourceMode === 'live' && !ibgeData.isContingencyData
      ? {
          bg: 'bg-[#86f2e4]/30 text-[#006a61]',
          dot: 'bg-[#006a61]',
          label: 'SIDRA Ao Vivo',
        }
      : ibgeData?.sourceMode === 'cached_live' && !ibgeData.isContingencyData
      ? {
          bg: 'bg-[#fef3c7] text-[#92400e]',
          dot: 'bg-[#d97706]',
          label: 'Cache SIDRA',
        }
      : {
          bg: 'bg-[#eff4ff] text-[#45464d]',
          dot: 'bg-[#76777d]',
          label: ibgeData ? 'Contingência Offline' : 'Aguardando',
        };

  return (
    <div className="flex flex-col w-full px-6 lg:px-12 py-8 max-w-[1440px] mx-auto gap-8">
      {/* Sub-Header */}
      <div className="p-3 bg-[#eff4ff] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-[#e5eeff]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#006a61] animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-[#45464d] font-semibold">
            Central de Parâmetros, Perfil & Integrações
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#45464d]">
          <span className="material-symbols-outlined text-[16px] text-[#006a61]">settings</span>
          <span>
            {isFirebaseMode
              ? 'Sincronização Cloud Firestore Ativa'
              : isDemo
              ? 'Ambiente de Demonstração Local'
              : 'Persistência Local no Navegador'}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[#497cff] font-mono text-xs uppercase tracking-wider font-semibold">
          <span className="material-symbols-outlined text-[18px]">tune</span>
          <span>Preferências do Sistema</span>
        </div>
        <h1 className="text-3xl font-bold text-[#0b1c30] tracking-tight mt-1">
          Configurações do Perfil
        </h1>
        <p className="text-xs text-[#45464d] mt-1 max-w-2xl">
          Gerencie seus perfis familiares, alterne entre a cesta de demonstração e sua cesta real, e acompanhe a sincronização oficial com o IBGE.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Basket Scenario Mode, Multi-Profile & Edit Profile */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Card: Inicialização da Cesta Familiar */}
          <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#eff4ff]">
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#006a61]">
                <span className="material-symbols-outlined text-[20px]">dataset</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Modo da Cesta de Consumo
                </h3>
                <p className="text-xs text-[#45464d]">
                  Escolha entre explorar a cesta demonstrativa de exemplo ou utilizar sua cesta personalizada.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div
                onClick={onSwitchToDemoBasket}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isDemo
                    ? 'border-[#000000] bg-[#eff4ff]/40 shadow-sm'
                    : 'border-[#eff4ff] hover:border-[#c6c6cd] bg-[#ffffff]'
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#497cff]">science</span>
                    <span className="text-xs font-bold text-[#0b1c30]">
                      Cesta Demonstrativa de Exemplo
                    </span>
                  </div>
                  <p className="text-xs text-[#45464d] mt-1">
                    Cesta pré-configurada de exemplo com itens variados de alimentação, moradia, energia, transportes e saúde para explorar cálculos e relatórios.
                  </p>
                  <span className="text-[11px] font-mono text-[#76777d] mt-1">
                    * Valores didáticos de demonstração — não representam dados de usuários reais.
                  </span>
                </div>
                {isDemo && (
                  <span className="material-symbols-outlined text-[#006a61] text-[20px] shrink-0">
                    check_circle
                  </span>
                )}
              </div>

              <div
                onClick={onSwitchToEmptyBasket}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  !isDemo
                    ? 'border-[#000000] bg-[#eff4ff]/40 shadow-sm'
                    : 'border-[#eff4ff] hover:border-[#c6c6cd] bg-[#ffffff]'
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#006a61]">edit_note</span>
                    <span className="text-xs font-bold text-[#0b1c30]">
                      Minha Cesta Pessoal em Branco
                    </span>
                  </div>
                  <p className="text-xs text-[#45464d] mt-1">
                    Comece com uma cesta limpa para cadastrar exclusivamente os produtos, serviços, boletos e despesas do seu próprio orçamento familiar.
                  </p>
                </div>
                {!isDemo && (
                  <span className="material-symbols-outlined text-[#006a61] text-[20px] shrink-0">
                    check_circle
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card: Perfis Familiares Cadastrados (Multi-perfil) */}
          {visibleProfiles.length > 0 && (onSelectProfile || onCreateProfile || onDeleteProfile) && (
            <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#eff4ff]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#0b1c30]">
                    <span className="material-symbols-outlined text-[20px]">group</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0b1c30]">Perfis Domésticos</h3>
                    <p className="text-xs text-[#45464d]">
                      Alterne ou gerencie múltiplos orçamentos na mesma conta.
                    </p>
                  </div>
                </div>
                {onCreateProfile && !isDemo && (
                  <button
                    type="button"
                    onClick={() => setShowCreateProfile((v) => !v)}
                    className="h-8 px-3 rounded-lg bg-[#000000] hover:bg-[#213145] text-[#ffffff] font-mono text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {showCreateProfile ? 'close' : 'add'}
                    </span>
                    <span>{showCreateProfile ? 'Cancelar' : 'Novo Perfil'}</span>
                  </button>
                )}
              </div>

              {showCreateProfile && onCreateProfile && (
                <form
                  onSubmit={handleCreateNewProfile}
                  className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#d3e4fe] flex flex-col gap-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="Nome do perfil..."
                      className="h-9 px-3 rounded-lg bg-[#ffffff] border border-[#c6c6cd] text-xs text-[#0b1c30] focus:outline-none sm:col-span-2"
                    />
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={newProfileMembers}
                      onChange={(e) => setNewProfileMembers(parseInt(e.target.value, 10) || 1)}
                      className="h-9 px-3 rounded-lg bg-[#ffffff] border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none"
                      title="Número de integrantes"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#45464d]">Tipo:</span>
                    <button
                      type="button"
                      onClick={() => setNewProfileMode('pessoal')}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold cursor-pointer ${
                        newProfileMode === 'pessoal'
                          ? 'bg-[#000000] text-[#ffffff]'
                          : 'bg-[#ffffff] text-[#45464d] border border-[#c6c6cd]'
                      }`}
                    >
                      Pessoal / Familiar
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProfileMode('negocio')}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold cursor-pointer ${
                        newProfileMode === 'negocio'
                          ? 'bg-[#000000] text-[#ffffff]'
                          : 'bg-[#ffffff] text-[#45464d] border border-[#c6c6cd]'
                      }`}
                    >
                      Negócio / Pequena Empresa
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={newProfileRegion}
                      onChange={(e) => setNewProfileRegion(e.target.value)}
                      className="h-9 px-3 rounded-lg bg-[#ffffff] border border-[#c6c6cd] text-xs text-[#0b1c30] flex-1 focus:outline-none"
                    >
                      {REGION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={isCreatingProfile}
                      className="h-9 px-4 rounded-lg bg-[#006a61] text-[#ffffff] font-mono text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      {isCreatingProfile ? 'Criando...' : 'Criar Perfil'}
                    </button>
                  </div>
                </form>
              )}

              <div className="flex flex-col gap-2">
                {visibleProfiles.map((prof) => {
                  const isActive = prof.id === activeProfile.id;
                  const profCopy = getProfileModeCopy(prof.profileMode);
                  const canDelete =
                    Boolean(onDeleteProfile) && visibleProfiles.length > 1 && !prof.isDemo;
                  return (
                    <div
                      key={prof.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isActive
                          ? 'border-[#000000] bg-[#eff4ff]/50'
                          : 'border-[#eff4ff] bg-[#ffffff] hover:border-[#c6c6cd]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectProfile?.(prof.id)}
                        className="flex-1 text-left cursor-pointer min-w-0"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#0b1c30] truncate">{prof.name}</span>
                          <span className="px-2 py-0.5 rounded bg-[#eff4ff] text-[#45464d] font-mono text-[10px]">
                            {profCopy.badgeLabel}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded bg-[#006a61] text-[#ffffff] font-mono text-[10px] font-semibold">
                              Ativo
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-[#76777d]">
                          {prof.membersCount} {prof.membersCount === 1 ? 'integrante' : 'integrantes'} •{' '}
                          {prof.referenceRegion}
                        </span>
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setProfilePendingDelete(prof)}
                          className="w-8 h-8 rounded-lg bg-[#ffdad6]/40 hover:bg-[#ffdad6] text-[#ba1a1a] inline-flex items-center justify-center shrink-0 cursor-pointer"
                          title="Excluir perfil"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card: Editar Perfil Familiar Ativo */}
          <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#eff4ff]">
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#497cff]">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Dados Cadastrais do Domicílio
                </h3>
                <p className="text-xs text-[#45464d]">
                  Informações de identificação, localidade e dimensionamento da família.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              {/* Seletor de Modo Pessoal vs Negócio */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-[#45464d] font-medium">
                  Como você usa este perfil?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setProfileMode('pessoal')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      profileMode === 'pessoal'
                        ? 'border-[#000000] bg-[#eff4ff]/60'
                        : 'border-[#eff4ff] hover:border-[#c6c6cd]'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#0b1c30]">Pessoal / Familiar</div>
                    <div className="text-[11px] text-[#45464d] mt-0.5">
                      Compras da casa, contas e salário mensal.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileMode('negocio')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      profileMode === 'negocio'
                        ? 'border-[#000000] bg-[#eff4ff]/60'
                        : 'border-[#eff4ff] hover:border-[#c6c6cd]'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#0b1c30]">Negócio / Pequena Empresa</div>
                    <div className="text-[11px] text-[#45464d] mt-0.5">
                      Insumos, fornecedores e custos operacionais.
                    </div>
                  </button>
                </div>
                <span className="text-[11px] text-[#76777d]">
                  {modeCopy.modeDescription}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-[#45464d] font-medium">
                  {profileMode === 'negocio' ? 'Nome do Negócio ou Perfil:' : 'Nome do Perfil Familiar:'}
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#45464d] font-medium">
                    Região de Referência:
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                  >
                    {REGION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#45464d] font-medium">
                    {modeCopy.membersLabel}:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={membersCount}
                    onChange={(e) => setMembersCount(parseInt(e.target.value, 10) || 1)}
                    className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#45464d] font-medium">
                    Alerta de aumento (%):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(parseFloat(e.target.value) || 10)}
                    className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                  />
                </div>
              </div>

              {profileFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono border ${
                    profileFeedback.type === 'error'
                      ? 'bg-[#ffdad6]/50 border-[#ba1a1a]/30 text-[#ba1a1a]'
                      : 'bg-[#86f2e4]/20 border-[#006a61]/30 text-[#005049]'
                  }`}
                >
                  {profileFeedback.text}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#eff4ff]">
                <span className="text-xs text-[#76777d] font-mono">
                  Moeda: Real Brasileiro (BRL / R$)
                </span>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="h-10 px-5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] disabled:opacity-60 text-xs font-mono font-semibold transition-all shadow-sm cursor-pointer"
                >
                  {isSavingProfile ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: IBGE Integration, Backup & LGPD Danger Zone */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Card: Integração SIDRA / IBGE */}
          <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#497cff]">
                  <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0b1c30]">
                    Integração Oficial com SIDRA / IBGE
                  </h3>
                  <p className="text-xs text-[#45464d]">
                    Séries históricas e taxas oficiais de inflação publicadas pelo IBGE.
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold shrink-0 ${ibgeBadgeConfig.bg}`}
              >
                <span className={`w-2 h-2 rounded-full ${ibgeBadgeConfig.dot}`} />
                {ibgeBadgeConfig.label}
              </span>
            </div>

            <div className="flex flex-col gap-2 text-xs text-[#45464d]">
              <div className="flex items-center justify-between py-1.5 border-b border-[#eff4ff]">
                <span className="text-[#76777d]">Fonte Oficial:</span>
                <span className="font-semibold text-[#0b1c30]">
                  IBGE - Sistema SIDRA (Tabelas {ibgeData?.tableCode || '1737'} e 7060)
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#eff4ff]">
                <span className="text-[#76777d]">Período Mais Recente:</span>
                <span className="font-mono text-[#0b1c30]">
                  {ibgeData?.latestMonthLabel || '—'}{' '}
                  {ibgeData
                    ? `(Mês: ${formatSignedRate(ibgeData.latestMonthlyRate)} | 12M: ${formatSignedRate(
                        ibgeData.accumulated12MRate
                      )})`
                    : ''}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#eff4ff]">
                <span className="text-[#76777d]">Última Consulta:</span>
                <span className="font-mono text-[#0b1c30]">
                  {ibgeData?.consultedAt
                    ? formatIsoDateBR(ibgeData.consultedAt)
                    : 'Sincronização automática'}
                </span>
              </div>
            </div>

            {ibgeData && ibgeData.sourceMode !== 'live' && (
              <div className="p-3 bg-[#fef3c7]/60 rounded-lg text-xs font-mono text-[#92400e] border border-[#f59e0b]/30">
                {ibgeData.sourceMode === 'cached_live'
                  ? `Exibindo último retorno válido em cache${
                      ibgeData.cachedFromAt ? ` (${formatIsoDateBR(ibgeData.cachedFromAt)})` : ''
                    } enquanto a API SIDRA se estabiliza.`
                  : 'API SIDRA indisponível temporariamente. Utilizando base de referência offline auditada.'}
              </div>
            )}

            {syncMessage && (
              <div className="p-3 bg-[#eff4ff] rounded-lg text-xs font-mono text-[#0b1c30] border border-[#e5eeff]">
                {syncMessage}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#eff4ff]">
              <span className="text-xs text-[#76777d]">
                Cache automático com expiração horária
              </span>
              <button
                type="button"
                onClick={handleForceSyncIBGE}
                disabled={isSyncingIBGE}
                className="h-9 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] font-mono text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-[16px] ${isSyncingIBGE ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>{isSyncingIBGE ? 'Consultando SIDRA...' : 'Sincronizar com IBGE Agora'}</span>
              </button>
            </div>
          </div>

          {/* Card: Gestão de Backup e Privacidade */}
          <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#eff4ff]">
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#7c839b]">
                <span className="material-symbols-outlined text-[20px]">security</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Privacidade, Segurança & Backup
                </h3>
                <p className="text-xs text-[#45464d]">
                  Seus dados financeiros permanecem sob seu controle absoluto.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#45464d] leading-relaxed">
              O IPCA-Casa realiza a persistência e isolamento dos seus dados por usuário. Nenhum dado salarial ou de compras é compartilhado com terceiros.
            </p>

            {currentUser && (
              <div className="p-3 bg-[#eff4ff] rounded-xl border border-[#e5eeff] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={`Foto de perfil de ${currentUser.displayName}`}
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-[#ffffff] shrink-0"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[20px] text-[#006a61] shrink-0">
                      verified_user
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0b1c30] truncate">
                      {currentUser.authProvider === 'google'
                        ? isFirebaseMode
                          ? 'Conta Google sincronizada (Firebase + Firestore)'
                          : 'Conta conectada via Google'
                        : 'Conta com E-mail e Senha'}
                    </div>
                    <div className="text-[11px] font-mono text-[#45464d] truncate">
                      {currentUser.email}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#86f2e4]/30 text-[#006a61] font-mono text-[10px] font-bold shrink-0">
                  Ativa
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#eff4ff]">
              <span className="text-xs font-mono text-[#76777d]">Backup em formato aberto JSON</span>
              <button
                type="button"
                onClick={handleExportFullBackup}
                className="h-9 px-4 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Baixar Backup Completo</span>
              </button>
            </div>
          </div>

          {/* Card: Exclusão LGPD / Limpeza Completa */}
          {onWipeAllUserData && (
            <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#ffdad6] flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#ffdad6]/50 flex items-center justify-center text-[#ba1a1a] shrink-0">
                  <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0b1c30]">
                    {isFirebaseMode
                      ? 'Zona de Privacidade (Exclusão LGPD)'
                      : 'Reiniciar Dados Locais de Demonstração'}
                  </h3>
                  <p className="text-xs text-[#45464d]">
                    {isFirebaseMode
                      ? 'Apaga definitivamente todos os itens, preços, rendas, estratégias e perfis salvos na nuvem.'
                      : 'Restaura o estado inicial padrão do ambiente de demonstração no navegador.'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-[#eff4ff]">
                <button
                  type="button"
                  disabled={isWiping}
                  onClick={() => setIsWipeConfirmOpen(true)}
                  className="h-9 px-4 rounded-lg bg-[#ffdad6]/60 hover:bg-[#ffdad6] text-[#ba1a1a] font-mono text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isWiping
                    ? 'Processando...'
                    : isFirebaseMode
                    ? 'Apagar Todos os Meus Dados'
                    : 'Restaurar Padrão Inicial'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmação de Exclusão de Perfil */}
      <ConfirmModal
        isOpen={Boolean(profilePendingDelete)}
        title="Excluir Perfil Familiar"
        message={
          profilePendingDelete
            ? `Tem certeza que deseja excluir o perfil "${profilePendingDelete.name}" e todos os itens, rendas e estratégias vinculados a ele?`
            : ''
        }
        confirmLabel="Excluir Perfil"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDeleteProfile}
        onCancel={() => setProfilePendingDelete(null)}
      />

      {/* Confirmação de Exclusão Total LGPD */}
      <ConfirmModal
        isOpen={isWipeConfirmOpen}
        title={isFirebaseMode ? 'Apagar Todos os Dados da Conta' : 'Restaurar Padrão Inicial'}
        message={
          isFirebaseMode
            ? 'Esta ação removerá permanentemente todos os seus itens, históricos de preços, registros de renda e estratégias do Firestore. Deseja prosseguir?'
            : 'Deseja restaurar os dados locais de demonstração para o estado inicial?'
        }
        confirmLabel={isFirebaseMode ? 'Sim, Apagar Tudo' : 'Restaurar'}
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmWipeAll}
        onCancel={() => setIsWipeConfirmOpen(false)}
      />
    </div>
  );
};

