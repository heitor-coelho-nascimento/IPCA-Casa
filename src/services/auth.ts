/**
 * IPCA-Casa: Serviço Oficial de Autenticação via Firebase Authentication + Migração Segura
 *
 * Princípios de Segurança:
 * - Zero armazenamento de senhas, hashes ou tokens falsos em localStorage.
 * - Identidade exclusivamente baseada em Firebase Auth (E-mail/Senha verificado e Google OAuth).
 * - Exige verificação real de e-mail para contas por senha antes de liberar acesso ao Cloud Firestore.
 * - Recuperação real de senha via sendPasswordResetEmail sem enumeração de contas.
 * - Dados locais legados só são migrados mediante consentimento explícito para UID verificado e só
 *   removidos após confirmação de gravação no Cloud Firestore.
 */

import {
  AuthSession,
  BasketItem,
  ConsumptionGroup,
  EfficiencyPlanB,
  FamilyProfile,
  IncomeRecord,
  OpportunityPlanC,
  PriceRecord,
  SubstitutePlanA,
  UserAccount,
} from '../types';
import {
  auth,
  getFirebaseAuthErrorCode,
  isFirebaseConfigured,
  mapFirebaseAuthError,
  reloadCurrentFirebaseUser,
  resendFirebaseEmailVerification,
  sendFirebasePasswordReset,
  signInWithEmailPassword,
  signOutFirebase,
  signUpWithEmailPassword,
} from '../lib/firebaseAuthOnly';
import { safeStorage } from './storage';

const LEGACY_CREDENTIAL_KEYS = [
  'ipca_casa_user_accounts_v1',
  'ipca_casa_active_session_v1',
  'ipca_casa_pwd_hashes_v1',
];

const LOCAL_DATA_KEYS = {
  PROFILES: 'ipca_casa_profiles_v1',
  ACTIVE_PROFILE: 'ipca_casa_active_profile_v1',
  BASKET_ITEMS: 'ipca_casa_basket_items_v1',
  PRICE_HISTORY: 'ipca_casa_price_history_v1',
  INCOME_HISTORY: 'ipca_casa_income_history_v1',
  GROUPS: 'ipca_casa_groups_v1',
  PLANS_A: 'ipca_casa_plans_a_v1',
  PLANS_B: 'ipca_casa_plans_b_v1',
  PLANS_C: 'ipca_casa_plans_c_v1',
  MIGRATION_DISMISSED_PREFIX: 'ipca_casa_legacy_migration_dismissed_',
};

const DEMO_PROFILE_ID = 'profile-demo';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthActionResult {
  success: boolean;
  session?: AuthSession;
  isNewUser?: boolean;
  requiresEmailVerification?: boolean;
  verificationEmailSent?: boolean;
  pendingEmail?: string;
  error?: string;
}

