import { AuthSession } from '../types';
import {
  isFirebaseConfigured,
  mapFirebaseAuthError,
  signInWithGooglePopup,
} from '../lib/firebaseAuthOnly';

export interface GoogleLoginResult {
  success: boolean;
  session?: AuthSession;
  isNewUser?: boolean;
  error?: string;
}

export async function startGoogleOAuthPopup(): Promise<GoogleLoginResult> {
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      error: 'Autenticação Google via Firebase não está configurada neste ambiente.',
    };
  }

  try {
    const firebaseUser = await signInWithGooglePopup();
    if (!firebaseUser.email || firebaseUser.emailVerified === false) {
      return {
        success: false,
        error: 'Sua conta Google precisa possuir um e-mail verificado.',
      };
    }

    const { FirestoreService } = await import('./firestore');
    const { user, isNewUser } = await FirestoreService.ensureUserBootstrapped(firebaseUser);
    return {
      success: true,
      session: { user },
      isNewUser,
    };
  } catch (err) {
    return {
      success: false,
      error: mapFirebaseAuthError(err),
    };
  }
}
