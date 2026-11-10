import React, { useEffect, useState } from 'react';
import { FamilyProfile, UserAccount } from '../types';
import { StorageService } from '../services/storage';
import { IBGEService } from '../services/ibge';
import { trackExportData } from '../services/analytics';

interface SettingsViewProps {
  activeProfile: FamilyProfile;
  onUpdateProfile: (profile: FamilyProfile) => void;
  onSwitchToEmptyBasket: () => void;
  onSwitchToDemoBasket: () => void;
  isDemo: boolean;
  onRefreshData: () => void;
  currentUser?: UserAccount | null;
  isFirebaseMode?: boolean;
  onExportBackupData?: () => unknown;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeProfile,
  onUpdateProfile,
  onSwitchToEmptyBasket,
  onSwitchToDemoBasket,
  isDemo,
  onRefreshData,
  currentUser = null,
  isFirebaseMode = false,
  onExportBackupData,
}) => {
  const [profileName, setProfileName] = useState(activeProfile.name);
  const [region, setRegion] = useState(activeProfile.referenceRegion);
  const [membersCount, setMembersCount] = useState(activeProfile.membersCount);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  // IBGE SIDRA sync state
  const [isSyncingIBGE, setIsSyncingIBGE] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<string>('Sincronizado automaticamente');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(activeProfile.name);
    setRegion(activeProfile.referenceRegion);
    setMembersCount(activeProfile.membersCount);
  }, [activeProfile.id, activeProfile.name, activeProfile.referenceRegion, activeProfile.membersCount]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: FamilyProfile = {
      ...activeProfile,
      name: profileName,
      referenceRegion: region,
      membersCount,
      updatedAt: new Date().toISOString(),
    };
    if (!isFirebaseMode) {
      StorageService.saveProfile(updated);
    }
    onUpdateProfile(updated);
    setProfileFeedback('Configurações do perfil familiar salvas com sucesso!');
  };

  const handleForceSyncIBGE = async () => {
    setIsSyncingIBGE(true);
    setSyncMessage(null);
    try {
      const metadata = await IBGEService.refresh();
      setLastSyncDate(new Date().toLocaleTimeString('pt-BR'));
      setSyncMessage(
        `Sincronização concluída! Dados atualizados para ${metadata.latestMonthLabel} (IPCA Mensal: +${metadata.latestMonthlyRate.toFixed(2)}%, 12 Meses: +${metadata.accumulated12MRate.toFixed(2)}%).`
      );
      onRefreshData();
    } catch {
      setSyncMessage('Falha na conexão direta com a API SIDRA do IBGE. Cache de contingência mantido.');
    } finally {
      setIsSyncingIBGE(false);
    }
  };

  const handleExportFullBackup = () => {
    const backup = onExportBackupData
      ? onExportBackupData()
      : {
          profile: StorageService.getProfile(),
          items: StorageService.getItems(),
          prices: StorageService.getAllPrices(),
          income: StorageService.getIncomeHistory(),
          plansA: StorageService.getPlansA(),
          plansB: StorageService.getPlansB(),
          planC: StorageService.getPlanC(),
          exportedAt: new Date().toISOString(),
          version: '3.0.0',
        };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ipca_casa_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    trackExportData('backup_json');
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
        <div className="flex items-center gap-4 text-xs font-mono text-[#45464d]">
          <span className="material-symbols-outlined text-[16px] text-[#006a61]">settings</span>
          <span>Versão: 3.0-funcional</span>
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
          Gerencie os dados cadastrais do seu domicílio, alterne entre a cesta de demonstração e a sua cesta pessoal, e acompanhe o sincronismo com o IBGE.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Basket Scenario Mode & Profile */}
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
                  Escolha entre explorar a cesta demonstrativa de exemplo ou iniciar com sua cesta personalizada.
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
                    Cesta pré-configurada com 42 itens monitorados (alimentação, energia, combustíveis, saúde, etc.). Ideal para testar gráficos, simulações e relatórios.
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

          {/* Card: Perfil Familiar */}
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
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-[#45464d] font-medium">
                  Nome do Perfil Familiar:
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#45464d] font-medium">
                    Região de Referência:
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                  >
                    <option value="Brasil">Brasil (Nacional)</option>
                    <option value="São Paulo - SP">São Paulo - SP</option>
                    <option value="Rio de Janeiro - RJ">Rio de Janeiro - RJ</option>
                    <option value="Belo Horizonte - MG">Belo Horizonte - MG</option>
                    <option value="Porto Alegre - RS">Porto Alegre - RS</option>
                    <option value="Curitiba - PR">Curitiba - PR</option>
                    <option value="Salvador - BA">Salvador - BA</option>
                    <option value="Recife - PE">Recife - PE</option>
                    <option value="Fortaleza - CE">Fortaleza - CE</option>
                    <option value="Brasília - DF">Brasília - DF</option>
                    <option value="Goiânia - GO">Goiânia - GO</option>
                    <option value="Belém - PA">Belém - PA</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#45464d] font-medium">
                    Integrantes da Família:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={membersCount}
                    onChange={(e) => setMembersCount(parseInt(e.target.value, 10) || 1)}
                    className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                  />
                </div>
              </div>

              {profileFeedback && (
                <div className="p-3 bg-[#86f2e4]/20 border border-[#006a61]/30 rounded-xl text-xs font-mono text-[#005049]">
                  {profileFeedback}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#eff4ff]">
                <span className="text-xs text-[#76777d] font-mono">
                  Moeda: Real Brasileiro (BRL / R$)
                </span>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all shadow-sm cursor-pointer"
                >
                  Salvar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: IBGE Integration & Backup */}
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
                    Séries históricas e taxas oficiais de inflação em tempo real.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#86f2e4]/30 text-[#006a61] font-mono text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-[#006a61]" />
                Conectado
              </span>
            </div>

            <div className="flex flex-col gap-2 text-xs text-[#45464d]">
              <div className="flex items-center justify-between py-1.5 border-b border-[#eff4ff]">
                <span className="text-[#76777d]">Fonte Oficial:</span>
                <span className="font-semibold text-[#0b1c30]">IBGE - Sistema SIDRA (Tabelas 1737 e 7060)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#eff4ff]">
                <span className="text-[#76777d]">Variáveis Consultadas:</span>
                <span className="font-mono text-[#0b1c30]">63 (Mensal), 69 (Ano), 2265 (12M), 66 (Pesos)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#eff4ff]">
                <span className="text-[#76777d]">Última Sincronização:</span>
                <span className="font-mono text-[#0b1c30]">{lastSyncDate}</span>
              </div>
            </div>

            {syncMessage && (
              <div className="p-3 bg-[#eff4ff] rounded-lg text-xs font-mono text-[#0b1c30] border border-[#e5eeff]">
                {syncMessage}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#eff4ff]">
              <span className="text-xs text-[#76777d]">
                Atualizações mensais oficiais automáticas
              </span>
              <button
                type="button"
                onClick={handleForceSyncIBGE}
                disabled={isSyncingIBGE}
                className="h-9 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] font-mono text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
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
                        : 'Conta com E-mail e Senha (Local)'}
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
        </div>
      </div>
    </div>
  );
};
