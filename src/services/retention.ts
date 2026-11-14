/**
 * Política de Retenção, Minimização e Limpeza Automática Local — IPCA-Casa
 *
 * Responsabilidades:
 * - Remover caches obsoletos de IBGE ou estados temporários expirados no navegador.
 * - Remover eventuais chaves legadas de senha/autenticação local (se existirem de versões antigas).
 * - Preservar intactos os dados ativos do modo demonstração e preferências válidas de consentimento.
 * - Executar limpeza completa dos caches ao excluir conta ou encerrar sessão autenticada.
 */

export const RETENTION_POLICIES_MS = {
  IBGE_STALE_CACHE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 dias
  UI_NOTICE_MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000, // 30 dias
  CONSENT_LOG_MAX_AGE_MS: 365 * 24 * 60 * 60 * 1000, // 365 dias
} as const;

export interface RetentionCleanupReport {
  removedKeys: string[];
  prunedConsentRecords: number;
  executedAt: string;
}

const LEGACY_INSECURE_AUTH_KEYS = [
  'ipca_casa_users_v1',
  'ipca_casa_session_v1',
  'ipca_casa_passwords_v1',
];

export function runLocalDataRetentionSweep(nowMs = Date.now()): RetentionCleanupReport {
  const report: RetentionCleanupReport = {
    removedKeys: [],
    prunedConsentRecords: 0,
    executedAt: new Date(nowMs).toISOString(),
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return report;
  }

  try {
    // 1. Eliminação imediata de quaisquer chaves legadas obsoletas que possam ter ficado em navegadores antigos
    for (const key of LEGACY_INSECURE_AUTH_KEYS) {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        report.removedKeys.push(key);
      }
    }

    // 2. Limpeza de caches IBGE expirados além de 7 dias
    const keysToInspect: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) keysToInspect.push(key);
    }

    for (const key of keysToInspect) {
      if (key.startsWith('ipca_casa_ibge_cache')) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as { timestamp?: number; fetchedAt?: number };
          const refTime = parsed.timestamp ?? parsed.fetchedAt ?? 0;
          if (refTime > 0 && nowMs - refTime > RETENTION_POLICIES_MS.IBGE_STALE_CACHE_MAX_AGE_MS) {
            window.localStorage.removeItem(key);
            report.removedKeys.push(key);
          }
        } catch {
          window.localStorage.removeItem(key);
          report.removedKeys.push(key);
        }
      }
    }

    // 3. Minimização do histórico local de consentimentos (> 365 dias)
    const historyKey = 'ipca_casa_consent_history_v1';
    const rawHistory = window.localStorage.getItem(historyKey);
    if (rawHistory) {
      try {
        const parsed = JSON.parse(rawHistory) as Array<{ decidedAt?: string }>;
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((entry) => {
            if (!entry?.decidedAt) return false;
            const time = Date.parse(entry.decidedAt);
            return Number.isFinite(time) && nowMs - time <= RETENTION_POLICIES_MS.CONSENT_LOG_MAX_AGE_MS;
          });
          if (filtered.length !== parsed.length) {
            report.prunedConsentRecords = parsed.length - filtered.length;
            window.localStorage.setItem(historyKey, JSON.stringify(filtered.slice(-20)));
          }
        }
      } catch {
        window.localStorage.removeItem(historyKey);
        report.removedKeys.push(historyKey);
      }
    }
  } catch {
    // Ignora bloqueios de storage
  }

  return report;
}

export function purgeAllBrowserAccountCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    if (window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('ipca_casa_') || key.startsWith('firebase:'))) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        window.localStorage.removeItem(key);
      }
    }
    if (window.sessionStorage) {
      window.sessionStorage.clear();
    }
  } catch {
    // Ignora falhas de acesso ao storage
  }
}
