/**
 * Serviço de Gestão de Consentimento (CMP) — IPCA-Casa
 *
 * Princípios LGPD:
 * - Privacy by Default: analytics e marketing iniciam como `false`.
 * - Cookies/armazenamento estritamente necessários (`essenciais`) são sempre `true`.
 * - Revogação imediata com limpeza de cookies de terceiros (_ga, _gid, _gat) e desativação de gtag.
 * - Sem PII no registro local de consentimento (usa apenas UUID anônimo aleatório).
 */

import { CMP_VERSION, POLICY_VERSION } from '../config/privacy';
import { ConsentCategories, ConsentPreferenceState, ConsentRecord } from '../types';

export const CONSENT_PREFS_STORAGE_KEY = 'ipca_casa_consent_preferences_v2';
export const CONSENT_HISTORY_STORAGE_KEY = 'ipca_casa_consent_history_v1';
export const LEGACY_ANALYTICS_CONSENT_KEY = 'ipca_casa_analytics_consent_v1';
export const PENDING_TERMS_ACCEPTANCE_KEY = 'ipca_casa_pending_terms_acceptance_v1';
export const OPEN_COOKIE_MODAL_EVENT = 'ipca-open-cookie-preferences';
export const CONSENT_CHANGED_EVENT = 'ipca-consent-changed';

export interface PendingTermsAcceptance {
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  termsVersion: string;
  policyVersion: string;
  acceptanceMethod: 'email_register' | 'google_signin' | 'post_login_gate';
  capturedAt: string;
}

function generateAnonymousUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cmp_${crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`;
  }
  return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getDefaultConsentCategories(): ConsentCategories {
  return {
    essenciais: true,
    analytics: false,
    marketing: false,
  };
}

export function getStoredConsentPreferences(): ConsentPreferenceState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConsentPreferenceState>;
      if (parsed && parsed.categories && typeof parsed.categories.analytics === 'boolean') {
        return {
          version: typeof parsed.version === 'string' ? parsed.version : POLICY_VERSION,
          cmpVersion: typeof parsed.cmpVersion === 'string' ? parsed.cmpVersion : CMP_VERSION,
          anonymousConsentId:
            typeof parsed.anonymousConsentId === 'string' && parsed.anonymousConsentId
              ? parsed.anonymousConsentId
              : generateAnonymousUuid(),
          categories: {
            essenciais: true,
            analytics: Boolean(parsed.categories.analytics),
            marketing: Boolean(parsed.categories.marketing),
          },
          decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
          source: parsed.source || 'banner',
        };
      }
    }

    // Compatibilidade com a chave legada v1 se já havia escolha explícita do usuário
    const legacy = window.localStorage.getItem(LEGACY_ANALYTICS_CONSENT_KEY);
    if (legacy === 'granted' || legacy === 'denied') {
      return {
        version: POLICY_VERSION,
        cmpVersion: CMP_VERSION,
        anonymousConsentId: generateAnonymousUuid(),
        categories: {
          essenciais: true,
          analytics: legacy === 'granted',
          marketing: false,
        },
        decidedAt: new Date().toISOString(),
        source: 'banner',
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function getEffectiveConsentCategories(): ConsentCategories {
  const stored = getStoredConsentPreferences();
  return stored ? stored.categories : getDefaultConsentCategories();
}

export function hasUserMadeConsentChoice(): boolean {
  return getStoredConsentPreferences() !== null;
}

export function getLocalConsentHistory(): ConsentRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CONSENT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-20) : [];
  } catch {
    return [];
  }
}

export function clearThirdPartyTrackingCookies(): void {
  if (typeof document === 'undefined') return;
  try {
    const rawCookies = document.cookie ? document.cookie.split(';') : [];
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const domainCandidates = ['', hostname, hostname ? `.${hostname}` : ''].filter(Boolean);
    const trackingPrefixes = ['_ga', '_gid', '_gat', '_gcl'];

    for (const pair of rawCookies) {
      const name = pair.split('=')[0]?.trim();
      if (!name) continue;
      if (trackingPrefixes.some((prefix) => name === prefix || name.startsWith(prefix))) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
        for (const domain of domainCandidates) {
          document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`;
        }
      }
    }
  } catch {
    // Ignora bloqueios de cookie em ambientes sandboxed
  }
}

export function saveConsentPreferences(
  nextCategories: { analytics: boolean; marketing?: boolean },
  source: ConsentPreferenceState['source'] = 'modal'
): ConsentPreferenceState {
  const existing = getStoredConsentPreferences();
  const anonymousConsentId = existing?.anonymousConsentId || generateAnonymousUuid();
  const nowIso = new Date().toISOString();
  const normalized: ConsentPreferenceState = {
    version: POLICY_VERSION,
    cmpVersion: CMP_VERSION,
    anonymousConsentId,
    categories: {
      essenciais: true,
      analytics: Boolean(nextCategories.analytics),
      marketing: Boolean(nextCategories.marketing),
    },
    decidedAt: nowIso,
    source,
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CONSENT_PREFS_STORAGE_KEY, JSON.stringify(normalized));
      window.localStorage.setItem(
        LEGACY_ANALYTICS_CONSENT_KEY,
        normalized.categories.analytics ? 'granted' : 'denied'
      );

      const history = getLocalConsentHistory();
      const record: ConsentRecord = {
        id: `consent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        anonymousConsentId,
        essenciais: true,
        analytics: normalized.categories.analytics,
        marketing: normalized.categories.marketing,
        cmpVersion: CMP_VERSION,
        policyVersion: POLICY_VERSION,
        source,
        decidedAt: nowIso,
      };
      const nextHistory = [...history.slice(-19), record];
      window.localStorage.setItem(CONSENT_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    } catch {
      // Ignora limitações de armazenamento
    }
  }

  if (!normalized.categories.analytics && !normalized.categories.marketing) {
    clearThirdPartyTrackingCookies();
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: normalized }));
  }

  return normalized;
}

export function openCookiePreferencesModal(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_MODAL_EVENT));
}

export function savePendingTermsAcceptance(acceptance: PendingTermsAcceptance): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(PENDING_TERMS_ACCEPTANCE_KEY, JSON.stringify(acceptance));
  } catch {
    // Ignora se sessionStorage indisponível
  }
}

export function readPendingTermsAcceptance(): PendingTermsAcceptance | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_TERMS_ACCEPTANCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTermsAcceptance;
    if (parsed && parsed.acceptedTerms && parsed.acceptedPrivacy) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingTermsAcceptance(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(PENDING_TERMS_ACCEPTANCE_KEY);
  } catch {
    // Ignora
  }
}