export interface LegacyLocalBundle {
  legacyAccountsCount: number;
  legacyEmails: string[];
  profiles: FamilyProfile[];
  basketItems: BasketItem[];
  priceHistory: PriceRecord[];
  incomeHistory: IncomeRecord[];
  plansA: SubstitutePlanA[];
  plansB: EfficiencyPlanB[];
  plansC: OpportunityPlanC[];
  customGroups: ConsumptionGroup[];
  hasFinancialData: boolean;
  hasLegacyCredentials: boolean;
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export class AuthService {
  /**
   * Retorna usuário somente se houver sessão oficial ativa e verificada no Firebase Authentication.
   * Nunca retorna sessões falsas vindas de localStorage.
   */
  static getCurrentFirebaseIdentity(): {
    uid: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
  } | null {
    const fbUser = auth?.currentUser;
    if (!fbUser || !fbUser.email) return null;
    return {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || fbUser.email.split('@')[0] || 'Usuário',
      emailVerified: Boolean(fbUser.emailVerified),
    };
  }

  static async register(params: {
    email: string;
    displayName: string;
    password: string;
  }): Promise<AuthActionResult> {
    const emailNormalized = params.email.trim().toLowerCase();
    const displayName = params.displayName.trim();

    if (!displayName || displayName.length < 2 || displayName.length > 120) {
      return {
        success: false,
        error: 'O nome de exibição deve ter entre 2 e 120 caracteres.',
      };
    }

    if (!isValidEmailFormat(emailNormalized)) {
      return {
        success: false,
        error: 'Por favor, informe um endereço de e-mail válido.',
      };
    }

    if (!params.password || params.password.length < 6) {
      return {
        success: false,
        error: 'A senha de acesso deve possuir no mínimo 6 caracteres.',
      };
    }

    if (!isFirebaseConfigured()) {
      return {
        success: false,
        error: 'Firebase Authentication não está configurado neste ambiente.',
      };
    }

    try {
      const { user: fbUser, verificationEmailSent } = await signUpWithEmailPassword(
        emailNormalized,
        params.password,
        displayName
      );

      if (!fbUser.emailVerified) {
        return {
          success: true,
          isNewUser: true,
          requiresEmailVerification: true,
          verificationEmailSent,
          pendingEmail: fbUser.email || emailNormalized,
        };
      }

      const { FirestoreService } = await import('./firestore');
      const { user } = await FirestoreService.ensureUserBootstrapped(fbUser);
      return {
        success: true,
        isNewUser: true,
        session: { user },
      };
    } catch (err) {
      return {
        success: false,
        error: mapFirebaseAuthError(err),
      };
    }
  }

  static async login(params: {
    email: string;
    password: string;
  }): Promise<AuthActionResult> {
    const emailNormalized = params.email.trim().toLowerCase();

    if (!isValidEmailFormat(emailNormalized)) {
      return {
        success: false,
        error: 'Informe um endereço de e-mail válido.',
      };
    }

    if (!params.password) {
      return {
        success: false,
        error: 'Informe sua senha para entrar.',
      };
    }

    if (!isFirebaseConfigured()) {
      return {
        success: false,
        error: 'Firebase Authentication não está configurado neste ambiente.',
      };
    }

    try {
      const fbUser = await signInWithEmailPassword(emailNormalized, params.password);
      if (!fbUser.emailVerified) {
        return {
          success: false,
          requiresEmailVerification: true,
          pendingEmail: fbUser.email || emailNormalized,
          error:
            'Seu e-mail ainda não foi verificado. Acesse o link de confirmação enviado na sua caixa de entrada.',
        };
      }

      const { FirestoreService } = await import('./firestore');
      const { user, isNewUser } = await FirestoreService.ensureUserBootstrapped(fbUser);
      return {
        success: true,
        isNewUser,
        session: { user },
      };
    } catch (err) {
      return {
        success: false,
        error: mapFirebaseAuthError(err),
      };
    }
  }

  static async checkEmailVerifiedAndBootstrap(): Promise<{
    verified: boolean;
    user?: UserAccount;
    isNewUser?: boolean;
    error?: string;
  }> {
    if (!isFirebaseConfigured()) {
      return {
        verified: false,
        error: 'Firebase Authentication não está configurado neste ambiente.',
      };
    }

    try {
      const refreshed = await reloadCurrentFirebaseUser();
      if (!refreshed) {
        return {
          verified: false,
          error: 'Sessão não encontrada. Entre novamente com seu e-mail e senha.',
        };
      }

      if (!refreshed.emailVerified) {
        return {
          verified: false,
          error:
            'O e-mail ainda consta como pendente de verificação. Clique no link enviado pelo Firebase e tente novamente.',
        };
      }

      // Atualiza o ID token JWT para que email_verified == true entre imediatamente nas regras do Firestore
      await refreshed.getIdToken(true);
      const { FirestoreService } = await import('./firestore');
      const { user, isNewUser } = await FirestoreService.ensureUserBootstrapped(refreshed);
      return { verified: true, user, isNewUser };
    } catch (err) {
      return {
        verified: false,
        error: mapFirebaseAuthError(err),
      };
    }
  }

  static async resendVerificationEmail(): Promise<{ success: boolean; message: string }> {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message: 'Firebase Authentication não está configurado neste ambiente.',
      };
    }

