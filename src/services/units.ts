import { ConsumptionFrequency } from '../types';
import { normalizeZero } from '../utils/formatters';

export type UnitFamily = 'mass' | 'volume' | 'count' | 'energy' | 'cubic' | 'service' | 'other';

export interface UnitDefinition {
  code: string;
  label: string;
  family: UnitFamily;
  canonicalUnit: string;
  factorToCanonical: number;
}

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  kg: { code: 'kg', label: 'Quilograma (kg)', family: 'mass', canonicalUnit: 'kg', factorToCanonical: 1 },
  g: { code: 'g', label: 'Grama (g)', family: 'mass', canonicalUnit: 'kg', factorToCanonical: 0.001 },
  mg: { code: 'mg', label: 'Miligrama (mg)', family: 'mass', canonicalUnit: 'kg', factorToCanonical: 0.000001 },
  l: { code: 'L', label: 'Litro (L)', family: 'volume', canonicalUnit: 'L', factorToCanonical: 1 },
  lt: { code: 'L', label: 'Litro (L)', family: 'volume', canonicalUnit: 'L', factorToCanonical: 1 },
  litro: { code: 'L', label: 'Litro (L)', family: 'volume', canonicalUnit: 'L', factorToCanonical: 1 },
  litros: { code: 'L', label: 'Litro (L)', family: 'volume', canonicalUnit: 'L', factorToCanonical: 1 },
  ml: { code: 'ml', label: 'Mililitro (ml)', family: 'volume', canonicalUnit: 'L', factorToCanonical: 0.001 },
  un: { code: 'un', label: 'Unidade (un)', family: 'count', canonicalUnit: 'un', factorToCanonical: 1 },
  unidade: { code: 'un', label: 'Unidade (un)', family: 'count', canonicalUnit: 'un', factorToCanonical: 1 },
  unidades: { code: 'un', label: 'Unidade (un)', family: 'count', canonicalUnit: 'un', factorToCanonical: 1 },
  dz: { code: 'dz', label: 'Dúzia (12 un)', family: 'count', canonicalUnit: 'un', factorToCanonical: 12 },
  duzia: { code: 'dz', label: 'Dúzia (12 un)', family: 'count', canonicalUnit: 'un', factorToCanonical: 12 },
  dúzia: { code: 'dz', label: 'Dúzia (12 un)', family: 'count', canonicalUnit: 'un', factorToCanonical: 12 },
  kwh: { code: 'kWh', label: 'Quilowatt-hora (kWh)', family: 'energy', canonicalUnit: 'kWh', factorToCanonical: 1 },
  'm³': { code: 'm³', label: 'Metro cúbico (m³)', family: 'cubic', canonicalUnit: 'm³', factorToCanonical: 1 },
  m3: { code: 'm³', label: 'Metro cúbico (m³)', family: 'cubic', canonicalUnit: 'm³', factorToCanonical: 1 },
  mensal: { code: 'mensal', label: 'Mensal', family: 'service', canonicalUnit: 'mensal', factorToCanonical: 1 },
  anual: { code: 'anual', label: 'Anual', family: 'service', canonicalUnit: 'mensal', factorToCanonical: 1 / 12 },
  pct: { code: 'pct', label: 'Pacote', family: 'other', canonicalUnit: 'pct', factorToCanonical: 1 },
  cx: { code: 'cx', label: 'Caixa', family: 'other', canonicalUnit: 'cx', factorToCanonical: 1 },
};

export const COMMON_UNITS: Array<{ code: string; label: string }> = [
  { code: 'un', label: 'un (Unidade)' },
  { code: 'kg', label: 'kg (Quilograma)' },
  { code: 'g', label: 'g (Grama)' },
  { code: 'L', label: 'L (Litro)' },
  { code: 'ml', label: 'ml (Mililitro)' },
  { code: 'dz', label: 'dz (Dúzia — 12 un)' },
  { code: 'kWh', label: 'kWh (Energia)' },
  { code: 'm³', label: 'm³ (Metro cúbico)' },
  { code: 'mensal', label: 'mensal (Serviço/Fixo)' },
  { code: 'anual', label: 'anual (Despesa anual)' },
  { code: 'pct', label: 'pct (Pacote)' },
  { code: 'cx', label: 'cx (Caixa)' },
];

export function resolveUnitDefinition(rawUnit?: string): UnitDefinition {
  const cleaned = (rawUnit || '').trim();
  if (!cleaned) {
    return {
      code: 'un',
      label: 'Unidade (un)',
      family: 'count',
      canonicalUnit: 'un',
      factorToCanonical: 1,
    };
  }
  const lower = cleaned.toLowerCase();
  if (UNIT_DEFINITIONS[lower]) {
    return UNIT_DEFINITIONS[lower];
  }
  return {
    code: cleaned,
    label: cleaned,
    family: 'other',
    canonicalUnit: lower,
    factorToCanonical: 1,
  };
}

