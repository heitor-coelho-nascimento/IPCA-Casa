/**
 * Módulo leve de autenticação Firebase (sem importar firebase/firestore),
 * permitindo carregamento tardio do SDK do Firestore apenas após sessão Google confirmada.
 */
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

export { isFirebaseConfigured };

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured()
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/userinfo.email');
  provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'A janela de login com o Google foi fechada antes da conclusão.';
    case 'auth/cancelled-popup-request':
      return 'Solicitação de login cancelada por uma nova tentativa em andamento.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.';
    case 'auth/unauthorized-domain':
      return 'Este domínio não está autorizado no Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'Erro de rede ao conectar com o Firebase/Google. Verifique sua conexão e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta cadastrada com este e-mail usando outro método de login.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Falha ao autenticar com o Google.';
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  if (!auth) {
    throw new Error('Firebase Authentication não está configurado neste ambiente.');
  }
  const provider = createGoogleProvider();
  const result = await signInWithPopup(auth, provider);
  if (!result.user) {
    throw new Error('Não foi possível obter os dados da sua conta Google.');
  }
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    // Ignora falhas silenciosas ao encerrar sessão Firebase
  }
}

export function subscribeFirebaseAuthState(
  callback: (user: User | null) => void
): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