    try {
      await resendFirebaseEmailVerification();
      return {
        success: true,
        message:
          'Novo e-mail de verificação enviado. Confira sua caixa de entrada e a pasta de spam.',
      };
    } catch (err) {
      return {
        success: false,
        message: mapFirebaseAuthError(err),
      };
    }
  }

  static async logout(): Promise<void> {
    await signOutFirebase();
    // Limpa eventuais resquícios de sessão manual legada ao encerrar sessão
    safeStorage.removeItem('ipca_casa_active_session_v1');
  }

  /**
   * Recuperação real via Firebase Authentication (sendPasswordResetEmail).
   * Não revela se um e-mail específico está cadastrado na plataforma (anti-enumeração).
   */
  static async recoverPassword(email: string): Promise<{ success: boolean; message: string }> {
    const emailNormalized = email.trim().toLowerCase();
    if (!isValidEmailFormat(emailNormalized)) {
      return {
        success: false,
        message: 'Informe um endereço de e-mail válido para solicitar a redefinição de senha.',
      };
    }

    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message:
          'Recuperação de senha indisponível: o Firebase Authentication não está configurado neste ambiente.',
      };
    }

    try {
      await sendFirebasePasswordReset(emailNormalized);
      return {
        success: true,
        message:
          'Se houver uma conta ativa associada a este endereço, você receberá em instantes um e-mail com as instruções para redefinir sua senha.',
      };
    } catch (err) {
      const code = getFirebaseAuthErrorCode(err);
      if (code === 'auth/user-not-found') {
        // Resposta idêntica para evitar enumeração de contas cadastradas
        return {
          success: true,
          message:
            'Se houver uma conta ativa associada a este endereço, você receberá em instantes um e-mail com as instruções para redefinir sua senha.',
        };
      }
      return {
        success: false,
        message: mapFirebaseAuthError(err),
      };
    }
  }
}

export class LegacyMigrationService {
  static hasLegacyCredentials(): boolean {
    return LEGACY_CREDENTIAL_KEYS.some((key) => {
      const val = safeStorage.getItem(key);
      return Boolean(val && val.trim() !== '' && val.trim() !== '[]' && val.trim() !== '{}');
    });
  }

  static clearLegacyCredentialArtifactsOnly(): void {
    for (const key of LEGACY_CREDENTIAL_KEYS) {
      safeStorage.removeItem(key);
    }
  }

  static isDismissedForUser(uid: string): boolean {
    return safeStorage.getItem(`${LOCAL_DATA_KEYS.MIGRATION_DISMISSED_PREFIX}${uid}`) === 'true';
  }

  static markDismissedForUser(uid: string): void {
    safeStorage.setItem(`${LOCAL_DATA_KEYS.MIGRATION_DISMISSED_PREFIX}${uid}`, 'true');
  }

