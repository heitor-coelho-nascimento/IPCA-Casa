import firebaseConfig from '../../firebase-applet-config.json';

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DISPLAY_NAME_MAX: 120,
  AVATAR_URL_MAX: 1000,
  EMAIL_MAX: 255,
  PROFILE_NAME_MAX: 120,
  REGION_MAX: 120,
  CURRENCY_MAX: 10,
  ITEM_NAME_MAX: 200,
  ITEM_DESC_MAX: 500,
  GROUP_NAME_MAX: 120,
  DATE_MAX: 32,
  UNIT_MAX: 40,
  NOTES_MAX: 1000,
  PRICE_SOURCE_MAX: 255,
  PRICE_NOTES_MAX: 500,
  GROUP_DESC_MAX: 300,
  COLOR_MAX: 32,
  ICON_MAX: 64,
  STRATEGY_TITLE_MAX: 200,
  STRATEGY_TEXT_MAX: 600,
} as const;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig?.apiKey &&
      firebaseConfig?.projectId &&
      firebaseConfig?.authDomain &&
      firebaseConfig?.firestoreDatabaseId &&
      firebaseConfig.projectId !== 'remixed-project-id'
  );
}

export function sanitizeFirestoreId(raw: string | undefined | null, prefix = 'rec'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, BLUEPRINT_LIMITS.ID_MAX);

  if (cleaned && BLUEPRINT_LIMITS.ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    BLUEPRINT_LIMITS.ID_MAX
  );
}

export { firebaseConfig };
