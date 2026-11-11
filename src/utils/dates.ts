/**
 * Utilitários determinísticos e seguros contra deslocamento de fuso horário (UTC vs local)
 * para datas no padrão ISO YYYY-MM-DD.
 */

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const SHORT_MONTHS_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!ISO_DATE_REGEX.test(trimmed)) return false;

  const [yStr, mStr, dStr] = trimmed.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const maxDay = new Date(year, month, 0).getDate();
  return day <= maxDay;
}

export function extractIsoDatePrefix(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const candidate = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  return isValidIsoDate(candidate) ? candidate : null;
}

export function getTodayIsoDate(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = pad2(referenceDate.getMonth() + 1);
  const day = pad2(referenceDate.getDate());
  return `${year}-${month}-${day}`;
}

export function getMonthsAgoIsoDate(monthsAgo: number, referenceDate = new Date()): string {
  const safeMonths = Number.isFinite(monthsAgo) ? Math.max(0, Math.floor(monthsAgo)) : 12;
  const targetYearMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() - safeMonths,
    1,
    12,
    0,
    0
  );
  const maxDay = new Date(
    targetYearMonth.getFullYear(),
    targetYearMonth.getMonth() + 1,
    0
  ).getDate();
  const clampedDay = Math.min(referenceDate.getDate(), maxDay);
  return `${targetYearMonth.getFullYear()}-${pad2(targetYearMonth.getMonth() + 1)}-${pad2(clampedDay)}`;
}

export function getYearStartIsoDate(referenceDate = new Date()): string {
  return `${referenceDate.getFullYear()}-01-01`;
}

export function formatIsoDateBR(value: unknown, fallback = '—'): string {
  const iso = extractIsoDatePrefix(value);
  if (iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR');
    }
  }
  return fallback;
}

export function formatMonthYearLabel(value: unknown, shortYear = true): string {
  if (typeof value !== 'string' || !value.trim()) return '—';
  const trimmed = value.trim();
  const ymMatch = trimmed.match(/^(\d{4})-(\d{2})/);
  if (ymMatch) {
    const yearNum = Number(ymMatch[1]);
    const monthNum = Number(ymMatch[2]);
    if (monthNum >= 1 && monthNum <= 12) {
      const mName = SHORT_MONTHS_PT[monthNum - 1];
      return shortYear ? `${mName}/${String(yearNum).slice(-2)}` : `${mName}/${yearNum}`;
    }
  }
  return trimmed;
}

export function formatDateRangeLabel(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  fallback = 'Período ativo'
): string {
  const startLabel = formatMonthYearLabel(startDate, false);
  const endLabel = formatMonthYearLabel(endDate, false);
  if (startLabel !== '—' && endLabel !== '—') {
    return startLabel === endLabel ? startLabel : `${startLabel} — ${endLabel}`;
  }
  if (endLabel !== '—') return `Ref. ${endLabel}`;
  if (startLabel !== '—') return `Desde ${startLabel}`;
  return fallback;
}

export function parseIsoDateToLocalTimestamp(value: unknown): number {
  const iso = extractIsoDatePrefix(value);
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}
