import { describe, it, expect } from 'vitest';
import {
  isValidIBGERegionCode,
  parseIBGERegion,
  OFFICIAL_IBGE_REGIONS,
  buildFallbackMetadata,
  getOfficialBenchmarkForTimeframe,
} from '../src/services/ibge';

describe('Validação Rigorosa de Códigos de Região do IBGE/SIDRA', () => {
  it('Aceita o escopo nacional padrão e seus aliases oficiais', () => {
    expect(isValidIBGERegionCode('N1[all]')).toBe(true);
    expect(isValidIBGERegionCode('n1[all]')).toBe(true);
    expect(isValidIBGERegionCode('N1/all')).toBe(true);
    expect(isValidIBGERegionCode('1')).toBe(true);
    expect(isValidIBGERegionCode('BR')).toBe(true);
    expect(isValidIBGERegionCode('Brasil')).toBe(true);
  });

  it('Aceita todas as regiões metropolitanas oficiais cadastradas', () => {
    // São Paulo (RM)
    expect(isValidIBGERegionCode('3501')).toBe(true);
    expect(isValidIBGERegionCode('N7[3501]')).toBe(true);
    expect(isValidIBGERegionCode('n7/3501')).toBe(true);

    // Rio de Janeiro (RM)
    expect(isValidIBGERegionCode('3301')).toBe(true);
    expect(isValidIBGERegionCode('N7[3301]')).toBe(true);

    // Belo Horizonte (RM)
    expect(isValidIBGERegionCode('3101')).toBe(true);

    // Porto Alegre, Curitiba, Salvador, Recife, Fortaleza, Belém, Vitória
    for (const reg of OFFICIAL_IBGE_REGIONS) {
      expect(isValidIBGERegionCode(reg.id)).toBe(true);
      expect(isValidIBGERegionCode(`${reg.sidraLevel}[${reg.sidraCode}]`)).toBe(true);
      expect(isValidIBGERegionCode(`${reg.sidraLevel}/${reg.sidraCode}`)).toBe(true);
    }
  });

  it('Aceita capitais não-RM (N6) homologadas (Brasília e Goiânia)', () => {
    expect(isValidIBGERegionCode('5300108')).toBe(true); // Brasília
    expect(isValidIBGERegionCode('N6[5300108]')).toBe(true);
    expect(isValidIBGERegionCode('5208707')).toBe(true); // Goiânia
    expect(isValidIBGERegionCode('N6[5208707]')).toBe(true);
  });

  it('Rejeita códigos arbitrários, inexistentes ou malformados', () => {
    expect(isValidIBGERegionCode('9999999')).toBe(false);
    expect(isValidIBGERegionCode('0000')).toBe(false);
    expect(isValidIBGERegionCode('random-string')).toBe(false);
    expect(isValidIBGERegionCode('')).toBe(false);
    expect(isValidIBGERegionCode('   ')).toBe(false);
    expect(isValidIBGERegionCode(null)).toBe(false);
    expect(isValidIBGERegionCode(undefined)).toBe(false);
    expect(isValidIBGERegionCode(1234)).toBe(false);
    expect(isValidIBGERegionCode({})).toBe(false);
  });

  it('Rejeita tentativas de injeção e manipulação de consulta', () => {
    expect(isValidIBGERegionCode("1' OR '1'='1")).toBe(false);
    expect(isValidIBGERegionCode('N1[all]; DROP TABLE items;')).toBe(false);
    expect(isValidIBGERegionCode('../../etc/passwd')).toBe(false);
    expect(isValidIBGERegionCode('<script>alert(1)</script>')).toBe(false);
    expect(isValidIBGERegionCode('N1[all]&param=hack')).toBe(false);
    expect(isValidIBGERegionCode('A'.repeat(50))).toBe(false);
  });

  it('Faz o parse correto do escopo geográfico para o SIDRA', () => {
    const national = parseIBGERegion('N1[all]');
    expect(national.isNational).toBe(true);
    expect(national.level).toBe('n1');
    expect(national.code).toBe('all');

    const sp = parseIBGERegion('3501');
    expect(sp.isNational).toBe(false);
    expect(sp.level).toBe('n7');
    expect(sp.code).toBe('3501');
    expect(sp.regionDef.name).toContain('São Paulo');

    const bsb = parseIBGERegion('N6[5300108]');
    expect(bsb.isNational).toBe(false);
    expect(bsb.level).toBe('n6');
    expect(bsb.code).toBe('5300108');
    expect(bsb.regionDef.name).toContain('Brasília');
  });

  it('Metadados de contingência são claramente identificados e contêm 9 grupos e regionais', () => {
    const fallback = buildFallbackMetadata('Falha de conexão com o SIDRA simulada');
    expect(fallback.isContingencyData).toBe(true);
    expect(fallback.sourceMode).toBe('contingency');
    expect(fallback.source).toContain('Contingência');
    expect(fallback.lastErrorMessage).toBe('Falha de conexão com o SIDRA simulada');
    expect(fallback.groups.length).toBe(9);
    expect(fallback.groups.every((g) => g.isAvailable === true)).toBe(true);
    expect(fallback.regionals.length).toBeGreaterThanOrEqual(13);
    expect(fallback.regionals.every((r) => r.isAvailable === true)).toBe(true);
    // Brasil não é estimado de nacional, mas as RMs em contingência têm a flag
    expect(fallback.regionals.find((r) => r.id === '1')?.isEstimatedFromNational).toBe(false);
    expect(fallback.regionals.find((r) => r.id === '3501')?.isEstimatedFromNational).toBe(true);
    expect(fallback.groupsLoadedCount).toBe(9);
    expect(fallback.regionalsLoadedCount).toBeGreaterThanOrEqual(13);
    expect(fallback.dataCompleteness).toBe('contingency');
    expect(fallback.history.length).toBeGreaterThanOrEqual(24);
    expect(fallback.latestMonthCode).toBe('202610');
    expect(fallback.latestMonthLabel).toBe('Out/26');
  });

  it('Calcula benchmark oficial por janela (1M, YTD, 12M) e sinaliza séries incompletas ou ausentes', () => {
    const emptyBench = getOfficialBenchmarkForTimeframe(null, '12M');
    expect(emptyBench.isExactPeriodMatch).toBe(false);
    expect(emptyBench.rate).toBe(0);
    expect(emptyBench.completenessNote).toBeTruthy();

    const fallback = buildFallbackMetadata('Offline');
    const bench1M = getOfficialBenchmarkForTimeframe(fallback, '1M');
    expect(bench1M.rate).toBe(fallback.latestMonthlyRate);
    expect(bench1M.isExactPeriodMatch).toBe(true);

    const bench12M = getOfficialBenchmarkForTimeframe(fallback, '12M');
    expect(bench12M.isExactPeriodMatch).toBe(true);
    expect(bench12M.availableMonthsCount).toBe(12);

    const partialMeta = {
      ...fallback,
      history: fallback.history.slice(-4),
    };
    const benchIncomplete12M = getOfficialBenchmarkForTimeframe(partialMeta, '12M');
    expect(benchIncomplete12M.isExactPeriodMatch).toBe(false);
    expect(benchIncomplete12M.availableMonthsCount).toBe(4);
    expect(benchIncomplete12M.completenessNote).toContain('4 de 12');
  });
});
