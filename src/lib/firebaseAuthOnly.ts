/**
 * Módulo leve de autenticação Firebase (sem importar firebase/firestore),
 * gerenciando sessão persistente oficial (Email/Senha + Google OAuth + Verificação + Redefinição de Senha).
 */
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

export { isFirebaseConfigured };

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured()
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

let persistencePromise: Promise<void> | null = null;

export async function ensureFirebaseAuthPersistence(): Promise<void> {
  if (!auth || typeof window === 'undefined') return;
  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence).catch(() => {
      // Ambientes sem indexedDB/storage persistente usam sessão em memória do SDK
    });
  }
  await persistencePromise;
}

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/userinfo.email');
  provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function extractAuthProvider(user: User | null | undefined): 'google' | 'password' {
  if (!user?.providerData?.length) return 'password';
  const hasGoogle = user.providerData.some((p) => p?.providerId === 'google.com');
  return hasGoogle ? 'google' : 'password';
}

export function getFirebaseAuthErrorCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code || '')
    : '';
}

export function mapFirebaseAuthError(err: unknown): string {
  const code = getFirebaseAuthErrorCode(err);

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'A janela de login com o Google foi fechada antes da conclusão.';
    case 'auth/cancelled-popup-request':
      return 'Solicitação de login cancelada por uma nova tentativa em andamento.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.';
    case 'auth/unauthorized-domain':
      return 'Este domínio não está autorizado no Firebase Authentication. Cadastre o domínio em Authentication > Settings > Authorized domains.';
    case 'auth/network-request-failed':
      return 'Erro de rede ao conectar com o Firebase Authentication. Verifique sua conexão e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta cadastrada com este e-mail usando outro método de login.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta cadastrada com este endereço de e-mail.';
    case 'auth/invalid-email':
      return 'O endereço de e-mail informado é inválido.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Utilize ao menos 6 caracteres com letras e números.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha inválidos. Confira suas credenciais ou utilize a recuperação de senha.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada no Firebase Authentication.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar novamente.';
    case 'auth/user-token-expired':
      return 'Sua sessão expirou. Faça login novamente para continuar.';
    case 'auth/operation-not-allowed':
      return 'O login por E-mail e Senha ainda não está habilitado no Firebase Console (Authentication > Sign-in method).';
    case 'auth/requires-recent-login':
      return 'Por segurança, entre novamente na sua conta antes de concluir esta ação sensível.';
    default:
      return 'Não foi possível concluir a autenticação no momento. Tente novamente.';
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  if (!auth) {
    throw new Error('Firebase Authentication não está configurado neste ambiente.');
  }
  await ensureFirebaseAuthPersistence();
  const provider = createGoogleProvider();
  const result = await signInWithPopup(auth, provider);
  if (!result.user) {
    throw new Error('Não foi possível obter os dados da sua conta Google.');
  }
  return result.user;
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  displayName: string
): Promise<{ user: User; verificationEmailSent: boolean }> {
  if (!auth) {
    throw new Error('Firebase Authentication não está configurado neste ambiente.');
  }
  await ensureFirebaseAuthPersistence();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch {
      // ignora erro secundário de displayName no perfil Auth
    }
  }

  let verificationEmailSent = false;
  try {
    await sendEmailVerification(cred.user);
    verificationEmailSent = true;
  } catch {
    verificationEmailSent = false;
  }

  return { user: cred.user, verificationEmailSent };
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  if (!auth) {
    throw new Error('Firebase Authentication não está configurado neste ambiente.');
  }
  await ensureFirebaseAuthPersistence();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  try {
    await reload(cred.user);
  } catch {
    // mantém usuário retornado caso reload falhe por rede transitória
  }
  return cred.user;
}

export async function resendFirebaseEmailVerification(): Promise<void> {
  if (!auth || !auth.currentUser) {
    throw new Error('Nenhuma sessão pendente de verificação encontrada.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentFirebaseUser(): Promise<User | null> {
  if (!auth || !auth.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

export async function sendFirebasePasswordReset(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Firebase Authentication não está configurado neste ambiente.');
  }
  await sendPasswordResetEmail(auth, email);
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
  void ensureFirebaseAuthPersistence();
  return onAuthStateChanged(auth, callback);
}
