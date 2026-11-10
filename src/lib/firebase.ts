/**
 * IPCA-Casa: Configuração e Inicialização Oficial do Firebase (Auth + Cloud Firestore)
 * Utiliza o banco Cloud Firestore provisionado em firebase-applet-config.json.
 */
import { Firestore, doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import {
  auth,
  firebaseApp,
  isFirebaseConfigured,
  mapFirebaseAuthError,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeFirebaseAuthState,
} from './firebaseAuthOnly';
import { firebaseConfig } from './firebaseConfig';

export {
  auth,
  isFirebaseConfigured,
  mapFirebaseAuthError,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeFirebaseAuthState,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const db: Firestore | null = firebaseApp
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : null;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Verifique a configuração do Firebase: cliente Firestore offline.');
      return false;
    }
    return true;
  }
}
