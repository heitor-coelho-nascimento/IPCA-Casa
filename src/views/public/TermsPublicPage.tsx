import React from 'react';
import { PRIVACY_CONFIG, TERMS_VERSION } from '../../config/privacy';

interface TermsPublicPageProps {
  onNavigate: (path: string) => void;
}

export const TermsPublicPage: React.FC<TermsPublicPageProps> = ({ onNavigate }) => {
  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <main className="max-w-[1040px] mx-auto w-full px-6 lg:px-12 py-12 flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-[#76777d]">
        <a href="/" onClick={(e) => handleLink(e, '/')} className="hover:text-[#0b1c30] underline">
          Início
        </a>
        <span>/</span>
        <span className="text-[#0b1c30] font-semibold">Termos de Uso</span>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider font-bold text-[#006a61]">
            Condições Gerais de Uso • Versão {TERMS_VERSION}
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0b1c30] tracking-tight">
          Termos de Uso do IPCA-Casa
        </h1>
        <p className="text-base text-[#45464d] leading-relaxed">
          Estes Termos de Uso regulam o acesso e a utilização das páginas públicas, simuladores e painel autenticado do IPCA-Casa.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">1. Finalidade e Escopo do Serviço</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            O IPCA-Casa é uma aplicação de planejamento financeiro pessoal e educacional voltada ao acompanhamento da inflação doméstica percebida (Índice de Laspeyres) em comparação com os índices oficiais publicados pelo IBGE (SIDRA Tabelas 1737 e 7060). O sistema não presta consultoria de investimentos, contábil, jurídica ou fiscal.
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">2. Elegibilidade, Cadastro e Verificação</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            O acesso às páginas públicas e ao modo demonstração (<code className="font-mono">/demo</code>) dispensa cadastro. Para criar uma conta persistente em nuvem, o usuário deve ter capacidade civil ou autorização legal, fornecer e-mail válido e concluir a verificação de e-mail exigida pelo Firebase Authentication, aceitando estes Termos e a{' '}
            <a href="/privacidade" onClick={(e) => handleLink(e, '/privacidade')} className="text-[#006a61] underline font-semibold">
              Política de Privacidade
            </a>.
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">3. Responsabilidade pelos Dados Inseridos</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Os cálculos do painel dependem diretamente dos preços, quantidades e rendimentos registrados pelo usuário. O titular compromete-se a manter suas credenciais seguras, a não tentar contornar controles de isolamento de segurança e a não inserir dados ilícitos ou de terceiros sem autorização.
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">4. Dados Oficiais do IBGE e Limitações</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            As séries históricas oficiais são obtidas diretamente da API pública do IBGE (SIDRA). Em caso de indisponibilidade externa, o aplicativo sinaliza claramente uso de cache ou base de contingência com data de referência, sem apresentar dados fictícios como oficiais. Os valores do modo demonstração têm caráter exclusivamente ilustrativo.
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">5. Encerramento de Conta e Portabilidade</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            O usuário pode exportar todos os seus registros a qualquer momento em JSON ou CSV e solicitar a exclusão apenas de dados financeiros ou a exclusão permanente completa de sua conta e coleções no painel em <strong className="text-[#0b1c30]">Configurações → Meus Dados e Privacidade</strong>.
          </p>
        </article>

        <article className="bg-[#ffffff] p-6 rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">6. Identificação do Responsável e Alterações</h2>
          <p className="text-sm text-[#45464d] leading-relaxed">
            Controlador responsável: <strong className="text-[#0b1c30]">{PRIVACY_CONFIG.controllerName}</strong> ({PRIVACY_CONFIG.controllerDocument}). Contato de privacidade: <strong className="text-[#0b1c30]">{PRIVACY_CONFIG.privacyEmail}</strong>. Atualizações relevantes destes Termos passam a registrar nova versão e exigem ciência do titular autenticado. Aplica-se a legislação brasileira, incluindo a LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014).
          </p>
        </article>
      </section>
    </main>
  );
};
