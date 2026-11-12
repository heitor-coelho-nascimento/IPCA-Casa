import { BasketItem, ItemClassification } from '../types';
import { extractIsoDatePrefix, getMonthsAgoIsoDate, getTodayIsoDate } from './dates';

export type AmbiguityPreference = 'ask' | 'thousand' | 'decimal';

export interface ParsedNumberResult {
  status: 'valid' | 'ambiguous' | 'empty' | 'invalid';
  value: number | null;
  raw: string;
  reason?: string;
}

export interface CsvPreviewRow {
  rowNumber: number;
  name: string;
  group: string;
  classification: ItemClassification;
  monthlySpend: number | null;
  oldPrice: number | null;
  currentPrice: number | null;
  oldPriceDate: string;
  currentPriceDate: string;
  unit: string;
  notes: string;
  rawSpend: string;
  rawOldPrice: string;
  rawCurrentPrice: string;
  status: 'valid' | 'ambiguous' | 'duplicate' | 'invalid';
  issues: string[];
  ambiguousFields: string[];
  itemPayload?: BasketItem;
}

export interface CsvPreviewResult {
  delimiter: ';' | ',';
  rows: CsvPreviewRow[];
  summary: {
    totalRows: number;
    validCount: number;
    ambiguousCount: number;
    duplicateCount: number;
    invalidCount: number;
  };
  hasAmbiguousRows: boolean;
  canImportValidRows: boolean;
}

export function normalizeClassificationLabel(raw: unknown): ItemClassification {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'essencial') return 'Essencial';
  if (val === 'supérfluo' || val === 'superfluo') return 'Supérfluo';
  if (val === 'discricionário' || val === 'discricionario') return 'Discricionário';
  if (val === 'não classificado' || val === 'nao classificado') return 'Não classificado';
  return 'Essencial';
}

export function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Faz o parse estrito e seguro de valores numéricos vindos de planilhas BR/US:
 * - "1.234,56" -> 1234.56
 * - "1234,56"  -> 1234.56
 * - "1234.56"  -> 1234.56
 * - "1,234.56" -> 1234.56
 * Detecta formatos ambíguos com exatamente 3 dígitos após um único separador (ex.: "1.234" ou "1,234")
 * e exige resolução explícita do usuário antes de converter.
 * Nunca converte textos inválidos silenciosamente para zero.
 */
