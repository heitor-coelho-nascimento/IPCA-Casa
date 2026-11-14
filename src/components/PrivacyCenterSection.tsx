import React, { useState } from 'react';
import { ART_18_RIGHTS, PRIVACY_CONFIG, TERMS_VERSION, POLICY_VERSION } from '../config/privacy';
import {
  reauthenticateCurrentUserWithGoogle,
  reauthenticateCurrentUserWithPassword,
} from '../lib/firebaseAuthOnly';
import { openCookiePreferencesModal } from '../services/consent';
import { trackExportData } from '../services/analytics';
import {
  ConsentRecord,
  PrivacyRequestRecord,
  PrivacyRightType,
  TermsAcceptanceRecord,
  UserAccount,
  UserPrivacyExportBundle,
} from '../types';
import { formatIsoDateBR, getTodayIsoDate } from '../utils/dates';

interface PrivacyCenterSectionProps {
  currentUser: UserAccount | null;
  isDemo: boolean;
  isFirebaseMode: boolean;
  counts: {
    profiles: number;
    items: number;
    prices: number;
    incomes: number;
    strategies: number;
    closures: number;
  };
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
  onWipeFinancialDataOnly?: () => Promise<void>;
  onAccountDeleted: () => void;
  onOpenPrivacyPolicy?: () => void;
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

export const PrivacyCenterSection: React.FC<PrivacyCenterSectionProps> = ({
  currentUser,
  isDemo,
  isFirebaseMode,
  counts,
  onNotify,
  onWipeFinancialDataOnly,
  onAccountDeleted,
  onOpenPrivacyPolicy,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [termsAcceptances, setTermsAcceptances] = useState<TermsAcceptanceRecord[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequestRecord[]>([]);

  // Solicitação Art. 18
  const [requestType, setRequestType] = useState<PrivacyRightType>('confirmacao_acesso');
  const [requestDetails, setRequestDetails] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Exportações
  const [exportingType, setExportingType] = useState<'json' | 'csv' | null>(null);

  // Exclusão completa de conta
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTypedConfirm, setDeleteTypedConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const loadPrivacyHistory = async () => {
    if (!currentUser || !isFirebaseMode) return;
    setLoadingRecords(true);
    try {
      const { FirestoreService } = await import('../services/firestore');
      const [consents, terms, reqs] = await Promise.all([
        FirestoreService.listConsentRecords(currentUser.id),
        FirestoreService.listTermsAcceptances(currentUser.id),
        FirestoreService.listPrivacyRequests(currentUser.id),
      ]);
      setConsentRecords(consents);
      setTermsAcceptances(terms);
      setPrivacyRequests(reqs);
    } catch {
      onNotify?.('error', 'Não foi possível carregar o histórico de privacidade no Firestore.');
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleToggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && currentUser && isFirebaseMode) {
      void loadPrivacyHistory();
    }
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportJsonBundle = async () => {
    if (!currentUser || !isFirebaseMode) {
      onNotify?.('info', 'A exportação completa de conta está disponível para contas autenticadas.');
      return;
    }
    setExportingType('json');
    try {
      const { FirestoreService } = await import('../services/firestore');
      const bundle: UserPrivacyExportBundle = await FirestoreService.exportAllUserDataBundle(
        currentUser.id,
        currentUser
      );
      triggerDownload(
        JSON.stringify(bundle, null, 2),
        `ipca_casa_meus_dados_lgpd_${getTodayIsoDate()}.json`,
        'application/json;charset=utf-8'
      );
      trackExportData('json');
      onNotify?.('success', 'Pacote completo LGPD exportado em JSON estruturado.');
    } catch {
      onNotify?.('error', 'Falha ao exportar seus dados completos do Cloud Firestore.');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportCsvSummary = async () => {
    if (!currentUser || !isFirebaseMode) {
      onNotify?.('info', 'A exportação consolidada está disponível para contas autenticadas.');
      return;
    }
    setExportingType('csv');
    try {
      const { FirestoreService } = await import('../services/firestore');
      const bundle = await FirestoreService.exportAllUserDataBundle(currentUser.id, currentUser);
      const rows: string[] = [
        ['Secao', 'ID', 'Nome/Tipo', 'Detalhe', 'Valor/Status', 'Data'].map(escapeCsvCell).join(';'),
        [
          'Conta',
          bundle.account.userId,
          bundle.account.displayName,
          bundle.account.email,
          bundle.account.authProvider || '',
          bundle.account.createdAt || '',
        ]
          .map(escapeCsvCell)
          .join(';'),
      ];

      for (const p of bundle.profiles) {
        rows.push(['Perfil', p.id, p.name, p.referenceRegion, `${p.membersCount} integrantes`, p.updatedAt].map(escapeCsvCell).join(';'));
      }
      for (const item of bundle.basketItems) {
        rows.push(['Item Cesta', item.id, item.name, item.group, `R$ ${item.monthlySpend}`, item.currentPriceDate].map(escapeCsvCell).join(';'));
      }
      for (const inc of bundle.incomeHistory) {
        rows.push(['Renda', inc.id, inc.source || 'Renda', inc.profileId, `R$ ${inc.nominalIncome}`, inc.referenceDate].map(escapeCsvCell).join(';'));
      }
      for (const term of bundle.termsAcceptances) {
        rows.push(['Aceite Termos', term.id, term.termsVersion, term.acceptanceMethod, 'Aceito', term.acceptedAt].map(escapeCsvCell).join(';'));
      }
      for (const req of bundle.privacyRequests) {
        rows.push(['Solicitacao LGPD', req.id, req.requestType, req.details, req.status, req.requestedAt].map(escapeCsvCell).join(';'));
      }

      triggerDownload(
        `\uFEFF${rows.join('\n')}`,
        `ipca_casa_meus_dados_lgpd_${getTodayIsoDate()}.csv`,
        'text/csv;charset=utf-8'
      );
      trackExportData('csv');
      onNotify?.('success', 'Relatório consolidado LGPD exportado em CSV seguro.');
    } catch {
      onNotify?.('error', 'Não foi possível gerar a exportação CSV dos seus dados.');
    } finally {
      setExportingType(null);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isFirebaseMode) return;
    const cleanDetails = requestDetails.trim();
    if (cleanDetails.length < 5) {
      onNotify?.('error', 'Descreva sua solicitação com pelo menos 5 caracteres.');
      return;
    }

    setSubmittingRequest(true);
    try {
      const { FirestoreService } = await import('../services/firestore');
      const created = await FirestoreService.createPrivacyRequest(currentUser.id, {
        requestType,
        details: cleanDetails,
      });
      if (created) {
        setPrivacyRequests((prev) => [created, ...prev]);
        setRequestDetails('');
        onNotify?.('success', 'Solicitação formal LGPD registrada no seu histórico.');
      }
    } catch {
      onNotify?.('error', 'Não foi possível registrar a solicitação LGPD.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    if (!currentUser || !isFirebaseMode) return;
    try {
      const { FirestoreService } = await import('../services/firestore');
      await FirestoreService.cancelPrivacyRequest(currentUser.id, reqId);
      setPrivacyRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: 'cancelada' } : r))
      );
      onNotify?.('info', 'Solicitação marcada como cancelada.');
    } catch {
      onNotify?.('error', 'Não foi possível cancelar esta solicitação.');
    }
  };

  const executeAccountDeletion = async (mode: 'password' | 'google') => {
    setDeleteError(null);
    if (deleteTypedConfirm.trim().toUpperCase() !== 'EXCLUIR') {
      setDeleteError('Digite exatamente EXCLUIR no campo de confirmação para prosseguir.');
      return;
    }

    if (mode === 'password' && !deletePassword) {
      setDeleteError('Informe sua senha atual para reautenticação obrigatória de segurança.');
      return;
    }

    setDeletingAccount(true);
    try {
      const freshToken =
        mode === 'google'
          ? await reauthenticateCurrentUserWithGoogle()
          : await reauthenticateCurrentUserWithPassword(deletePassword);

      const response = await fetch('/api/privacy/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ confirmDeletion: true }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        setDeleteError(
          payload.error ||
            'Não foi possível concluir a exclusão da conta no servidor. Nenhuma confirmação falsa foi emitida.'
        );
        return;
      }

      const { purgeAllBrowserAccountCaches } = await import('../services/retention');
      const { AuthService } = await import('../services/auth');
      await AuthService.logout();
      purgeAllBrowserAccountCaches();

      setDeletePassword('');
      setDeleteModalOpen(false);
      onAccountDeleted();
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('auth/')
          ? 'Falha na reautenticação: verifique sua senha ou janela Google e tente novamente.'
          : err instanceof Error
          ? err.message
          : 'Erro inesperado ao excluir sua conta.';
      setDeleteError(msg);
    } finally {
      setDeletingAccount(false);
    }
  };

  const isGoogleAccount = currentUser?.authProvider === 'google';

  return (
    <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#eff4ff]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#006a61] shrink-0">
            <span className="material-symbols-outlined text-[20px]">privacy_tip</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Meus Dados e Privacidade (LGPD)
            </h3>
            <p className="text-xs text-[#45464d]">
              Transparência, portabilidade estruturada, preferências de cookies, solicitações do art. 18 e exclusão definitiva da conta.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleExpand}
          className="h-9 px-3.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0b1c30] font-mono text-xs font-semibold cursor-pointer self-start sm:self-auto"
        >
          {expanded ? 'Recolher Central LGPD' : 'Abrir Central de Privacidade'}
        </button>
      </div>

      {/* Resumo sempre visível */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#eff4ff]">
          <span className="font-mono text-[10px] text-[#76777d] block">Perfis / Itens</span>
          <strong className="text-[#0b1c30] font-mono">
            {counts.profiles} / {counts.items}
          </strong>
        </div>
        <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#eff4ff]">
          <span className="font-mono text-[10px] text-[#76777d] block">Preços / Rendas</span>
          <strong className="text-[#0b1c30] font-mono">
            {counts.prices} / {counts.incomes}
          </strong>
        </div>
        <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#eff4ff]">
          <span className="font-mono text-[10px] text-[#76777d] block">Planos / Fechamentos</span>
          <strong className="text-[#0b1c30] font-mono">
            {counts.strategies} / {counts.closures}
          </strong>
        </div>
        <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#eff4ff]">
          <span className="font-mono text-[10px] text-[#76777d] block">Versão Política / Termos</span>
          <strong className="text-[#006a61] font-mono text-[11px]">{POLICY_VERSION}</strong>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openCookiePreferencesModal}
          className="h-9 px-3.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0b1c30] font-mono text-xs font-semibold cursor-pointer"
        >
          Preferências de Cookies
        </button>
        {onOpenPrivacyPolicy && (
          <button
            type="button"
            onClick={onOpenPrivacyPolicy}
            className="h-9 px-3.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0b1c30] font-mono text-xs font-semibold cursor-pointer"
          >
            Ver Política Completa
          </button>
        )}
        {isFirebaseMode && currentUser && (
          <>
            <button
              type="button"
              disabled={exportingType !== null}
              onClick={handleExportJsonBundle}
              className="h-9 px-3.5 rounded-lg bg-[#000000] hover:bg-[#213145] text-[#ffffff] font-mono text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {exportingType === 'json' ? 'Gerando JSON...' : 'Exportar Meus Dados (JSON)'}
            </button>
            <button
              type="button"
              disabled={exportingType !== null}
              onClick={handleExportCsvSummary}
              className="h-9 px-3.5 rounded-lg border border-[#c6c6cd] bg-[#ffffff] hover:bg-[#eff4ff] text-[#0b1c30] font-mono text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {exportingType === 'csv' ? 'Gerando CSV...' : 'Exportar Planilha (CSV)'}
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col gap-5 pt-4 border-t border-[#eff4ff]">
          {isDemo || !isFirebaseMode || !currentUser ? (
            <div className="p-4 rounded-xl bg-[#eff4ff]/60 border border-[#dce9ff] text-xs text-[#45464d] leading-relaxed">
              Você está utilizando o <strong>Modo Demonstração local</strong>. Nenhum dado pessoal ou financeiro deste ambiente é enviado ao Cloud Firestore. Para gerenciar solicitações formais do art. 18 da LGPD e exclusão de conta em nuvem, entre com uma conta verificada.
            </div>
          ) : (
            <>
              {/* Identidade, Controlador e Evidências */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#eff4ff] flex flex-col gap-1.5">
                  <strong className="text-[#0b1c30]">Evidências de Aceite e Consentimento</strong>
                  <span className="text-[#45464d]">
                    Termos aceitos (versão {TERMS_VERSION}):{' '}
                    <strong className="font-mono text-[#006a61]">
                      {loadingRecords ? 'Carregando...' : `${termsAcceptances.length} registro(s)`}
                    </strong>
                  </span>
                  <span className="text-[#45464d]">
                    Registros de consentimento de cookies:{' '}
                    <strong className="font-mono text-[#0b1c30]">
                      {loadingRecords ? 'Carregando...' : `${consentRecords.length} registro(s)`}
                    </strong>
                  </span>
                  {termsAcceptances[0] && (
                    <span className="text-[11px] font-mono text-[#76777d]">
                      Último aceite: {formatIsoDateBR(termsAcceptances[0].acceptedAt)} ({termsAcceptances[0].acceptanceMethod})
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#eff4ff] flex flex-col gap-1.5">
                  <strong className="text-[#0b1c30]">Controlador e Canal de Privacidade</strong>
                  <span className="text-[#45464d]">Controlador: {PRIVACY_CONFIG.controllerName}</span>
                  <span className="text-[#45464d]">Contato LGPD: {PRIVACY_CONFIG.privacyEmail}</span>
                  <span className="text-[11px] font-mono text-[#76777d]">
                    Encarregado (DPO): {PRIVACY_CONFIG.dpoName}
                  </span>
                </div>
              </div>

              {/* Solicitação de Direitos do Art. 18 */}
              <form
                onSubmit={handleCreateRequest}
                className="p-4 rounded-xl bg-[#f8f9ff] border border-[#dce9ff] flex flex-col gap-3"
              >
                <div>
                  <h4 className="text-xs font-bold text-[#0b1c30]">
                    Registrar Solicitação Formal de Direitos do Titular (Art. 18 LGPD)
                  </h4>
                  <p className="text-[11px] text-[#45464d] mt-0.5">
                    Registre pedidos formais de confirmação, correção, revisão ou informação diretamente na sua conta.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value as PrivacyRightType)}
                    className="h-9 px-3 rounded-lg bg-[#ffffff] border border-[#c6c6cd] text-xs text-[#0b1c30]"
                  >
                    {ART_18_RIGHTS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    minLength={5}
                    maxLength={1000}
                    value={requestDetails}
                    onChange={(e) => setRequestDetails(e.target.value)}
                    placeholder="Descreva sua solicitação (sem senhas ou dados bancários)..."
                    className="h-9 px-3 rounded-lg bg-[#ffffff] border border-[#c6c6cd] text-xs text-[#0b1c30] sm:col-span-2"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="h-8 px-4 rounded-lg bg-[#006a61] text-[#ffffff] hover:bg-[#005049] font-mono text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {submittingRequest ? 'Registrando...' : 'Registrar Solicitação LGPD'}
                  </button>
                </div>

                {privacyRequests.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#eff4ff]">
                    <span className="text-[11px] font-mono font-semibold text-[#45464d]">
                      Solicitações Registradas ({privacyRequests.length})
                    </span>
                    {privacyRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-2.5 rounded-lg bg-[#ffffff] border border-[#eff4ff] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-[#0b1c30]">{req.requestType}</strong>
                            <span className="px-2 py-0.5 rounded bg-[#eff4ff] font-mono text-[10px] text-[#006a61]">
                              {req.status}
                            </span>
                            <span className="font-mono text-[10px] text-[#76777d]">
                              {formatIsoDateBR(req.requestedAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#45464d] truncate mt-0.5">{req.details}</p>
                        </div>
                        {(req.status === 'registrada' || req.status === 'em_analise') && (
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(req.id)}
                            className="px-2.5 py-1 rounded bg-[#eff4ff] hover:bg-[#ffdad6] text-[#ba1a1a] font-mono text-[10px] font-semibold shrink-0 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </form>

              {/* Zona de Exclusão: Dados Financeiros vs Conta Permanente */}
              <div className="p-4 rounded-xl bg-[#ffdad6]/20 border border-[#ffdad6] flex flex-col gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#ba1a1a]">
                    Exclusão Permanente da Conta e Encerramento Integral (Art. 18, VI LGPD)
                  </h4>
                  <p className="text-[11px] text-[#45464d] mt-1 leading-relaxed">
                    Remove em cascata todos os perfis, cesta, preços, rendimentos, estratégias, fechamentos, registros de consentimento, termos e sua conta de acesso no Firebase Authentication. Esta ação é irreversível.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {onWipeFinancialDataOnly && (
                    <button
                      type="button"
                      onClick={() => void onWipeFinancialDataOnly()}
                      className="h-9 px-3.5 rounded-lg border border-[#c6c6cd] bg-[#ffffff] hover:bg-[#eff4ff] text-[#0b1c30] font-mono text-xs font-semibold cursor-pointer"
                    >
                      Apagar Apenas Dados Financeiros (Manter Conta)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTypedConfirm('');
                      setDeletePassword('');
                      setDeleteModalOpen(true);
                    }}
                    className="h-9 px-4 rounded-lg bg-[#ba1a1a] hover:bg-[#93000a] text-[#ffffff] font-mono text-xs font-semibold cursor-pointer"
                  >
                    Excluir Minha Conta Permanentemente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {deleteModalOpen && currentUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-modal-title"
          className="fixed inset-0 bg-[#213145]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-[#ffffff] rounded-2xl max-w-md w-full shadow-2xl p-6 flex flex-col gap-4 border border-[#ffdad6]">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#eff4ff]">
              <div>
                <h3 id="delete-account-modal-title" className="text-base font-bold text-[#ba1a1a]">
                  Confirmar Exclusão Permanente da Conta
                </h3>
                <p className="text-xs text-[#45464d] mt-1">
                  Por segurança, exigimos reautenticação recente e confirmação explícita antes de apagar todos os dados no Firestore e no Firebase Auth.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-[#ffdad6]/50 border border-[#ba1a1a]/30 text-xs font-mono text-[#ba1a1a]">
                {deleteError}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">
                Digite <strong>EXCLUIR</strong> para confirmar:
              </label>
              <input
                type="text"
                value={deleteTypedConfirm}
                onChange={(e) => setDeleteTypedConfirm(e.target.value)}
                placeholder="EXCLUIR"
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30]"
              />
            </div>

            {!isGoogleAccount && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-[#45464d]">
                  Confirme sua senha atual ({currentUser.email}):
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30]"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#eff4ff]">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setDeleteModalOpen(false)}
                className="h-9 px-4 rounded-lg bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => void executeAccountDeletion(isGoogleAccount ? 'google' : 'password')}
                className="h-9 px-4 rounded-lg bg-[#ba1a1a] hover:bg-[#93000a] text-[#ffffff] font-mono text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {deletingAccount
                  ? 'Excluindo conta e dados...'
                  : isGoogleAccount
                  ? 'Reautenticar com Google e Excluir'
                  : 'Reautenticar e Excluir Conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
