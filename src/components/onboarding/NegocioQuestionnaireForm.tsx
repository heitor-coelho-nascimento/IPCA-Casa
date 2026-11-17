import React, { useState } from 'react';
import { NegocioQuestionnaireAnswers, SurplusFrequency } from '../../types';
import {
  NEGOCIO_COST_CATEGORIES,
  NEGOCIO_SEGMENTS,
  NEGOCIO_SHORTFALL_REASONS,
  NEGOCIO_SIZES,
  NEGOCIO_SUGGESTED_ITEMS_BY_SEGMENT,
  NEGOCIO_TENURES,
  SURPLUS_FREQUENCY_LABELS,
} from '../../config/questionnaires';
import { QuestionnaireProductEditor } from './QuestionnaireProductEditor';

interface NegocioQuestionnaireFormProps {
  step: number;
  answers: NegocioQuestionnaireAnswers;
  onChange: (next: NegocioQuestionnaireAnswers) => void;
  referenceRegion: string;
  onReferenceRegionChange: (region: string) => void;
}

const REGIONS = [
  'Brasil',
  'São Paulo - SP',
  'Rio de Janeiro - RJ',
  'Belo Horizonte - MG',
  'Porto Alegre - RS',
  'Curitiba - PR',
  'Salvador - BA',
  'Recife - PE',
  'Fortaleza - CE',
  'Brasília - DF',
  'Goiânia - GO',
  'Belém - PA',
];