export function getUnitFamily(rawUnit?: string): UnitFamily {
  return resolveUnitDefinition(rawUnit).family;
}

export function areUnitsCompatible(unitA?: string, unitB?: string): boolean {
  const defA = resolveUnitDefinition(unitA);
  const defB = resolveUnitDefinition(unitB);
  if (defA.family !== defB.family) return false;
  if (defA.family === 'other') {
    return defA.canonicalUnit === defB.canonicalUnit;
  }
  return true;
}

export function convertUnitQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (!areUnitsCompatible(fromUnit, toUnit)) return null;
  const fromDef = resolveUnitDefinition(fromUnit);
  const toDef = resolveUnitDefinition(toUnit);
  if (toDef.factorToCanonical <= 0) return null;
  return normalizeZero((quantity * fromDef.factorToCanonical) / toDef.factorToCanonical);
}

export interface NormalizedUnitPriceResult {
  valid: boolean;
  normalizedPrice: number | null;
  canonicalUnit: string;
  canonicalSize: number | null;
  reason?: string;
}

/**
 * Converte preço e tamanho de embalagem para o preço por 1 unidade canônica (kg, L, un, kWh, m³).
 * Ex.: R$ 12,00 por 500 g -> R$ 24,00 / kg.
 */
export function calculateNormalizedUnitPrice(
  price: number,
  packageSize = 1,
  packageUnit = 'un'
): NormalizedUnitPriceResult {
  const def = resolveUnitDefinition(packageUnit);
  if (!Number.isFinite(price) || price < 0) {
    return {
      valid: false,
      normalizedPrice: null,
      canonicalUnit: def.canonicalUnit,
      canonicalSize: null,
      reason: 'Preço negativo ou inválido',
    };
  }
  if (!Number.isFinite(packageSize) || packageSize <= 0) {
    return {
      valid: false,
      normalizedPrice: null,
      canonicalUnit: def.canonicalUnit,
      canonicalSize: null,
      reason: 'Quantidade da embalagem deve ser maior que zero',
    };
  }
  const canonicalSize = packageSize * def.factorToCanonical;
  if (canonicalSize <= 0) {
    return {
      valid: false,
      normalizedPrice: null,
      canonicalUnit: def.canonicalUnit,
      canonicalSize: null,
      reason: 'Fator de conversão inválido',
    };
  }
  return {
    valid: true,
    normalizedPrice: normalizeZero(price / canonicalSize),
    canonicalUnit: def.canonicalUnit,
    canonicalSize: normalizeZero(canonicalSize),
  };
}

export interface NormalizedUnitComparisonResult {
  comparable: boolean;
  canonicalUnit: string;
  pricePerCanonicalA: number | null;
  pricePerCanonicalB: number | null;
  cheaperOption: 'A' | 'B' | 'empate' | null;
  unitSavingsAbsolute: number | null;
  savingsPercent: number | null;
  reason?: string;
}

export function compareNormalizedUnitPrices(
  optionA: { price: number; packageSize: number; packageUnit: string },
  optionB: { price: number; packageSize: number; packageUnit: string }
): NormalizedUnitComparisonResult {
  if (!areUnitsCompatible(optionA.packageUnit, optionB.packageUnit)) {
    return {
      comparable: false,
      canonicalUnit: `${optionA.packageUnit} vs ${optionB.packageUnit}`,
      pricePerCanonicalA: null,
      pricePerCanonicalB: null,
      cheaperOption: null,
      unitSavingsAbsolute: null,
      savingsPercent: null,
      reason: `Unidades incompatíveis (${optionA.packageUnit} não pode ser convertido para ${optionB.packageUnit})`,
    };
  }

  const normA = calculateNormalizedUnitPrice(optionA.price, optionA.packageSize, optionA.packageUnit);
  const normB = calculateNormalizedUnitPrice(optionB.price, optionB.packageSize, optionB.packageUnit);
  if (!normA.valid || !normB.valid || normA.normalizedPrice === null || normB.normalizedPrice === null) {
    return {
      comparable: false,
      canonicalUnit: normA.canonicalUnit,
      pricePerCanonicalA: normA.normalizedPrice,
      pricePerCanonicalB: normB.normalizedPrice,
      cheaperOption: null,
      unitSavingsAbsolute: null,
      savingsPercent: null,
      reason: normA.reason || normB.reason || 'Preços ou embalagens inválidos',
    };
  }

  const pA = normA.normalizedPrice;
  const pB = normB.normalizedPrice;
  const diff = Math.abs(pA - pB);
  const cheaperOption = diff < 1e-6 ? 'empate' : pA < pB ? 'A' : 'B';
  const referenceMax = Math.max(pA, pB);
  const savingsPercent = referenceMax > 0 ? normalizeZero((diff / referenceMax) * 100) : 0;

  return {
    comparable: true,
    canonicalUnit: normA.canonicalUnit,
    pricePerCanonicalA: pA,
    pricePerCanonicalB: pB,
    cheaperOption,
    unitSavingsAbsolute: normalizeZero(pA - pB),
    savingsPercent,
  };
}

