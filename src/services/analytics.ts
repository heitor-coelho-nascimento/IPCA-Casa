/**
 * IPCA-Casa: Google Analytics 4 com Consent Mode v2 e Firewall Anti-PII / Financeiro
 *
 * Regras de segurança e privacidade:
 * - Nunca embute ID fictício (usa estritamente VITE_GA_MEASUREMENT_ID).
 * - Nunca envia renda, salários, gastos, valores monetários em R$, e-mails, nomes ou UIDs.
 * - Evita carregamento duplicado de script e page_views duplicados em navegação SPA.
 */

export type AnalyticsConsentState = 'granted' | 'denied';

const CONSENT_STORAGE_KEY = 'ipca_casa_analytics_consent_v1';
const GA_SCRIPT_ATTR = 'data-ipca-ga4-script';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SENSITIVE_KEY_FRAGMENTS = [
  'email',
  'mail',
  'name',
  'nome',
  'display',
  'cpf',
  'phone',
  'telefone',
  'uid',
  'user_id',
  'userid',
  'profile_id',
  'income',
  'renda',
  'salary',
  'salario',
  'spend',
  'gasto',
  'expense',
  'despesa',
  'price',
  'preco',
  'amount',
  'valor',
  'value',
  'balance',
  'saldo',
  'deficit',
  'token',
  'password',
  'senha',
  'address',
  'endereco',
  'item_name',
];

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CURRENCY_PATTERN = /r\$\s*-?\d+/i;

let scriptLoadedForId: string | null = null;
let initializedId: string | null = null;
let lastPageViewSignature: string | null = null;
let lastImpactTrackedAt = 0;
let lastImpactSignature = '';

function readGaMeasurementIdFromEnv(overrideId?: string): string {
  if (overrideId !== undefined) return overrideId.trim();
  const viteEnv =
    typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GA_MEASUREMENT_ID
      : undefined;
  const nodeEnv = typeof process !== 'undefined' ? process.env?.VITE_GA_MEASUREMENT_ID : undefined;
  return (viteEnv ?? nodeEnv ?? '').trim();
}

export function isValidGaMeasurementId(id: string | undefined | null): id is string {
  if (!id) return false;
  const clean = id.trim();
  if (!clean) return false;
  if (/^G-X+$/i.test(clean) || /^G-0+$/i.test(clean) || clean.toUpperCase() === 'G-XXXXXXXXXX') {
    return false;
  }
  return /^G-[A-Z0-9]{6,16}$/i.test(clean);
}

export function getGaMeasurementId(overrideId?: string): string | null {
  const candidate = readGaMeasurementIdFromEnv(overrideId);
  return isValidGaMeasurementId(candidate) ? candidate : null;
}

export function isGaConfigured(overrideId?: string): boolean {
  return getGaMeasurementId(overrideId) !== null;
}

export function getConsentStatus(): AnalyticsConsentState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw === 'granted' || raw === 'denied' ? raw : null;
  } catch {
    return null;
  }
}

export function sanitizeAnalyticsParams(
  params: Record<string, string | number | boolean | undefined>
): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};

  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null) continue;
    const normalizedKey = key.toLowerCase();

    if (SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment))) {
      continue;
    }

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) continue;
      if (EMAIL_PATTERN.test(trimmed) || CURRENCY_PATTERN.test(trimmed)) {
        continue;
      }
      clean[key] = trimmed.slice(0, 100);
    } else if (typeof val === 'boolean') {
      clean[key] = val;
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      clean[key] = val;
    }
  }

  return clean;
}

function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }
}