export const NegocioQuestionnaireForm: React.FC<NegocioQuestionnaireFormProps> = ({
  step,
  answers,
  onChange,
  referenceRegion,
  onReferenceRegionChange,
}) => {
  const [supplierInput, setSupplierInput] = useState('');

  const toggleCostCategory = (cat: string) => {
    const exists = answers.selectedCostCategories.includes(cat);
    const nextCats = exists
      ? answers.selectedCostCategories.filter((c) => c !== cat)
      : [...answers.selectedCostCategories, cat];
    const nextEst = { ...answers.categoryEstimates };
    if (exists) delete nextEst[cat];
    onChange({
      ...answers,
      selectedCostCategories: nextCats,
      categoryEstimates: nextEst,
      fixedCostCategories: answers.fixedCostCategories.filter((c) => nextCats.includes(c)),
      variableCostCategories: answers.variableCostCategories.filter((c) => nextCats.includes(c)),
    });
  };

  const toggleFixedOrVariable = (cat: string, target: 'fixed' | 'variable') => {
    if (target === 'fixed') {
      const exists = answers.fixedCostCategories.includes(cat);
      onChange({
        ...answers,
        fixedCostCategories: exists
          ? answers.fixedCostCategories.filter((c) => c !== cat)
          : [...answers.fixedCostCategories, cat],
        variableCostCategories: answers.variableCostCategories.filter((c) => c !== cat),
      });
    } else {
      const exists = answers.variableCostCategories.includes(cat);
      onChange({
        ...answers,
        variableCostCategories: exists
          ? answers.variableCostCategories.filter((c) => c !== cat)
          : [...answers.variableCostCategories, cat],
        fixedCostCategories: answers.fixedCostCategories.filter((c) => c !== cat),
      });
    }
  };

  const handleLoadSegmentSuggestions = () => {
    const suggestions = NEGOCIO_SUGGESTED_ITEMS_BY_SEGMENT[answers.businessSegment];
    if (!suggestions) return;
    const existingNames = new Set(answers.itemEntries.map((i) => i.name.toLowerCase()));
    const additions = suggestions
      .filter((s) => !existingNames.has(s.name.toLowerCase()))
      .map((s, idx) => ({
        id: `qbiz_${Date.now()}_${idx}`,
        name: s.name,
        category: s.category,
        unit: s.unit,
        quantity: s.quantity,
        currentPrice: null,
        oldPrice: null,
      }));
    if (additions.length > 0) {
      onChange({
        ...answers,
        itemEntries: [...answers.itemEntries, ...additions],
      });
    }
  };

  const handleAddSupplier = () => {
    const clean = supplierInput.trim();
    if (!clean) return;
    if (!answers.suppliers.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      onChange({
        ...answers,
        suppliers: [...answers.suppliers, clean],
      });
    }
    setSupplierInput('');
  };

  const showSurplusAmount =
    answers.surplusFrequency !== 'nunca' &&
    answers.surplusFrequency !== 'nao_sei' &&
    answers.surplusFrequency !== 'sem_renda_propria';

  return (
    <div className="flex flex-col gap-5">
      {step === 1 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 1 — Identificação do Negócio
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Informe os dados principais da sua operação sem burocracia ou termos contábeis difíceis.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                1. Nome do negócio
              </label>
              <input
                type="text"
                value={answers.businessName}
                onChange={(e) => onChange({ ...answers, businessName: e.target.value })}
                placeholder="Ex.: Padaria do João"
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                2. Segmento de atuação
              </label>
              <select
                value={answers.businessSegment}
                onChange={(e) => onChange({ ...answers, businessSegment: e.target.value })}
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] bg-[#ffffff]"
              >
                {NEGOCIO_SEGMENTS.map((seg) => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#0b1c30]">
              3. O que a empresa faz ou vende principalmente?
            </label>
            <input
              type="text"
              value={answers.businessActivityDescription}
              onChange={(e) =>
                onChange({ ...answers, businessActivityDescription: e.target.value })
              }
              placeholder="Ex.: Pães artesanais, bolos, café da manhã e lanches"
              className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                4. Porte do negócio
              </label>
              <select
                value={answers.businessSize}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    businessSize: e.target.value as NegocioQuestionnaireAnswers['businessSize'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {NEGOCIO_SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                5. Pessoas no negócio
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={answers.workersCount}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    workersCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                6. Tempo de operação
              </label>
              <select
                value={answers.operatingTenure}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    operatingTenure: e.target.value as NegocioQuestionnaireAnswers['operatingTenure'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {NEGOCIO_TENURES.map((ten) => (
                  <option key={ten} value={ten}>
                    {ten}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                Região de referência
              </label>
              <select
                value={referenceRegion}
                onChange={(e) => onReferenceRegionChange(e.target.value)}
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {REGIONS.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg === 'Brasil' ? 'Brasil (Média Nacional)' : reg}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 2 — Faturamento Atual e Histórico
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Ajuda a comparar o ritmo das entradas com a alta nos preços de insumos e estrutura.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-[#e5eeff] bg-[#f8f9ff] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  7. Faturamento mensal aproximado atual (R$)
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#45464d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.unknownCurrentRevenue}
                    onChange={(e) =>
                      onChange({
                        ...answers,
                        unknownCurrentRevenue: e.target.checked,
                        currentMonthlyRevenue: e.target.checked
                          ? null
                          : answers.currentMonthlyRevenue,
                      })
                    }
                  />
                  <span>Não sei informar</span>
                </label>
              </div>
              {!answers.unknownCurrentRevenue ? (
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={answers.currentMonthlyRevenue ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...answers,
                      currentMonthlyRevenue:
                        e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="Ex.: 18000"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums bg-[#ffffff] text-[#0b1c30]"
                />
              ) : (
                <p className="text-xs text-[#76777d] py-2">
                  Sem problemas — nenhum faturamento fictício será criado.
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-xl border border-[#e5eeff] bg-[#f8f9ff] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  8. Faturamento mensal há cerca de 1 ano (R$)
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#45464d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.unknownRevenueOneYearAgo}
                    onChange={(e) =>
                      onChange({
                        ...answers,
                        unknownRevenueOneYearAgo: e.target.checked,
                        revenueOneYearAgo: e.target.checked ? null : answers.revenueOneYearAgo,
                      })
                    }
                  />
                  <span>Não sei informar</span>
                </label>
              </div>
              {!answers.unknownRevenueOneYearAgo ? (
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={answers.revenueOneYearAgo ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...answers,
                      revenueOneYearAgo:
                        e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="Ex.: 16500"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums bg-[#ffffff] text-[#0b1c30]"
                />
              ) : (
                <p className="text-xs text-[#76777d] py-2">
                  Comparação anual de receita ficará aguardando histórico.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                9. O faturamento mensal costuma ser:
              </label>
              <select
                value={answers.revenuePattern}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    revenuePattern: e.target.value as NegocioQuestionnaireAnswers['revenuePattern'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Fixo">Fixo</option>
                <option value="Variável">Variável</option>
                <option value="Sazonal">Sazonal</option>
                <option value="Combinação dessas opções">Combinação dessas opções</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                10. Nos últimos 12 meses, o faturamento:
              </label>
              <select
                value={answers.revenueTrend12M}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    revenueTrend12M: e.target.value as NegocioQuestionnaireAnswers['revenueTrend12M'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Aumentou">Aumentou</option>
                <option value="Diminuiu">Diminuiu</option>
                <option value="Permaneceu igual">Permaneceu igual</option>
                <option value="Grandes oscilações">Teve grandes oscilações</option>
                <option value="Não sei informar">Não sei informar</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                11. Principal origem do faturamento
              </label>
              <select
                value={answers.primaryRevenueSource}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    primaryRevenueSource: e.target
                      .value as NegocioQuestionnaireAnswers['primaryRevenueSource'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Venda de produtos">Venda de produtos</option>
                <option value="Prestação de serviços">Prestação de serviços</option>
                <option value="Produtos e serviços">Produtos e serviços</option>
                <option value="Outra">Outra</option>
              </select>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 3 — Custos, Despesas Operacionais e Sobra do Negócio
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Nota importante: quando o painel mostrar resultado estimado, ele representa apenas uma estimativa de sobra entre faturamento e custos lançados — não é lucro contábil oficial.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                12. Gasto mensal aproximado (R$)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={answers.estimatedMonthlyOperatingSpend ?? ''}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    estimatedMonthlyOperatingSpend:
                      e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
                placeholder="Ex.: 12500 (opcional)"
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                13. Costuma sobrar dinheiro após os custos?
              </label>
              <select
                value={answers.surplusFrequency}
                onChange={(e) => {
                  const freq = e.target.value as SurplusFrequency;
                  onChange({
                    ...answers,
                    surplusFrequency: freq,
                    reportedMonthlySurplus:
                      freq === 'nunca' || freq === 'nao_sei' ? null : answers.reportedMonthlySurplus,
                  });
                }}
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {(['quase_sempre', 'as_vezes', 'raramente', 'nunca', 'nao_sei'] as SurplusFrequency[]).map(
                  (freq) => (
                    <option key={freq} value={freq}>
                      {SURPLUS_FREQUENCY_LABELS[freq]}
                    </option>
                  )
                )}
              </select>
            </div>

            {showSurplusAmount && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  14. Quanto costuma sobrar (R$/mês)?
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={answers.reportedMonthlySurplus ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...answers,
                      reportedMonthlySurplus:
                        e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  placeholder="Opcional"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#0b1c30]">
              15. Quando não sobra dinheiro, qual o motivo principal?
            </label>
            <select
              value={answers.shortfallReason}
              onChange={(e) => onChange({ ...answers, shortfallReason: e.target.value })}
              className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
            >
              {NEGOCIO_SHORTFALL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#0b1c30]">
              16. Quais são as principais categorias de custo do negócio?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {NEGOCIO_COST_CATEGORIES.map((cat) => {
                const active = answers.selectedCostCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCostCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      active
                        ? 'border-[#006a61] bg-[#006a61] text-[#ffffff] font-semibold'
                        : 'border-[#c6c6cd] bg-[#ffffff] text-[#45464d] hover:bg-[#eff4ff]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {answers.selectedCostCategories.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#f8f9ff] border border-[#e5eeff] flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#0b1c30]">
                17, 18 e 19. Valor aproximado por categoria e classificação (Fixo vs Variável)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {answers.selectedCostCategories.map((cat) => {
                  const isFixed = answers.fixedCostCategories.includes(cat);
                  const isVar = answers.variableCostCategories.includes(cat);
                  return (
                    <div
                      key={cat}
                      className="p-2.5 rounded-lg bg-[#ffffff] border border-[#e5eeff] flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <span className="text-xs font-semibold text-[#0b1c30] truncate">{cat}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleFixedOrVariable(cat, 'fixed')}
                            className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                              isFixed
                                ? 'bg-[#0b1c30] text-[#ffffff] border-[#0b1c30]'
                                : 'bg-[#f8f9ff] text-[#45464d] border-[#c6c6cd]'
                            }`}
                          >
                            Fixo
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFixedOrVariable(cat, 'variable')}
                            className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                              isVar
                                ? 'bg-[#006a61] text-[#ffffff] border-[#006a61]'
                                : 'bg-[#f8f9ff] text-[#45464d] border-[#c6c6cd]'
                            }`}
                          >
                            Variável
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={answers.categoryEstimates[cat] ?? ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const next = { ...answers.categoryEstimates };
                          if (!e.target.value || !Number.isFinite(val)) delete next[cat];
                          else next[cat] = Math.max(0, val);
                          onChange({ ...answers, categoryEstimates: next });
                        }}
                        placeholder="R$/mês"
                        className="w-28 h-8 px-2 rounded border border-[#c6c6cd] text-xs font-mono tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                20. Nos últimos 12 meses, os custos operacionais subiram?
              </label>
              <select
                value={answers.operationalCostsIncreased12M}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    operationalCostsIncreased12M: e.target
                      .value as NegocioQuestionnaireAnswers['operationalCostsIncreased12M'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
                <option value="Misto">Alguns subiram, outros caíram</option>
                <option value="Não sei informar">Não sei informar</option>
              </select>
            </div>

            {(answers.operationalCostsIncreased12M === 'Sim' ||
              answers.operationalCostsIncreased12M === 'Misto') && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  21. Aumento aproximado observado (R$ ou %)
                </label>
                <input
                  type="text"
                  value={answers.operationalCostIncreaseAmount}
                  onChange={(e) =>
                    onChange({ ...answers, operationalCostIncreaseAmount: e.target.value })
                  }
                  placeholder="Ex.: +15% ou +R$ 1.200/mês"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30]"
                />
              </div>
            )}
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#0b1c30]">
                Etapa 4 — Produtos, Insumos e Fornecedores
              </h3>
              <p className="text-xs text-[#45464d] mt-1">
                Cadastre os itens críticos para o negócio e, se quiser, associe fornecedores para comparar cotações.
              </p>
            </div>
            {NEGOCIO_SUGGESTED_ITEMS_BY_SEGMENT[answers.businessSegment] && (
              <button
                type="button"
                onClick={handleLoadSegmentSuggestions}
                className="h-8 px-3 rounded-lg bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold hover:bg-[#dbe6ff] cursor-pointer"
              >
                + Sugestões para {answers.businessSegment}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                25. Sabe o preço desses itens há ~1 ano?
              </label>
              <select
                value={answers.knowsOldPrices}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    knowsOldPrices: e.target.value as NegocioQuestionnaireAnswers['knowsOldPrices'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Sim">Sim</option>
                <option value="Apenas alguns">Apenas alguns</option>
                <option value="Não">Não</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                26. Compra dos mesmos fornecedores?
              </label>
              <select
                value={answers.buysFromSameSuppliers}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    buysFromSameSuppliers: e.target
                      .value as NegocioQuestionnaireAnswers['buysFromSameSuppliers'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
                <option value="Depende do produto">Depende do produto</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                28. Frequência principal de compra
              </label>
              <select
                value={answers.purchaseFrequency}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    purchaseFrequency: e.target
                      .value as NegocioQuestionnaireAnswers['purchaseFrequency'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Diariamente">Diariamente</option>
                <option value="Semanalmente">Semanalmente</option>
                <option value="Quinzenalmente">Quinzenalmente</option>
                <option value="Mensalmente">Mensalmente</option>
                <option value="Conforme a necessidade">Conforme a necessidade</option>
              </select>
            </div>
          </div>

          {/* 27. Fornecedores opcionais */}
          <div className="p-3.5 rounded-xl border border-[#e5eeff] bg-[#f8f9ff] flex flex-col gap-2.5">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0b1c30] cursor-pointer">
              <input
                type="checkbox"
                checked={answers.wantsToRegisterSuppliers}
                onChange={(e) =>
                  onChange({ ...answers, wantsToRegisterSuppliers: e.target.checked })
                }
              />
              <span>27. Desejo cadastrar os principais fornecedores agora</span>
            </label>

            {answers.wantsToRegisterSuppliers && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={supplierInput}
                    onChange={(e) => setSupplierInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSupplier();
                      }
                    }}
                    placeholder="Nome do fornecedor ou distribuidor..."
                    className="flex-1 h-9 px-3 rounded-lg border border-[#c6c6cd] text-xs bg-[#ffffff]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSupplier}
                    className="h-9 px-3.5 rounded-lg bg-[#0b1c30] text-[#ffffff] text-xs font-semibold cursor-pointer"
                  >
                    + Fornecedor
                  </button>
                </div>
                {answers.suppliers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {answers.suppliers.map((sup) => (
                      <span
                        key={sup}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ffffff] border border-[#c6c6cd] text-xs text-[#0b1c30]"
                      >
                        <span>{sup}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              ...answers,
                              suppliers: answers.suppliers.filter((s) => s !== sup),
                            })
                          }
                          className="text-[#ba1a1a] font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              22, 23 e 24. Lista de produtos, insumos e matérias-primas compradas com frequência:
            </label>
            <QuestionnaireProductEditor
              mode="negocio"
              entries={answers.itemEntries}
              onChange={(entries) => onChange({ ...answers, itemEntries: entries })}
              categoryOptions={NEGOCIO_COST_CATEGORIES}
              knowsOldPrices={answers.knowsOldPrices}
              suppliers={answers.suppliers}
              showSupplier
              itemLabelSingular="insumo"
            />
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 5 — Configuração Final do Painel Empresarial
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Defina como iniciar sua cesta de custos operacionais e alertas do negócio.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              29. Como prefere começar o acompanhamento da empresa?
            </label>
            <button
              type="button"
              onClick={() => onChange({ ...answers, basketSetupChoice: 'propria' })}
              className={`p-3.5 rounded-xl border-2 text-left cursor-pointer ${
                answers.basketSetupChoice === 'propria'
                  ? 'border-[#006a61] bg-[#eff4ff]/80'
                  : 'border-[#e5eeff] bg-[#ffffff]'
              }`}
            >
              <span className="text-xs font-bold text-[#0b1c30] block">
                Começar com os custos e insumos informados neste questionário (Recomendado)
              </span>
              <span className="text-[11px] text-[#45464d] block mt-0.5">
                Monta sua estrutura de custos reais por fornecedor e categoria.
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChange({ ...answers, basketSetupChoice: 'demonstracao' })}
              className={`p-3.5 rounded-xl border-2 text-left cursor-pointer ${
                answers.basketSetupChoice === 'demonstracao'
                  ? 'border-[#006a61] bg-[#eff4ff]/80'
                  : 'border-[#e5eeff] bg-[#ffffff]'
              }`}
            >
              <span className="text-xs font-bold text-[#0b1c30] block">
                Explorar com cesta demonstrativa de pequeno negócio (Padaria / Comércio)
              </span>
              <span className="text-[11px] text-[#45464d] block mt-0.5">
                Carrega insumos de demonstração para testar comparações de fornecedores e impacto na margem.
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 border-t border-[#eff4ff]">
            <label className="flex items-start gap-2.5 text-xs text-[#0b1c30] cursor-pointer">
              <input
                type="checkbox"
                checked={answers.compareCostsVsRevenue}
                onChange={(e) =>
                  onChange({ ...answers, compareCostsVsRevenue: e.target.checked })
                }
                className="mt-0.5"
              />
              <span>
                <strong>30. Comparar a evolução dos custos operacionais com o faturamento</strong>
                <span className="block text-[11px] text-[#45464d]">
                  Ajuda a perceber quando os insumos estão subindo mais rápido que as entradas do negócio.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-[#0b1c30] cursor-pointer">
              <input
                type="checkbox"
                checked={answers.trackCostDrivers}
                onChange={(e) =>
                  onChange({ ...answers, trackCostDrivers: e.target.checked })
                }
                className="mt-0.5"
              />
              <span>
                <strong>31. Destacar automaticamente os insumos que mais pressionam os custos</strong>
                <span className="block text-[11px] text-[#45464d]">
                  Coloca os maiores vilões de custo no topo do resumo executivo.
                </span>
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  );
};
