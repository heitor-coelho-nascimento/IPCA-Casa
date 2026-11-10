/**
 * IPCA-Casa: Verificação Server-Side de Tokens Google emitidos via Firebase Auth
 * Usa importação JSON estática obrigatória para ambientes ESM.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    firebaseConfig?.projectId &&
      firebaseConfig?.apiKey &&
      firebaseConfig.projectId !== 'remixed-project-id'
  );
}

export function getFirebaseAdminAuth() {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Configuração de autenticação Google não encontrada no servidor.');
  }
  if (!getApps().length) {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  return getAuth();
}

export async function verifyFirebaseGoogleIdToken(idToken: string): Promise<DecodedIdToken> {
  const adminAuth = getFirebaseAdminAuth();
  return adminAuth.verifyIdToken(idToken);
}
