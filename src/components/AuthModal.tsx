import React, { useEffect, useState } from 'react';
import { AuthService } from '../services/auth';
import { UserAccount } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'recover' | 'verify-email' | 'terms';
  initialError?: string | null;
  pendingVerificationEmail?: string | null;
  onClose: () => void;
  onSuccess: (user: UserAccount, isNewUser?: boolean) => void;
  onEnterDemo: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  initialError = null,
  pendingVerificationEmail = null,
  onClose,
  onSuccess,
  onEnterDemo,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'recover' | 'verify-email' | 'terms'>(
    initialMode
  );

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(pendingVerificationEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(initialError || null);
      setMessage(null);
      if (pendingVerificationEmail) {
        setEmail(pendingVerificationEmail);
      }
    }
  }, [isOpen, initialMode, initialError, pendingVerificationEmail]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setGoogleLoading(true);

    try {
      const { startGoogleOAuthPopup } = await import('../services/googleOAuth');
      const result = await startGoogleOAuthPopup();
      if (!result.success || !result.session) {
        setError(result.error || 'Falha ao entrar com Google.');
      } else {
        onSuccess(result.session.user, Boolean(result.isNewUser));
        onClose();
      }
    } catch {
      setError('Erro inesperado ao autenticar com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const result = await AuthService.login({ email, password });
      if (result.requiresEmailVerification) {
        if (result.pendingEmail) setEmail(result.pendingEmail);
        setMode('verify-email');
        setError(result.error || 'Confirme seu e-mail antes de acessar o painel.');
        return;
      }
      if (result.success && result.session) {
        setPassword('');
        onSuccess(result.session.user, Boolean(result.isNewUser));
        onClose();
        return;
      }
      setError(result.error || 'Falha ao autenticar.');
    } catch {
      setError('Erro ao processar autenticação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError('A confirmação da senha não coincide com a senha digitada.');
      return;
    }

    setLoading(true);
    try {
      const result = await AuthService.register({ email, displayName, password });
      if (!result.success) {
        setError(result.error || 'Falha ao cadastrar conta.');
        return;
      }

      if (result.requiresEmailVerification) {
        setPassword('');
        setConfirmPassword('');
        if (result.pendingEmail) setEmail(result.pendingEmail);
        setMode('verify-email');
        setMessage(
          result.verificationEmailSent
            ? `Conta criada no Firebase! Enviamos um link de verificação para ${result.pendingEmail || email}. Confirme seu e-mail antes de acessar o painel.`
            : 'Conta criada! Clique em "Reenviar E-mail de Verificação" caso a mensagem não tenha chegado.'
        );
        return;
      }

      if (result.session) {
        setPassword('');
        setConfirmPassword('');
        onSuccess(result.session.user, true);
        onClose();
      }
    } catch {
      setError('Erro ao registrar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const status = await AuthService.checkEmailVerifiedAndBootstrap();
      if (status.verified && status.user) {
        onSuccess(status.user, Boolean(status.isNewUser));
        onClose();
      } else {
        setError(status.error || 'Verificação ainda pendente.');
      }
    } catch {
      setError('Erro ao verificar confirmação de e-mail.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await AuthService.resendVerificationEmail();
      if (res.success) {
        setMessage(res.message);
      } else {
        setError(res.message);
      }
    } catch {
      setError('Não foi possível reenviar o e-mail de verificação.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchVerificationAccount = async () => {
    await AuthService.logout();
    setError(null);
    setMessage(null);
    setMode('login');
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const result = await AuthService.recoverPassword(email);
      if (result.success) {
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Falha ao solicitar redefinição de senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#213145]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#ffffff] rounded-2xl max-w-md w-full shadow-2xl p-6 flex flex-col gap-5 border border-[#eff4ff] max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#000000] text-[#ffffff] flex items-center justify-center font-bold text-sm shadow-sm">
              <span className="material-symbols-outlined text-[18px]">analytics</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0b1c30]">
                {mode === 'login' && 'Entrar na sua Conta'}
                {mode === 'register' && 'Criar Conta no IPCA-Casa'}
                {mode === 'recover' && 'Recuperar Senha'}
                {mode === 'verify-email' && 'Verificar Endereço de E-mail'}
                {mode === 'terms' && 'Termos & Privacidade'}
              </h2>
              <span className="text-[11px] font-mono text-[#76777d]">
                {mode === 'login' && 'Firebase Authentication • Dados em nuvem isolados'}
                {mode === 'register' && 'Conta protegida com verificação de e-mail'}
                {mode === 'recover' && 'Redefinição oficial via Firebase Authentication'}
                {mode === 'verify-email' && 'Proteção obrigatória para acesso ao Cloud Firestore'}
                {mode === 'terms' && 'Compromisso com privacidade e LGPD'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Fechar janela de autenticação"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="flex items-center p-1 bg-[#eff4ff] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'login' ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm' : 'text-[#45464d]'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'register' ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm' : 'text-[#45464d]'
              }`}
            >
              Criar Conta
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-xl text-xs font-mono text-[#ba1a1a] leading-relaxed">
            {error}
          </div>
        )}

        {message && (
          <div className="p-3 bg-[#86f2e4]/20 border border-[#006a61]/30 rounded-xl text-xs font-mono text-[#006a61] leading-relaxed">
            {message}
          </div>
        )}

        {(mode === 'login' || mode === 'register') && (
          <div className="flex flex-col gap-3">
            <GoogleSignInButton
              onClick={handleGoogleSignIn}
              loading={googleLoading}
              disabled={loading}
              label={mode === 'register' ? 'Cadastrar com Google (Nuvem)' : 'Continuar com Google (Nuvem)'}
              className="w-full"
            />
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#eff4ff]" />
              <span className="text-[11px] font-mono text-[#76777d]">
                ou acesse com e-mail e senha (Firebase)
              </span>
              <div className="flex-1 h-px bg-[#eff4ff]" />
            </div>
          </div>
        )}

        {/* Mode: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono text-[#45464d]">E-mail:</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-[#45464d]">Senha:</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('recover');
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-[11px] text-[#497cff] hover:underline cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="mt-2 h-10 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {loading ? 'Autenticando...' : 'Entrar no Sistema'}
            </button>
          </form>
        )}

        {/* Mode: REGISTER */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono text-[#45464d]">Seu Nome ou da Família:</label>
              <input
                type="text"
                required
                maxLength={120}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Família Costa ou João Paulo"
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono text-[#45464d]">E-mail:</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-[#45464d]">Senha:</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mín. 6 dígitos"
                  className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-[#45464d]">Confirmar Senha:</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
                />
              </div>
            </div>

            <p className="text-[11px] text-[#76777d] mt-1">
              Ao criar a conta, enviaremos um link de verificação para confirmar sua identidade antes de liberar o painel. Leia nossos{' '}
              <button
                type="button"
                onClick={() => setMode('terms')}
                className="text-[#0b1c30] underline font-medium cursor-pointer"
              >
                Termos de Uso e Privacidade
              </button>
              .
            </p>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="mt-1 h-10 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {loading ? 'Criando Conta...' : 'Criar Conta e Enviar Verificação'}
            </button>
          </form>
        )}

        {/* Mode: VERIFY EMAIL GATE */}
        {mode === 'verify-email' && (
          <div className="flex flex-col gap-3">
            <div className="p-4 bg-[#eff4ff] rounded-xl border border-[#dce9ff] text-xs text-[#0b1c30] flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-[#006a61]">
                <span className="material-symbols-outlined text-[18px]">mark_email_read</span>
                <span>Confirmação de Identidade Obrigatória</span>
              </div>
              <p className="leading-relaxed text-[#45464d]">
                Para proteger seus dados financeiros no Cloud Firestore, apenas contas com e-mail verificado podem gravar ou consultar informações pessoais. Verifique a caixa de entrada de{' '}
                <strong className="text-[#0b1c30]">{email || 'seu e-mail'}</strong>.
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleCheckVerification}
              className="h-10 rounded-lg bg-[#006a61] text-[#ffffff] hover:bg-[#005049] text-xs font-mono font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Validando no Firebase...' : 'Já confirmei meu e-mail — Entrar'}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleResendVerification}
              className="h-9 rounded-lg bg-[#eff4ff] text-[#0b1c30] hover:bg-[#dce9ff] text-xs font-mono font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              Reenviar E-mail de Verificação
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleSwitchVerificationAccount}
              className="text-xs text-[#45464d] hover:text-[#0b1c30] text-center mt-1 cursor-pointer"
            >
              Voltar e entrar com outra conta
            </button>
          </div>
        )}

        {/* Mode: RECOVER PASSWORD */}
        {mode === 'recover' && (
          <form onSubmit={handleRecover} className="flex flex-col gap-3">
            <p className="text-xs text-[#45464d] leading-relaxed">
              Informe seu e-mail cadastrado. O Firebase Authentication enviará um link oficial caso exista uma conta ativa para este endereço.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono text-[#45464d]">E-mail:</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-10 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Enviando solicitação...' : 'Enviar Link de Redefinição'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setMessage(null);
              }}
              className="text-xs text-[#45464d] hover:text-[#0b1c30] text-center mt-1 cursor-pointer"
            >
              Voltar ao Login
            </button>
          </form>
        )}

        {/* Mode: TERMS */}
        {mode === 'terms' && (
          <div className="flex flex-col gap-3 text-xs text-[#45464d] max-h-72 overflow-y-auto pr-1">
            <h3 className="font-bold text-[#0b1c30]">Política de Privacidade e Proteção de Dados</h3>
            <p>
              1. <strong>Privacidade do Orçamento:</strong> O IPCA-Casa foi desenvolvido com o compromisso de isolamento total das informações financeiras. Dados de rendimentos e despesas são armazenados em ambiente privado e não são comercializados ou compartilhados.
            </p>
            <p>
              2. <strong>Dados Oficiais:</strong> Os indicadores do IPCA são coletados diretamente da API pública do SIDRA/IBGE para fins de auditoria e cálculo do poder de compra real.
            </p>
            <p>
              3. <strong>Segurança de Acesso:</strong> Contas por E-mail/Senha e Google utilizam Firebase Authentication com verificação obrigatória de e-mail e isolamento estrito por usuário via Cloud Firestore Security Rules.
            </p>
            <button
              type="button"
              onClick={() => setMode('register')}
              className="mt-2 h-9 rounded-lg bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold hover:bg-[#e5eeff] cursor-pointer"
            >
              Voltar ao Cadastro
            </button>
          </div>
        )}

        <div className="pt-3 border-t border-[#eff4ff] flex items-center justify-between">
          <span className="text-xs text-[#76777d]">Quer apenas experimentar?</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onEnterDemo();
            }}
            className="text-xs font-semibold text-[#006a61] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Acessar Modo Demonstração</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