function applyConsentToGtag(status: AnalyticsConsentState): void {
  if (typeof window === 'undefined') return;
  ensureGtagStub();
  window.gtag?.('consent', 'update', {
    analytics_storage: status === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

function injectGaScriptOnce(measurementId: string): void {
  if (typeof document === 'undefined') return;
  if (scriptLoadedForId === measurementId) return;

  const existing = document.querySelector(`script[${GA_SCRIPT_ATTR}="${measurementId}"]`);
  if (existing) {
    scriptLoadedForId = measurementId;
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.setAttribute(GA_SCRIPT_ATTR, measurementId);
  document.head.appendChild(script);
  scriptLoadedForId = measurementId;
}

export function initAnalytics(overrideMeasurementId?: string): boolean {
  if (typeof window === 'undefined') return false;
  const measurementId = getGaMeasurementId(overrideMeasurementId);
  if (!measurementId) return false;

  const consent = getConsentStatus();
  ensureGtagStub();

  if (initializedId !== measurementId) {
    window.gtag?.('consent', 'default', {
      analytics_storage: consent === 'granted' ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500,
    });
    window.gtag?.('js', new Date());
    window.gtag?.('config', measurementId, {
      send_page_view: false,
      anonymize_ip: true,
    });
    initializedId = measurementId;
  }

  if (consent === 'granted') {
    injectGaScriptOnce(measurementId);
    return true;
  }

  return false;
}

export function setConsentStatus(
  status: AnalyticsConsentState,
  overrideMeasurementId?: string
): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, status);
    } catch {
      // ignora restrições de armazenamento privado
    }
  }

  const measurementId = getGaMeasurementId(overrideMeasurementId);
  if (!measurementId) return;

  initAnalytics(measurementId);
  applyConsentToGtag(status);

  if (status === 'granted') {
    injectGaScriptOnce(measurementId);
  }
}

function dispatchGaEvent(
  eventName: string,
  params: Record<string, string | number | boolean | undefined> = {},
  overrideMeasurementId?: string
): boolean {
  if (typeof window === 'undefined') return false;
  const measurementId = getGaMeasurementId(overrideMeasurementId);
  if (!measurementId) return false;
  if (getConsentStatus() !== 'granted') return false;

  initAnalytics(measurementId);
  const safeParams = sanitizeAnalyticsParams(params);
  window.gtag?.('event', eventName, safeParams);
  return true;
}

export function trackPageView(
  path: string,
  title: string,
  overrideMeasurementId?: string
): boolean {
  const cleanPath = (path || '/').split(/[?#]/)[0] || '/';
  const signature = `${cleanPath}|${title}`;
  if (lastPageViewSignature === signature) {
    return false;
  }
  lastPageViewSignature = signature;

  return dispatchGaEvent(
    'page_view',
    {
      page_path: cleanPath,
      page_title: title,
      page_location:
        typeof window !== 'undefined' ? `${window.location.origin}${cleanPath}` : undefined,
    },
    overrideMeasurementId
  );
}

export function trackSignUp(method: 'google' | 'email_password' | 'local_email'): boolean {
  return dispatchGaEvent('sign_up', { method });
}

export function trackLogin(method: 'google' | 'email_password' | 'local_email' | 'demo'): boolean {
  return dispatchGaEvent('login', { method });
}

export function trackViewIpca(params: {
  surface: 'public' | 'dashboard';
  timeframe?: string;
  source_mode?: 'live' | 'cache';
}): boolean {
  return dispatchGaEvent('view_ipca', params);
}

export function trackCalculateImpact(
  perspective: string,
  surface: 'hero-simulator' | 'pocket-impact'
): boolean {
  const now = Date.now();
  const signature = `${surface}|${perspective}`;
  if (signature === lastImpactSignature && now - lastImpactTrackedAt < 3000) {
    return false;
  }
  lastImpactSignature = signature;
  lastImpactTrackedAt = now;

  return dispatchGaEvent('calculate_impact', {
    perspective,
    surface,
  });
}

export function trackViewDashboard(tabId: string, sessionMode: 'authenticated' | 'demo'): boolean {
  return dispatchGaEvent('view_dashboard', {
    section_tab: tabId,
    session_mode: sessionMode,
  });
}

export function trackExportData(format: 'csv' | 'json' | 'backup_json' | 'print_pdf'): boolean {
  return dispatchGaEvent('export_data', {
    export_format: format,
  });
}

export function resetAnalyticsForTests(): void {
  scriptLoadedForId = null;
  initializedId = null;
  lastPageViewSignature = null;
  lastImpactTrackedAt = 0;
  lastImpactSignature = '';
}