export function parseLocalizedNumber(
  rawInput: unknown,
  ambiguityPreference: AmbiguityPreference = 'ask'
): ParsedNumberResult {
  const raw = String(rawInput ?? '').trim();
  if (!raw) {
    return { status: 'empty', value: null, raw: '', reason: 'Valor não informado.' };
  }

  // Remove prefixos monetários e espaços internos de agrupamento mantendo sinal e separadores
  let cleaned = raw
    .replace(/R\$/gi, '')
    .replace(/\$/g, '')
    .replace(/[\u00A0\s]+/g, '')
    .trim();

  if (!cleaned) {
    return { status: 'empty', value: null, raw, reason: 'Valor vazio.' };
  }

  // Rejeita caracteres inesperados fora de dígitos, +, -, . e ,
  if (!/^[+-]?[\d.,]+$/.test(cleaned)) {
    return {
      status: 'invalid',
      value: null,
      raw,
      reason: `Formato numérico inválido: "${raw}"`,
    };
  }

  const sign = cleaned.startsWith('-') ? -1 : 1;
  cleaned = cleaned.replace(/^[+-]/, '');

  if (!/\d/.test(cleaned) || /[.,]{2,}/.test(cleaned) || /^[.,]|[.,]$/.test(cleaned)) {
    return {
      status: 'invalid',
      value: null,
      raw,
      reason: `Separadores inválidos em "${raw}"`,
    };
  }

  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  let normalizedStr = '';

  if (dotCount === 0 && commaCount === 0) {
    normalizedStr = cleaned;
  } else if (dotCount > 0 && commaCount > 0) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Padrão BR: 1.234,56 -> pontos antes da vírgula devem ser grupos de 3 dígitos
      const [intPart, decPart] = cleaned.split(',');
      if (cleaned.split(',').length !== 2 || !/^\d{1,3}(\.\d{3})+$/.test(intPart)) {
        return {
          status: 'invalid',
          value: null,
          raw,
          reason: `Agrupamento de milhar inconsistente em "${raw}"`,
        };
      }
      normalizedStr = `${intPart.replace(/\./g, '')}.${decPart}`;
    } else {
      // Padrão US: 1,234.56 -> vírgulas antes do ponto devem ser grupos de 3 dígitos
      const [intPart, decPart] = cleaned.split('.');
      if (cleaned.split('.').length !== 2 || !/^\d{1,3}(,\d{3})+$/.test(intPart)) {
        return {
          status: 'invalid',
          value: null,
          raw,
          reason: `Agrupamento de milhar inconsistente em "${raw}"`,
        };
      }
      normalizedStr = `${intPart.replace(/,/g, '')}.${decPart}`;
    }
  } else if (commaCount === 1 && dotCount === 0) {
    const [left, right] = cleaned.split(',');
    // Ex.: "1,234" ou "2,500" pode ser 1234 (US milhar) ou 1.234 (BR 3 decimais)
    if (/^\d{1,3}$/.test(left) && /^\d{3}$/.test(right)) {
      if (ambiguityPreference === 'ask') {
        return {
          status: 'ambiguous',
          value: null,
          raw,
          reason: `Valor ambíguo "${raw}" (pode significar ${left}${right} ou ${left},${right}).`,
        };
      }
      normalizedStr =
        ambiguityPreference === 'thousand' ? `${left}${right}` : `${left}.${right}`;
    } else {
      normalizedStr = `${left}.${right}`;
    }
  } else if (dotCount === 1 && commaCount === 0) {
    const [left, right] = cleaned.split('.');
    // Ex.: "1.234" ou "2.500" pode ser 1234 (BR milhar) ou 1.234 (US 3 decimais)
    if (/^\d{1,3}$/.test(left) && /^\d{3}$/.test(right)) {
      if (ambiguityPreference === 'ask') {
        return {
          status: 'ambiguous',
          value: null,
          raw,
          reason: `Valor ambíguo "${raw}" (pode significar ${left}${right} ou ${left},${right}).`,
        };
      }
      normalizedStr =
        ambiguityPreference === 'thousand' ? `${left}${right}` : `${left}.${right}`;
    } else {
      normalizedStr = `${left}.${right}`;
    }
  } else if (dotCount > 1 && commaCount === 0) {
    // Múltiplos pontos sem vírgula: ex. 1.234.567 -> separador de milhar BR
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      normalizedStr = cleaned.replace(/\./g, '');
    } else {
      return {
        status: 'invalid',
        value: null,
        raw,
        reason: `Múltiplos pontos inválidos em "${raw}"`,
      };
    }
  } else if (commaCount > 1 && dotCount === 0) {
    // Múltiplas vírgulas sem ponto: ex. 1,234,567 -> separador de milhar US
    if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
      normalizedStr = cleaned.replace(/,/g, '');
    } else {
      return {
        status: 'invalid',
        value: null,
        raw,
        reason: `Múltiplas vírgulas inválidas em "${raw}"`,
      };
    }
  }

  const parsed = Number(normalizedStr);
  if (!Number.isFinite(parsed)) {
    return {
      status: 'invalid',
      value: null,
      raw,
      reason: `Não foi possível converter "${raw}" para número.`,
    };
  }

  const signed = parsed * sign;
  if (signed < 0) {
    return {
      status: 'invalid',
      value: null,
      raw,
      reason: `Valor negativo não permitido (${raw}).`,
    };
  }

  return {
    status: 'valid',
    value: Math.round(signed * 1_000_000) / 1_000_000,
    raw,
  };
}

export function buildDuplicateSignature(item: {
  name: string;
  group?: string;
  unit?: string;
}): string {
  const norm = (s: unknown) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  return `${norm(item.name)}||${norm(item.group || 'Alimentação e bebidas')}||${norm(
    item.unit || 'unidade'
  )}`;
}