  /**
   * Varre o localStorage procurando perfis/dados reais legados (excluindo perfil demonstração)
   * sem associar nada automaticamente por e-mail.
   */
  static scanLegacyLocalData(): LegacyLocalBundle {
    const legacyAccounts = safeParseJson<Array<{ email?: string }>>(
      safeStorage.getItem('ipca_casa_user_accounts_v1'),
      []
    );
    const legacyEmails = Array.isArray(legacyAccounts)
      ? legacyAccounts
          .map((a) => (typeof a?.email === 'string' ? a.email.trim().toLowerCase() : ''))
          .filter(Boolean)
      : [];

    const allProfiles = safeParseJson<FamilyProfile[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.PROFILES),
      []
    );
    const allItems = safeParseJson<BasketItem[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.BASKET_ITEMS),
      []
    );
    const allIncome = safeParseJson<IncomeRecord[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.INCOME_HISTORY),
      []
    );
    const allPrices = safeParseJson<PriceRecord[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.PRICE_HISTORY),
      []
    );
    const allPlansA = safeParseJson<SubstitutePlanA[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.PLANS_A),
      []
    );
    const allPlansB = safeParseJson<EfficiencyPlanB[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.PLANS_B),
      []
    );
    const rawPlansC = safeParseJson<Record<string, OpportunityPlanC> | OpportunityPlanC | null>(
      safeStorage.getItem(LOCAL_DATA_KEYS.PLANS_C),
      null
    );
    const allGroups = safeParseJson<ConsumptionGroup[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.GROUPS),
      []
    );

    const realItems = Array.isArray(allItems)
      ? allItems.filter((i) => i && i.profileId && i.profileId !== DEMO_PROFILE_ID)
      : [];
    const realIncome = Array.isArray(allIncome)
      ? allIncome.filter((i) => i && i.profileId && i.profileId !== DEMO_PROFILE_ID)
      : [];
    const realPlansA = Array.isArray(allPlansA)
      ? allPlansA.filter((p) => p && p.profileId && p.profileId !== DEMO_PROFILE_ID)
      : [];
    const realPlansB = Array.isArray(allPlansB)
      ? allPlansB.filter((p) => p && p.profileId && p.profileId !== DEMO_PROFILE_ID)
      : [];

    let realPlansC: OpportunityPlanC[] = [];
    if (rawPlansC && typeof rawPlansC === 'object') {
      if ('profileId' in rawPlansC && typeof (rawPlansC as OpportunityPlanC).profileId === 'string') {
        const single = rawPlansC as OpportunityPlanC;
        if (single.profileId !== DEMO_PROFILE_ID && !single.isSimulated) {
          realPlansC = [single];
        }
      } else {
        realPlansC = Object.values(rawPlansC as Record<string, OpportunityPlanC>).filter(
          (p) => p && p.profileId && p.profileId !== DEMO_PROFILE_ID && !p.isSimulated
        );
      }
    }

    const customGroups = Array.isArray(allGroups)
      ? allGroups.filter((g) => g && g.isCustom)
      : [];

    const activeDataProfileIds = new Set<string>(
      [
        ...realItems.map((i) => i.profileId),
        ...realIncome.map((i) => i.profileId),
        ...realPlansA.map((p) => p.profileId),
        ...realPlansB.map((p) => p.profileId),
        ...realPlansC.map((p) => p.profileId),
      ].filter((id): id is string => Boolean(id))
    );

    // Inclui apenas perfis não-demo que tenham dados ou tenham sido criados explicitamente além do rascunho vazio
    const realProfiles = Array.isArray(allProfiles)
      ? allProfiles.filter(
          (p) =>
            p &&
            p.id !== DEMO_PROFILE_ID &&
            !p.isDemo &&
            (activeDataProfileIds.has(p.id) || p.id !== 'profile-clean-slate')
        )
      : [];

    const realItemIds = new Set(realItems.map((i) => i.id));
    const realPrices = Array.isArray(allPrices)
      ? allPrices.filter((pr) => pr && realItemIds.has(pr.itemId))
      : [];

    const hasFinancialData =
      realItems.length > 0 ||
      realIncome.length > 0 ||
      realPlansA.length > 0 ||
      realPlansB.length > 0 ||
      realPlansC.length > 0 ||
      customGroups.length > 0 ||
      realProfiles.length > 0;

    return {
      legacyAccountsCount: legacyEmails.length,
      legacyEmails,
      profiles: realProfiles,
      basketItems: realItems,
      priceHistory: realPrices,
      incomeHistory: realIncome,
      plansA: realPlansA,
      plansB: realPlansB,
      plansC: realPlansC,
      customGroups,
      hasFinancialData,
      hasLegacyCredentials: this.hasLegacyCredentials(),
    };
  }

  /**
   * Remove os registros locais legados APÓS confirmação de persistência na nuvem
   * ou descarte explícito pelo usuário, preservando intactos os registros de demonstração se presentes.
   */
  static clearMigratedLocalData(uid?: string): void {
    this.clearLegacyCredentialArtifactsOnly();

    const profiles = safeParseJson<FamilyProfile[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.PROFILES),
      []
    );
    const demoProfiles = profiles.filter((p) => p.id === DEMO_PROFILE_ID || p.isDemo);
    if (demoProfiles.length > 0) {
      safeStorage.setItem(LOCAL_DATA_KEYS.PROFILES, JSON.stringify(demoProfiles));
      safeStorage.setItem(LOCAL_DATA_KEYS.ACTIVE_PROFILE, demoProfiles[0].id);
    } else {
      safeStorage.removeItem(LOCAL_DATA_KEYS.PROFILES);
      safeStorage.removeItem(LOCAL_DATA_KEYS.ACTIVE_PROFILE);
    }

    const items = safeParseJson<BasketItem[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.BASKET_ITEMS),
      []
    );
    const demoItems = items.filter((i) => i.profileId === DEMO_PROFILE_ID);
    const demoItemIds = new Set(demoItems.map((i) => i.id));
    if (demoItems.length > 0) {
      safeStorage.setItem(LOCAL_DATA_KEYS.BASKET_ITEMS, JSON.stringify(demoItems));
    } else {
      safeStorage.removeItem(LOCAL_DATA_KEYS.BASKET_ITEMS);
    }

    const prices = safeParseJson<PriceRecord[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.PRICE_HISTORY),
      []
    );
    const demoPrices = prices.filter((p) => demoItemIds.has(p.itemId));
    if (demoPrices.length > 0) {
      safeStorage.setItem(LOCAL_DATA_KEYS.PRICE_HISTORY, JSON.stringify(demoPrices));
    } else {
      safeStorage.removeItem(LOCAL_DATA_KEYS.PRICE_HISTORY);
    }

    const income = safeParseJson<IncomeRecord[]>(
      safeStorage.getItem(LOCAL_DATA_KEYS.INCOME_HISTORY),
      []
    );
    const demoIncome = income.filter((i) => i.profileId === DEMO_PROFILE_ID);
    if (demoIncome.length > 0) {
      safeStorage.setItem(LOCAL_DATA_KEYS.INCOME_HISTORY, JSON.stringify(demoIncome));
    } else {
      safeStorage.removeItem(LOCAL_DATA_KEYS.INCOME_HISTORY);
    }

    const plansA = safeParseJson<SubstitutePlanA[]>(safeStorage.getItem(LOCAL_DATA_KEYS.PLANS_A), []);
    const demoPlansA = plansA.filter((p) => p.profileId === DEMO_PROFILE_ID);
    if (demoPlansA.length > 0) {
      safeStorage.setItem(LOCAL_DATA_KEYS.PLANS_A, JSON.stringify(demoPlansA));
    } else {
      safeStorage.removeItem(LOCAL_DATA_KEYS.PLANS_A);
    }

    const plansB = safeParseJson<EfficiencyPlanB[]>(safeStorage.getItem(LOCAL_DATA_KEYS.PLANS_B), []);
    const demoPlansB = plansB.filter((p) => p.profileId === DEMO_PROFILE_ID);
    if (demoPlansB.length > 0) {
      safeStorage.setItem(LOCAL_DATA_KEYS.PLANS_B, JSON.stringify(demoPlansB));
    } else {
      safeStorage.removeItem(LOCAL_DATA_KEYS.PLANS_B);
    }

    const rawPlansC = safeParseJson<Record<string, OpportunityPlanC> | null>(
      safeStorage.getItem(LOCAL_DATA_KEYS.PLANS_C),
      null
    );
    if (rawPlansC && typeof rawPlansC === 'object' && DEMO_PROFILE_ID in rawPlansC) {
      safeStorage.setItem(
        LOCAL_DATA_KEYS.PLANS_C,
        JSON.stringify({ [DEMO_PROFILE_ID]: rawPlansC[DEMO_PROFILE_ID] })
      );
    } else {
      safeStorage.removeItem(LOCAL_DATA_KEYS.PLANS_C);
    }

    if (uid) {
      this.markDismissedForUser(uid);
    }
  }
}
