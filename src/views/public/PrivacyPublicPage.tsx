import React, { useState, useEffect } from 'react';
import {
  AnalyticsConsentState,
  getConsentStatus,
  isGaConfigured,
  setConsentStatus,
} from '../../services/analytics';

interface PrivacyPublicPageProps {
  onNavigate: (path: string) => void;
}

export const PrivacyPublicPage: React.FC<PrivacyPublicPageProps> = ({ onNavigate }) => {
  const [consent, setConsent] = useState<AnalyticsConsentState | null>(null);
  const gaConfigured = isGaConfigured();

  useEffect(() => {
    setConsent(getConsentStatus());
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
          Transparência, Segurança e Controle do Titular
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0b1c30] tracking-tight">
          Privacidade, Segurança e Proteção de Dados no IPCA-Casa
        </h1>
        <p className="text-base text-[#45464d] leading-relaxed">
          O IPCA-Casa foi projetado para que você analise sua inflação pessoal com isolamento total das informações do seu domicílio, sem expor dados bancários, CPF ou renda pessoal a terceiros.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">1. Isolamento Autenticado (Firebase + Firestore)</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Usuários autenticados com Google ou E-mail e Senha com verificação obrigatória têm sua cesta familiar, histórico de preços, rendimentos e estratégias armazenados no caminho privado da sua conta no Cloud Firestore, com isolamento por UID, segregação de metadados em <code className="font-mono">private/account</code> e opção de exclusão completa dos dados (LGPD).
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">2. Modo Demonstração e Portabilidade</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            A rota <code className="font-mono">/demo</code> opera exclusivamente no navegador com valores didáticos e ilustrativos para exploração sem cadastro. Registros pessoais reais nunca são misturados aos exemplos e podem ser exportados em CSV ou JSON estruturado a qualquer momento.
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">3. Firewall de Métricas e Zero PII</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Quando ativado, o Google Analytics 4 recebe apenas eventos categóricos de navegação e uso funcional (por exemplo, visualização de página pública, acesso à tela do IBGE ou formato de exportação). Valores de salário, gastos em Reais, nomes de itens, e-mails e UIDs são bloqueados antes de qualquer envio.
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">4. Dados Públicos vs. Área Privada</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Mecanismos de busca têm acesso apenas às páginas institucionais e educativas públicas (<code className="font-mono">/</code>, <code className="font-mono">/como-funciona</code>, <code className="font-mono">/metodologia</code>, <code className="font-mono">/ipca-oficial</code> e <code className="font-mono">/privacidade</code>). O painel pessoal (<code className="font-mono">/painel</code>) e telas de acesso possuem diretiva explícita <code className="font-mono">noindex, nofollow</code>.
          </p>
        </article>
      </section>

      {/* Controle de Consentimento de Analytics */}
      <section
        aria-labelledby="consentimento-titulo"
        className="bg-[#ffffff] p-6 lg:p-8 rounded-2xl border border-[#dce9ff] shadow-sm flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="consentimento-titulo" className="text-xl font-bold text-[#0b1c30]">
              Preferências de Métricas e Consentimento (GA4)
            </h2>
            <p className="text-xs text-[#45464d] mt-1">
              Escolha se deseja permitir a coleta anônima de métricas agregadas de navegação neste navegador.
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
              ? 'Permitido (Métricas Anônimas)'
              : consent === 'denied'
              ? 'Apenas Essenciais'
              : 'Não definido'}
          </span>
        </div>

        <p className="text-xs font-mono text-[#76777d]">
          {gaConfigured
            ? 'Propriedade Google Analytics 4 configurada no ambiente e sujeita ao seu consentimento.'
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
        </div>
      </section>
    </main>
  );
};
