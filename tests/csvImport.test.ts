import { describe, it, expect } from 'vitest';
import {
  buildDuplicateSignature,
  parseCsvForPreview,
  parseLocalizedNumber,
} from '../src/utils/csvImport';
import type { BasketItem } from '../src/types';

describe('Parser Numérico Localizado e Prévia de Importação CSV (IPCA-Casa)', () => {
  it('Reconhece corretamente todos os formatos BR e US exigidos na auditoria', () => {
    expect(parseLocalizedNumber('1.234,56').value).toBe(1234.56);
    expect(parseLocalizedNumber('1234,56').value).toBe(1234.56);
    expect(parseLocalizedNumber('1234.56').value).toBe(1234.56);
    expect(parseLocalizedNumber('1,234.56').value).toBe(1234.56);
    expect(parseLocalizedNumber('R$ 1.234,56').value).toBe(1234.56);
    expect(parseLocalizedNumber('1.234.567').value).toBe(1234567);
  });

  it('Detecta formatos ambíguos (ex.: 1.234 ou 1,234) e solicita confirmação explícita', () => {
    const dotAmb = parseLocalizedNumber('1.234', 'ask');
    expect(dotAmb.status).toBe('ambiguous');
    expect(dotAmb.value).toBeNull();

    const commaAmb = parseLocalizedNumber('1,234', 'ask');
    expect(commaAmb.status).toBe('ambiguous');
    expect(commaAmb.value).toBeNull();

    expect(parseLocalizedNumber('1.234', 'thousand').value).toBe(1234);
    expect(parseLocalizedNumber('1.234', 'decimal').value).toBe(1.234);
  });

  it('Nunca converte textos inválidos automaticamente para zero', () => {
    const alpha = parseLocalizedNumber('abc');
    expect(alpha.status).toBe('invalid');
    expect(alpha.value).toBeNull();

    const neg = parseLocalizedNumber('-50,00');
    expect(neg.status).toBe('invalid');
    expect(neg.value).toBeNull();

    const broken = parseLocalizedNumber('12..34');
    expect(broken.status).toBe('invalid');
    expect(broken.value).toBeNull();
  });

  it('Gera prévia completa separando válidos, ambíguos, duplicados e inválidos', () => {
    const existing: BasketItem[] = [
      {
        id: 'ex-1',
        profileId: 'p1',
        name: 'Arroz Integral',
        group: 'Alimentação e bebidas',
        classification: 'Essencial',
        monthlySpend: 120,
        oldPrice: 20,
        currentPrice: 24,
        oldPriceDate: '2026-01-01',
        currentPriceDate: '2026-10-01',
        unit: 'kg',
        active: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-10-01',
      },
    ];

    const csv = [
      'ID;Produto ou Serviço;Grupo de Consumo;Classificação;Gasto Mensal (R$);Preço Antigo (R$);Data Preço Antigo;Preço Atual (R$);Data Preço Atual;Unidade;Notas',
      ';Feijão Carioca;Alimentação e bebidas;Essencial;1.234,56;8.50;2026-01-01;9,20;2026-10-01;kg;Válido BR/US',
      ';Arroz Integral;Alimentação e bebidas;Essencial;120,00;20,00;2026-01-01;24,00;2026-10-01;kg;Duplicado existente',
      ';Café Especial;Alimentação e bebidas;Essencial;1.234;20,00;2026-01-01;25,00;2026-10-01;kg;Ambíguo',
      ';Item Inválido;Alimentação e bebidas;Essencial;nao_numero;10,00;2026-01-01;12,00;2026-10-01;un;Inválido',
    ].join('\n');

    const preview = parseCsvForPreview({
      text: csv,
      existingItems: existing,
      targetProfileId: 'p1',
      ambiguityPreference: 'ask',
    });

    expect(preview.summary.totalRows).toBe(4);
    expect(preview.summary.validCount).toBe(1);
    expect(preview.summary.duplicateCount).toBe(1);
    expect(preview.summary.ambiguousCount).toBe(1);
    expect(preview.summary.invalidCount).toBe(1);
    expect(preview.hasAmbiguousRows).toBe(true);
    expect(preview.rows[0].monthlySpend).toBe(1234.56);
    expect(preview.rows[0].oldPrice).toBe(8.5);
    expect(preview.rows[0].currentPrice).toBe(9.2);

    expect(
      buildDuplicateSignature({ name: 'Arroz  Integral', group: 'Alimentação e bebidas', unit: 'KG' })
    ).toBe(buildDuplicateSignature(existing[0]));
  });
});
