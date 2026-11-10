import React from 'react';
import { AuthSession, UserAccount } from '../types';
import {
  isFirebaseGoogleAuthAvailable,
  mapFirebaseAuthError,
  signInWithGooglePopup,
} from '../lib/firebase';

export interface GoogleLoginResult {
  success: boolean;
  session?: AuthSession;
  isNewUser?: boolean;
  error?: string;
}

export async function startGoogleOAuthPopup(): Promise<GoogleLoginResult> {
  if (isFirebaseGoogleAuthAvailable()) {
    try {
      const { idToken } = await signInWithGooglePopup();
      const response = await fetch('/api/auth/google/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.session?.user) {
        return {
          success: false,
          error:
            data?.error ||
            'Não foi possível validar sua conta Google no servidor. Tente novamente.',
        };
      }

      return {
        success: true,
        session: data.session as AuthSession,
        isNewUser: Boolean(data.isNewUser),
      };
    } catch (err) {
      return {
        success: false,
        error: mapFirebaseAuthError(err),
      };
    }
  }

  try {
    const originParam = encodeURIComponent(window.location.origin);
    const response = await fetch(`/api/auth/google/url?origin=${originParam}`, {
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) {
      return {
        success: false,
        error:
          data.error ||
          'Login com Google não está disponível no momento. Verifique as credenciais OAuth no servidor.',
      };
    }

    const width = 520;
    const height = 640;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

    const popup = window.open(
      data.url,
      'ipca_casa_google_oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      return {
        success: false,
        error: 'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.',
      };
    }

    return await new Promise<GoogleLoginResult>((resolve) => {
      let settled = false;

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        window.clearInterval(pollTimer);
        window.clearTimeout(timeoutTimer);
      };

      const finish = (result: GoogleLoginResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const onMessage = (event: MessageEvent) => {
        const origin = event.origin || '';
        const isAllowedOrigin =
          origin === window.location.origin ||
          origin.endsWith('.run.app') ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1');

        if (!isAllowedOrigin) return;

        if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS' && event.data?.payload?.user) {
          const user = event.data.payload.user as UserAccount;
          const token = String(event.data.payload.token || '');
          const isNewUser = Boolean(event.data.payload.isNewUser);
          finish({
            success: true,
            session: { user, token },
            isNewUser,
          });
        } else if (event.data?.type === 'GOOGLE_OAUTH_ERROR') {
          finish({
            success: false,
            error: event.data.error || 'Falha ao autenticar com o Google.',
          });
        }
      };

      window.addEventListener('message', onMessage);

      const pollTimer = window.setInterval(() => {
        try {
          if (popup.closed) {
            // Pequeno atraso para dar chance ao postMessage chegar antes do fechamento
            window.setTimeout(() => {
              finish({
                success: false,
                error: 'A janela de autenticação com o Google foi fechada antes da conclusão.',
              });
            }, 350);
          }
        } catch {
          // Ignora bloqueios de leitura cross-origin caso ocorram
        }
      }, 400);

      const timeoutTimer = window.setTimeout(() => {
        finish({
          success: false,
          error: 'Tempo limite excedido ao aguardar resposta do Google.',
        });
      }, 180000);
    });
  } catch {
    return {
      success: false,
      error: 'Erro de conexão ao iniciar autenticação com o Google.',
    };
  }
}

interface GoogleSignInButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onClick,
  loading = false,
  label = 'Continuar com Google',
  className = '',
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`h-10 px-4 rounded-xl bg-[#ffffff] text-[#0b1c30] border border-[#c6c6cd] hover:bg-[#f8f9ff] hover:border-[#76777d] active:bg-[#eff4ff] text-xs font-semibold transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-[#c6c6cd] border-t-[#0b1c30] animate-spin shrink-0" />
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
          <path fill="none" d="M0 0h48v48H0z" />
        </svg>
      )}
      <span>{loading ? 'Conectando ao Google...' : label}</span>
    </button>
  );
};