export function parseCsvForPreview(params: {
  text: string;
  existingItems: BasketItem[];
  targetProfileId: string;
  ambiguityPreference?: AmbiguityPreference;
}): CsvPreviewResult {
  const cleanText = String(params.text || '').replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error('Planilha CSV vazia ou sem linhas de dados após o cabeçalho.');
  }

  const header = lines[0];
  const delimiter: ';' | ',' =
    (header.match(/;/g) || []).length >= (header.match(/,/g) || []).length ? ';' : ',';
  const pref = params.ambiguityPreference ?? 'ask';
  const defaultOldDate = getMonthsAgoIsoDate(12);
  const defaultCurrentDate = getTodayIsoDate();
  const stamp = Date.now();

  const existingIds = new Set(
    (params.existingItems || []).filter((i) => !i.isArchived).map((i) => i.id)
  );
  const existingSignatures = new Set(
    (params.existingItems || [])
      .filter((i) => !i.isArchived)
      .map((i) => buildDuplicateSignature(i))
  );
  const seenInCsv = new Set<string>();

  const rows: CsvPreviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const rawId = (cols[0] || '').trim();
    const name = (cols[1] || cols[0] || '').trim();
    const group = (cols[2] || 'Alimentação e bebidas').trim() || 'Alimentação e bebidas';
    const classification = normalizeClassificationLabel(cols[3]);
    const rawSpend = (cols[4] || '').trim();
    const rawOldPrice = (cols[5] || '').trim();
    const rawOldDate = (cols[6] || '').trim();
    const rawCurrentPrice = (cols[7] || '').trim();
    const rawCurrentDate = (cols[8] || '').trim();
    const unit = (cols[9] || 'unidade').trim() || 'unidade';
    const notes = (cols[10] || 'Importado via planilha CSV').trim();

    if (!name && cols.every((c) => !c.trim())) {
      continue;
    }

    const issues: string[] = [];
    const ambiguousFields: string[] = [];

    if (!name) {
      issues.push('Nome do produto/serviço ausente.');
    }
    if (cols.length < 5) {
      issues.push('Linha com menos de 5 colunas obrigatórias.');
    }

    const spendRes = parseLocalizedNumber(rawSpend, pref);
    const oldRes = parseLocalizedNumber(rawOldPrice, pref);
    const curRes = parseLocalizedNumber(rawCurrentPrice, pref);

    if (spendRes.status === 'ambiguous') {
      ambiguousFields.push(`Gasto (${rawSpend})`);
    } else if (spendRes.status === 'invalid' || spendRes.status === 'empty') {
      issues.push(spendRes.reason || 'Gasto mensal ausente ou inválido.');
    }

    if (oldRes.status === 'ambiguous') {
      ambiguousFields.push(`Preço antigo (${rawOldPrice})`);
    } else if (oldRes.status === 'invalid') {
      issues.push(oldRes.reason || 'Preço antigo inválido.');
    }

    if (curRes.status === 'ambiguous') {
      ambiguousFields.push(`Preço atual (${rawCurrentPrice})`);
    } else if (curRes.status === 'invalid') {
      issues.push(curRes.reason || 'Preço atual inválido.');
    }

    // Se ambos os preços estiverem vazios e não houver gasto válido, ou se ambos vazios com gasto inválido
    const resolvedSpend = spendRes.status === 'valid' ? spendRes.value : null;
    const resolvedOld =
      oldRes.status === 'valid'
        ? oldRes.value
        : oldRes.status === 'empty'
        ? 0
        : null;
    const resolvedCur =
      curRes.status === 'valid'
        ? curRes.value
        : curRes.status === 'empty' && resolvedSpend !== null
        ? resolvedSpend
        : curRes.status === 'empty'
        ? null
        : null;

    if (curRes.status === 'empty' && resolvedSpend !== null) {
      issues.push('Preço atual não informado na coluna correspondente.');
    }

    const oldDateResolved = extractIsoDatePrefix(rawOldDate) || defaultOldDate;
    const curDateResolved = extractIsoDatePrefix(rawCurrentDate) || defaultCurrentDate;

    const sig = buildDuplicateSignature({ name, group, unit });
    const isDupExisting = Boolean(
      name && ((rawId && existingIds.has(rawId)) || existingSignatures.has(sig))
    );
    const isDupCsv = Boolean(name && seenInCsv.has(sig));

    if (name) {
      seenInCsv.add(sig);
    }

    let status: CsvPreviewRow['status'] = 'valid';
    if (issues.length > 0) {
      status = 'invalid';
    } else if (ambiguousFields.length > 0) {
      status = 'ambiguous';
    } else if (isDupExisting || isDupCsv) {
      status = 'duplicate';
      issues.push(
        isDupCsv
          ? 'Registro duplicado dentro desta própria planilha.'
          : 'Item já cadastrado na cesta atual.'
      );
    }

    let itemPayload: BasketItem | undefined;
    if (
      status === 'valid' &&
      resolvedSpend !== null &&
      resolvedOld !== null &&
      resolvedCur !== null
    ) {
      itemPayload = {
        id: rawId && /^[a-zA-Z0-9_-]{3,128}$/.test(rawId) ? rawId : `import-${stamp}-${i}`,
        profileId: params.targetProfileId,
        name,
        group,
        classification,
        monthlySpend: resolvedSpend,
        oldPrice: resolvedOld,
        currentPrice: resolvedCur,
        oldPriceDate: oldDateResolved,
        currentPriceDate: curDateResolved,
        unit,
        notes,
        dataOrigin: 'usuario',
        active: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    rows.push({
      rowNumber: i + 1,
      name: name || `(Linha ${i + 1})`,
      group,
      classification,
      monthlySpend: resolvedSpend,
      oldPrice: resolvedOld,
      currentPrice: resolvedCur,
      oldPriceDate: oldDateResolved,
      currentPriceDate: curDateResolved,
      unit,
      notes,
      rawSpend,
      rawOldPrice,
      rawCurrentPrice,
      status,
      issues,
      ambiguousFields,
      itemPayload,
    });
  }

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const ambiguousCount = rows.filter((r) => r.status === 'ambiguous').length;
  const duplicateCount = rows.filter((r) => r.status === 'duplicate').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;

  return {
    delimiter,
    rows,
    summary: {
      totalRows: rows.length,
      validCount,
      ambiguousCount,
      duplicateCount,
      invalidCount,
    },
    hasAmbiguousRows: ambiguousCount > 0,
    canImportValidRows: validCount > 0,
  };
}
