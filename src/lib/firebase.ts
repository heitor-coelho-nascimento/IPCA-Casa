/**
 * IPCA-Casa: Inicialização Client-Side do Firebase Auth exclusivamente para Login com Google.
 * A persistência de dados continua no repositório MySQL/local configurado no servidor.
 */
import { getApp, getApps, initializeApp, FirebaseApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function isFirebaseGoogleAuthAvailable(): boolean {
  return Boolean(
    firebaseConfig?.apiKey &&
      firebaseConfig?.projectId &&
      firebaseConfig?.authDomain &&
      firebaseConfig.projectId !== 'remixed-project-id'
  );
}

function getFirebaseAuthInstance(): Auth {
  if (!isFirebaseGoogleAuthAvailable()) {
    throw new Error('Autenticação Google não configurada neste ambiente.');
  }

  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }
  return cachedAuth;
}

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
      return 'Este domínio não está autorizado no provedor de login Google.';
    case 'auth/network-request-failed':
      return 'Erro de rede ao conectar com o Google. Verifique sua conexão e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta cadastrada com este e-mail usando outro método de login.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Falha ao autenticar com o Google.';
  }
}

export async function signInWithGooglePopup(): Promise<{ idToken: string }> {
  const auth = getFirebaseAuthInstance();
  const provider = createGoogleProvider();
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  if (!idToken) {
    throw new Error('Não foi possível obter o token de verificação do Google.');
  }
  return { idToken };
}

export async function signOutFirebase(): Promise<void> {
  if (!isFirebaseGoogleAuthAvailable() || !getApps().length) return;
  try {
    const auth = getFirebaseAuthInstance();
    await signOut(auth);
  } catch {
    // Ignora falhas silenciosas ao limpar sessão auxiliar do Firebase
  }
}
