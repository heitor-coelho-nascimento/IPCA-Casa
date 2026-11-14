import React, { useState, useEffect } from 'react';
import {
  ART_18_RIGHTS,
  DATA_INVENTORY,
  EXTERNAL_OPERATORS,
  POLICY_VERSION,
  PRIVACY_CONFIG,
  RETENTION_SCHEDULE,
} from '../../config/privacy';
import {
  AnalyticsConsentState,
  getConsentStatus,
  isGaConfigured,
  isMarketingAllowed,
  setConsentStatus,
} from '../../services/analytics';
import { CONSENT_CHANGED_EVENT, openCookiePreferencesModal } from '../../services/consent';

interface PrivacyPublicPageProps {
  onNavigate: (path: string) => void;
}

export const PrivacyPublicPage: React.FC<PrivacyPublicPageProps> = ({ onNavigate }) => {
  const [consent, setConsent] = useState<AnalyticsConsentState | null>(null);
  const [marketingAllowed, setMarketingAllowed] = useState(false);
  const gaConfigured = isGaConfigured();

  useEffect(() => {
    const syncState = () => {
      setConsent(getConsentStatus());
      setMarketingAllowed(isMarketingAllowed());
    };
    syncState();
    window.addEventListener(CONSENT_CHANGED_EVENT, syncState);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, syncState);
  }, []);

  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  const handleConsentChange = (nextStatus: AnalyticsConsentState) => {
    setConsentStatus(nextStatus);
    setConsent(nextStatus);
  };

  return (
    <main className="max-w-[1040px] mx-auto w-full px-6 lg:px-12 py-12 flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#76777d]">
        <a href="/" onClick={(e) => handleLink(e, '/')} className="hover:text-[#0b1c30] underline">
          Início
        </a>
        <span>/</span>
        <span className="text-[#0b1c30] font-semibold">Privacidade e Dados</span>
      </nav>

      <header className="flex flex-col gap-3">
        <span className="font-mono text-xs uppercase tracking-wider font-bold text-[#006a61]">
          LGPD (Lei nº 13.709/2018) • Política Versão {POLICY_VERSION}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0b1c30] tracking-tight">
          Política de Privacidade, Segurança e Proteção de Dados
        </h1>
        <p className="text-base text-[#45464d] leading-relaxed">
          O IPCA-Casa aplica o princípio de <strong>Privacy by Design e Privacy by Default</strong> para que você analise sua inflação pessoal com isolamento por usuário, minimização de dados, consentimento granular e exercício direto dos direitos previstos no art. 18 da LGPD.
        </p>
      </header>

      {/* 1. Identificação do Controlador, Encarregado e Canal */}
      <section
        id="contato-privacidade"
        aria-labelledby="controlador-titulo"
        className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-4"
      >
        <h2 id="controlador-titulo" className="text-lg font-bold text-[#0b1c30]">
          1. Identificação do Controlador e Canal de Privacidade
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#45464d]">
          <div className="p-3 rounded-xl bg-[#eff4ff]/50 border border-[#eff4ff]">
            <span className="font-mono text-[11px] text-[#76777d] block">Controlador / Responsável</span>
            <strong className="text-[#0b1c30]">{PRIVACY_CONFIG.controllerName}</strong>
            <span className="block text-[11px] font-mono text-[#45464d] mt-0.5">
              Documento: {PRIVACY_CONFIG.controllerDocument}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#eff4ff]/50 border border-[#eff4ff]">
            <span className="font-mono text-[11px] text-[#76777d] block">Canal de Atendimento sobre Privacidade</span>
            <strong className="text-[#0b1c30]">{PRIVACY_CONFIG.privacyEmail}</strong>
            <span className="block text-[11px] font-mono text-[#45464d] mt-0.5">
              Encarregado (DPO): {PRIVACY_CONFIG.dpoName}
            </span>
          </div>
        </div>
        <p className="text-xs text-[#45464d] leading-relaxed">
          Endereço de referência: <span className="font-mono">{PRIVACY_CONFIG.controllerAddress}</span>. {PRIVACY_CONFIG.dpoExemptionNote} Usuários autenticados também dispõem de abertura formal de solicitações diretamente no painel em <strong className="text-[#0b1c30]">Configurações → Meus Dados e Privacidade</strong>.
        </p>
      </section>

      {/* 2. Inventário, Finalidades e Bases Legais */}
      <section aria-labelledby="inventario-titulo" className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-4">
        <h2 id="inventario-titulo" className="text-lg font-bold text-[#0b1c30]">
          2. Dados Tratados, Finalidades e Bases Legais (Art. 7º e Art. 9º da LGPD)
        </h2>
        <p className="text-sm text-[#45464d] leading-relaxed">
          O IPCA-Casa <strong>não solicita</strong> CPF, RG, número de cartão, credenciais bancárias ou integração com Open Finance. São coletados apenas os dados necessários para autenticação e cálculos solicitados por você:
        </p>
        <div className="flex flex-col gap-3">
          {DATA_INVENTORY.map((item) => (
            <article key={item.id} className="p-4 rounded-xl bg-[#f8f9ff] border border-[#eff4ff] flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#0b1c30]">{item.category}</h3>
                <span className="text-[11px] font-mono text-[#006a61] bg-[#86f2e4]/25 px-2.5 py-0.5 rounded-full">
                  {item.legalBasis}
                </span>
              </div>
              <p className="text-xs text-[#45464d]">
                <strong className="text-[#0b1c30]">Campos:</strong> {item.fields.join(', ')}.
              </p>
              <p className="text-xs text-[#45464d]">
                <strong className="text-[#0b1c30]">Finalidade:</strong> {item.purpose}
              </p>
              <p className="text-[11px] font-mono text-[#76777d]">
                Armazenamento: {item.storageLocation} • Retenção: {item.retentionSummary}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* 3. Arquitetura de Segurança, Isolamento e Operadores */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">3. Isolamento Autenticado e Segurança</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Usuários autenticados com Google ou E-mail/Senha (com verificação obrigatória de e-mail) têm perfis, itens, preços, rendimentos, estratégias e aceites isolados por <code className="font-mono">request.auth.uid</code> no Cloud Firestore, com segregação de e-mail em <code className="font-mono">private/account</code>, cabeçalhos CSP/Helmet no servidor e bloqueio estrito de PII em métricas.
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">4. Modo Demonstração e Indexação</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            A rota <code className="font-mono">/demo</code> opera exclusivamente no navegador com valores didáticos que não se misturam a contas reais. Apenas páginas informativas (<code className="font-mono">/</code>, <code className="font-mono">/como-funciona</code>, <code className="font-mono">/metodologia</code>, <code className="font-mono">/ipca-oficial</code>, <code className="font-mono">/privacidade</code> e <code className="font-mono">/termos</code>) são indexáveis; áreas privadas possuem <code className="font-mono">noindex, nofollow</code>.
          </p>
        </article>
      </section>

      {/* 5. Compartilhamento, Operadores e Transferência Internacional */}
      <section aria-labelledby="operadores-titulo" className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-4">
        <h2 id="operadores-titulo" className="text-lg font-bold text-[#0b1c30]">
          5. Operadores de Infraestrutura e Transferência Internacional
        </h2>
        <p className="text-xs text-[#45464d]">
          O IPCA-Casa não vende nem comercializa dados pessoais. O processamento técnico ocorre apenas com os operadores abaixo, nos termos dos arts. 33 e 39 da LGPD:
        </p>
        <div className="flex flex-col gap-2.5">
          {EXTERNAL_OPERATORS.map((op) => (
            <div key={op.name} className="p-3.5 rounded-xl bg-[#f8f9ff] border border-[#eff4ff] text-xs text-[#45464d] flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[#0b1c30]">{op.name}</strong>
                <span className="font-mono text-[11px] text-[#76777d]">{op.role}</span>
              </div>
              <p>{op.purpose} Dados envolvidos: {op.dataShared}</p>
              <p className="text-[11px] font-mono text-[#76777d]">
                Transferência internacional: {op.internationalTransfer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Prazos de Retenção e Eliminação */}
      <section aria-labelledby="retencao-titulo" className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-4">
        <h2 id="retencao-titulo" className="text-lg font-bold text-[#0b1c30]">
          6. Retenção, Descarte e Exclusão de Conta (Arts. 15 e 16 da LGPD)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#eff4ff] text-[#76777d] font-mono">
                <th className="py-2 pr-4">Categoria</th>
                <th className="py-2 pr-4">Armazenamento Local</th>
                <th className="py-2 pr-4">Armazenamento em Nuvem</th>
                <th className="py-2">Critério de Eliminação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eff4ff] text-[#45464d]">
              {RETENTION_SCHEDULE.map((row) => (
                <tr key={row.dataType}>
                  <td className="py-2.5 pr-4 font-semibold text-[#0b1c30]">{row.dataType}</td>
                  <td className="py-2.5 pr-4">{row.localRetention}</td>
                  <td className="py-2.5 pr-4">{row.cloudRetention}</td>
                  <td className="py-2.5">{row.deletionTrigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Direitos dos Titulares */}
      <section aria-labelledby="direitos-titulo" className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-4">
        <h2 id="direitos-titulo" className="text-lg font-bold text-[#0b1c30]">
          7. Seus Direitos como Titular (Art. 18 da LGPD) e Crianças/Adolescentes
        </h2>
        <p className="text-xs text-[#45464d] leading-relaxed">
          O serviço destina-se ao planejamento financeiro de adultos responsáveis pelo domicílio ou pequeno negócio e não é direcionado a crianças ou adolescentes (art. 14 da LGPD). Você pode exercer a qualquer momento:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ART_18_RIGHTS.map((r) => (
            <div key={r.code} className="p-3.5 rounded-xl bg-[#f8f9ff] border border-[#eff4ff] text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <strong className="text-[#0b1c30]">{r.title}</strong>
                <span className="font-mono text-[10px] text-[#006a61]">{r.legalRef}</span>
              </div>
              <p className="text-[#45464d] leading-relaxed">{r.description}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#45464d]">
          Caso entenda que sua solicitação não foi atendida adequadamente, você também possui direito de peticionar perante a <strong>{PRIVACY_CONFIG.authorityReference}</strong>. Leia também os{' '}
          <a href="/termos" onClick={(e) => handleLink(e, '/termos')} className="text-[#006a61] underline font-semibold">
            Termos de Uso
          </a>.
        </p>
      </section>

      {/* 8. Controle Granular de Cookies e Consentimento */}
      <section
        aria-labelledby="consentimento-titulo"
        className="bg-[#ffffff] p-6 lg:p-8 rounded-2xl border border-[#dce9ff] shadow-sm flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="consentimento-titulo" className="text-xl font-bold text-[#0b1c30]">
              8. Preferências de Cookies, Métricas (GA4) e Revogação
            </h2>
            <p className="text-xs text-[#45464d] mt-1">
              Cookies essenciais mantêm segurança e sessão. Analytics e marketing permanecem desativados por padrão até sua autorização expressa.
            </p>
          </div>
          <span
            className={`self-start px-3 py-1 rounded-full text-xs font-mono font-bold ${
              consent === 'granted'
                ? 'bg-[#86f2e4]/30 text-[#006a61]'
                : 'bg-[#eff4ff] text-[#45464d]'
            }`}
          >
            Status atual:{' '}
            {consent === 'granted'
              ? `Analytics Permitido${marketingAllowed ? ' + Marketing' : ''}`
              : consent === 'denied'
              ? 'Apenas Essenciais'
              : 'Não definido (bloqueado por padrão)'}
          </span>
        </div>

        <p className="text-xs font-mono text-[#76777d]">
          {gaConfigured
            ? 'Propriedade Google Analytics 4 configurada no ambiente e sujeita ao seu consentimento granular.'
            : 'Nenhum ID do Google Analytics está ativo nesta implantação (nenhum evento externo é enviado no momento).'}
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleConsentChange('granted')}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-semibold transition-colors cursor-pointer ${
              consent === 'granted'
                ? 'bg-[#006a61] text-[#ffffff]'
                : 'bg-[#eff4ff] text-[#0b1c30] hover:bg-[#e5eeff]'
            }`}
          >
            Permitir métricas anônimas
          </button>
          <button
            type="button"
            onClick={() => handleConsentChange('denied')}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-semibold transition-colors cursor-pointer ${
              consent === 'denied'
                ? 'bg-[#131b2e] text-[#ffffff]'
                : 'bg-[#eff4ff] text-[#45464d] hover:bg-[#e5eeff]'
            }`}
          >
            Desativar métricas (Apenas essenciais)
          </button>
          <button
            type="button"
            onClick={openCookiePreferencesModal}
            className="px-4 py-2.5 rounded-xl text-xs font-mono font-semibold bg-[#eff4ff] text-[#0b1c30] hover:bg-[#dce9ff] transition-colors cursor-pointer"
          >
            Gerenciar preferências por categoria
          </button>
        </div>
      </section>
    </main>
  );
};