export interface FrequencyNormalizationResult {
  valid: boolean;
  multiplierToMonthly: number;
  isEstimatedEquivalence: boolean;
  isThirtyDayConvention: boolean;
  isAnnualEquivalence: boolean;
  note: string;
}

/**
 * Converte frequência de consumo para fator mensal equivalente:
 * - Mensal: 1
 * - Quinzenal / personalizada em dias: 30 / dias (convenção explícita de 30 dias)
 * - Semanal: 30 / 7 (convenção explícita de 30 dias)
 * - Diária: 30 (convenção explícita de 30 dias)
 * - Anual: 1 / 12 (equivalência mensal, não cobrança efetiva mensal)
 */
export function frequencyToMonthlyMultiplier(
  frequency: ConsumptionFrequency = 'mensal',
  frequencyDays?: number
): FrequencyNormalizationResult {
  switch (frequency) {
    case 'mensal':
      return {
        valid: true,
        multiplierToMonthly: 1,
        isEstimatedEquivalence: false,
        isThirtyDayConvention: false,
        isAnnualEquivalence: false,
        note: 'Valor mensal direto (sem conversão de periodicidade)',
      };
    case 'quinzenal':
      return {
        valid: true,
        multiplierToMonthly: 30 / 15,
        isEstimatedEquivalence: true,
        isThirtyDayConvention: true,
        isAnnualEquivalence: false,
        note: 'Estimativa mensal na convenção de 30 dias (a cada 15 dias = 2,00× ao mês)',
      };
    case 'semanal':
      return {
        valid: true,
        multiplierToMonthly: 30 / 7,
        isEstimatedEquivalence: true,
        isThirtyDayConvention: true,
        isAnnualEquivalence: false,
        note: 'Estimativa mensal na convenção de 30 dias (30 ÷ 7 ≈ 4,29× ao mês)',
      };
    case 'diaria':
      return {
        valid: true,
        multiplierToMonthly: 30,
        isEstimatedEquivalence: true,
        isThirtyDayConvention: true,
        isAnnualEquivalence: false,
        note: 'Estimativa mensal na convenção de 30 dias (30× ao mês)',
      };
    case 'anual':
      return {
        valid: true,
        multiplierToMonthly: 1 / 12,
        isEstimatedEquivalence: true,
        isThirtyDayConvention: false,
        isAnnualEquivalence: true,
        note: 'Equivalência mensal estimada (Valor anual ÷ 12) — não corresponde a desembolso mensal efetivo',
      };
    case 'personalizada_dias': {
      const days = frequencyDays ?? 0;
      if (!Number.isFinite(days) || days <= 0) {
        return {
          valid: false,
          multiplierToMonthly: 0,
          isEstimatedEquivalence: false,
          isThirtyDayConvention: false,
          isAnnualEquivalence: false,
          note: 'Intervalo em dias inválido (deve ser maior que zero)',
        };
      }
      return {
        valid: true,
        multiplierToMonthly: 30 / days,
        isEstimatedEquivalence: days !== 30,
        isThirtyDayConvention: days !== 30,
        isAnnualEquivalence: false,
        note:
          days === 30
            ? 'Periodicidade de 30 dias (1,00× ao mês)'
            : `Estimativa mensal na convenção de 30 dias (30 ÷ ${days} = ${(30 / days).toFixed(2).replace('.', ',')}× ao mês)`,
      };
    }
    default:
      return {
        valid: true,
        multiplierToMonthly: 1,
        isEstimatedEquivalence: false,
        isThirtyDayConvention: false,
        isAnnualEquivalence: false,
        note: 'Valor mensal padrão',
      };
  }
}

export function normalizeSpendToMonthly(
  amountPerOccurrence: number,
  frequency: ConsumptionFrequency = 'mensal',
  frequencyDays?: number
): { monthlySpend: number; info: FrequencyNormalizationResult } {
  const info = frequencyToMonthlyMultiplier(frequency, frequencyDays);
  if (!Number.isFinite(amountPerOccurrence) || amountPerOccurrence < 0 || !info.valid) {
    return { monthlySpend: 0, info };
  }
  return {
    monthlySpend: normalizeZero(amountPerOccurrence * info.multiplierToMonthly),
    info,
  };
}
