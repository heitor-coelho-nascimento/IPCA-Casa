import React from 'react';
import { PessoalQuestionnaireAnswers, SurplusFrequency } from '../../types';
import {
  PESSOAL_EXPENSE_CATEGORIES,
  PESSOAL_INCOME_COMPOSITIONS,
  PESSOAL_REGULAR_PRODUCTS,
  PESSOAL_SHORTFALL_BEHAVIORS,
  SURPLUS_FREQUENCY_LABELS,
  buildItemEntriesFromSelection,
} from '../../config/questionnaires';
import { QuestionnaireProductEditor } from './QuestionnaireProductEditor';

interface PessoalQuestionnaireFormProps {
  step: number;
  answers: PessoalQuestionnaireAnswers;
  onChange: (next: PessoalQuestionnaireAnswers) => void;
  profileName: string;
  onProfileNameChange: (name: string) => void;
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

export const PessoalQuestionnaireForm: React.FC<PessoalQuestionnaireFormProps> = ({
  step,
  answers,
  onChange,
  profileName,
  onProfileNameChange,
  referenceRegion,
  onReferenceRegionChange,
}) => {
  const toggleCategory = (cat: string) => {
    const exists = answers.selectedExpenseCategories.includes(cat);
    const nextCats = exists
      ? answers.selectedExpenseCategories.filter((c) => c !== cat)
      : [...answers.selectedExpenseCategories, cat];
    const nextEstimates = { ...answers.categoryEstimates };
    if (exists) {
      delete nextEstimates[cat];
    }
    onChange({
      ...answers,
      selectedExpenseCategories: nextCats,
      categoryEstimates: nextEstimates,
    });
  };

  const toggleRegularProduct = (prodName: string) => {
    const exists = answers.selectedRegularProducts.includes(prodName);
    const nextSelected = exists
      ? answers.selectedRegularProducts.filter((p) => p !== prodName)
      : [...answers.selectedRegularProducts, prodName];
    const nextEntries = buildItemEntriesFromSelection(nextSelected, answers.itemEntries, 'pessoal');
    onChange({
      ...answers,
      selectedRegularProducts: nextSelected,
      itemEntries: nextEntries,
    });
  };

  const toggleMajorDriver = (driver: string) => {
    const exists = answers.majorBudgetDrivers.includes(driver);
    onChange({
      ...answers,
      majorBudgetDrivers: exists
        ? answers.majorBudgetDrivers.filter((d) => d !== driver)
        : [...answers.majorBudgetDrivers, driver],
    });
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
              Etapa 1 — Identificação do Domicílio
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Conte como é formada a casa para adaptarmos o cálculo do orçamento familiar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                Nome deste perfil
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => onProfileNameChange(e.target.value)}
                placeholder="Ex.: Casa da Família"
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] bg-[#ffffff]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                Região para comparar com o IBGE
              </label>
              <select
                value={referenceRegion}
                onChange={(e) => onReferenceRegionChange(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] bg-[#ffffff]"
              >
                {REGIONS.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg === 'Brasil' ? 'Brasil (Média Nacional)' : reg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                1. Quantas pessoas moram na casa?
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={answers.membersCount}
                onChange={(e) =>
                  onChange({ ...answers, membersCount: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                2. Quantas contribuem com os gastos?
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={answers.contributorsCount}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    contributorsCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                3. Quantos dependentes financeiros?
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={answers.dependentsCount}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    dependentsCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              4. Como a renda da casa é composta principalmente?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PESSOAL_INCOME_COMPOSITIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange({ ...answers, primaryIncomeComposition: opt })}
                  className={`px-3 py-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                    answers.primaryIncomeComposition === opt
                      ? 'border-[#006a61] bg-[#eff4ff] font-semibold text-[#0b1c30]'
                      : 'border-[#e5eeff] bg-[#ffffff] text-[#45464d] hover:border-[#c6c6cd]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 2 — Renda Familiar Atual e Histórica
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Comparar sua renda com a inflação da casa revela se o poder de compra subiu ou caiu. Se não souber o valor exato, marque &ldquo;Não sei informar&rdquo;.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-[#e5eeff] bg-[#f8f9ff] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  5. Renda mensal total atual da casa (R$)
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#45464d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.unknownCurrentIncome}
                    onChange={(e) =>
                      onChange({
                        ...answers,
                        unknownCurrentIncome: e.target.checked,
                        currentMonthlyIncome: e.target.checked ? null : answers.currentMonthlyIncome,
                      })
                    }
                  />
                  <span>Não sei informar</span>
                </label>
              </div>
              {!answers.unknownCurrentIncome ? (
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={answers.currentMonthlyIncome ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...answers,
                      currentMonthlyIncome: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="Ex.: 4800"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30] bg-[#ffffff]"
                />
              ) : (
                <p className="text-xs text-[#76777d] py-2">
                  Sem problemas — nenhum valor será inventado para você.
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-xl border border-[#e5eeff] bg-[#f8f9ff] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  6. Renda mensal aproximada há cerca de 1 ano (R$)
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#45464d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.unknownIncomeOneYearAgo}
                    onChange={(e) =>
                      onChange({
                        ...answers,
                        unknownIncomeOneYearAgo: e.target.checked,
                        incomeOneYearAgo: e.target.checked ? null : answers.incomeOneYearAgo,
                      })
                    }
                  />
                  <span>Não sei informar</span>
                </label>
              </div>
              {!answers.unknownIncomeOneYearAgo ? (
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={answers.incomeOneYearAgo ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...answers,
                      incomeOneYearAgo: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="Ex.: 4500"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30] bg-[#ffffff]"
                />
              ) : (
                <p className="text-xs text-[#76777d] py-2">
                  O histórico de 12 meses ficará aberto para preenchimento futuro.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                7. A renda costuma ser:
              </label>
              <select
                value={answers.incomePredictability}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    incomePredictability: e.target.value as PessoalQuestionnaireAnswers['incomePredictability'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Fixa">Fixa</option>
                <option value="Variável">Variável</option>
                <option value="Combinação fixa e variável">Combinação fixa e variável</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                8. Nos últimos 12 meses, a renda:
              </label>
              <select
                value={answers.incomeTrend12M}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    incomeTrend12M: e.target.value as PessoalQuestionnaireAnswers['incomeTrend12M'],
                  })
                }
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Aumentou">Aumentou</option>
                <option value="Diminuiu">Diminuiu</option>
                <option value="Permaneceu igual">Permaneceu igual</option>
                <option value="Não sei informar">Não sei informar</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                9. Pessoas com alguma fonte de renda
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={answers.incomeEarnersCount}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    incomeEarnersCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
              />
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 3 — Sobra Mensal e Categorias de Despesa
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Separe claramente quanto costuma sobrar e em quais grupos vão os principais gastos da casa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                10. Costuma sobrar dinheiro no final do mês?
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
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
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
                  11. Quando sobra, quanto costuma sobrar por mês? (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={answers.reportedMonthlySurplus ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...answers,
                      reportedMonthlySurplus:
                        e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  placeholder="Opcional — ex.: 400"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                12. Quando não sobra, o que acontece?
              </label>
              <select
                value={answers.shortfallBehavior}
                onChange={(e) => onChange({ ...answers, shortfallBehavior: e.target.value })}
                className="h-10 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {PESSOAL_SHORTFALL_BEHAVIORS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                13. Total aproximado de gastos mensais da casa (R$)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={answers.estimatedMonthlyExpenses ?? ''}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    estimatedMonthlyExpenses:
                      e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
                placeholder="Ex.: 4100 (opcional)"
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#0b1c30]">
              14. Quais são as principais categorias de despesa da casa?
            </label>
            <div className="flex flex-wrap gap-2">
              {PESSOAL_EXPENSE_CATEGORIES.map((cat) => {
                const active = answers.selectedExpenseCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
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

          {answers.selectedExpenseCategories.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#f8f9ff] border border-[#e5eeff] flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-[#0b1c30]">
                15. Valor mensal aproximado em cada categoria marcada (opcional, em R$)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {answers.selectedExpenseCategories.map((cat) => (
                  <div key={cat} className="flex flex-col gap-1">
                    <label className="text-[11px] text-[#45464d] truncate" title={cat}>
                      {cat}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={answers.categoryEstimates[cat] ?? ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const next = { ...answers.categoryEstimates };
                        if (!e.target.value || !Number.isFinite(val)) {
                          delete next[cat];
                        } else {
                          next[cat] = Math.max(0, val);
                        }
                        onChange({ ...answers, categoryEstimates: next });
                      }}
                      placeholder="R$/mês"
                      className="h-8 px-2.5 rounded-md border border-[#c6c6cd] text-xs font-mono tabular-nums bg-[#ffffff] text-[#0b1c30]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#0b1c30]">
              16. Os gastos da casa costumam variar muito de um mês para o outro?
            </label>
            <select
              value={answers.expenseStability}
              onChange={(e) =>
                onChange({
                  ...answers,
                  expenseStability: e.target.value as PessoalQuestionnaireAnswers['expenseStability'],
                })
              }
              className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
            >
              <option value="Estáveis">Estáveis</option>
              <option value="Variam pouco">Variam pouco</option>
              <option value="Variam bastante">Variam bastante</option>
              <option value="Não sei informar">Não sei informar</option>
            </select>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 4 — Cesta de Consumo Familiar
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Escolha itens comprados com frequência e, se souber, preencha preço atual e valor aproximado de 1 ano atrás.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#0b1c30]">
              17. Selecione os produtos mais presentes nas compras da casa:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PESSOAL_REGULAR_PRODUCTS.map((prod) => {
                const active = answers.selectedRegularProducts.includes(prod.name);
                return (
                  <button
                    key={prod.name}
                    type="button"
                    onClick={() => toggleRegularProduct(prod.name)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      active
                        ? 'border-[#006a61] bg-[#006a61] text-[#ffffff] font-semibold'
                        : 'border-[#c6c6cd] bg-[#ffffff] text-[#45464d] hover:bg-[#eff4ff]'
                    }`}
                  >
                    {prod.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                18. Com que frequência a casa compra esses itens?
              </label>
              <select
                value={answers.shoppingFrequency}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    shoppingFrequency: e.target.value as PessoalQuestionnaireAnswers['shoppingFrequency'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Diariamente">Diariamente</option>
                <option value="Semanalmente">Semanalmente</option>
                <option value="Quinzenalmente">Quinzenalmente</option>
                <option value="Mensalmente">Mensalmente</option>
                <option value="Sem frequência definida">Sem frequência definida</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                21. Você sabe o preço aproximado desses itens há cerca de 1 ano?
              </label>
              <select
                value={answers.knowsOldPrices}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    knowsOldPrices: e.target.value as PessoalQuestionnaireAnswers['knowsOldPrices'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Sim">Sim</option>
                <option value="Apenas alguns">Apenas alguns</option>
                <option value="Não">Não</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              19 e 20. Quantidade e preços atuais (e de 1 ano atrás, se souber):
            </label>
            <QuestionnaireProductEditor
              mode="pessoal"
              entries={answers.itemEntries}
              onChange={(entries) => onChange({ ...answers, itemEntries: entries })}
              categoryOptions={PESSOAL_EXPENSE_CATEGORIES}
              knowsOldPrices={answers.knowsOldPrices}
              itemLabelSingular="produto"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              22. Quais itens ou categorias mais pesam no orçamento da casa?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {answers.selectedExpenseCategories.map((cat) => {
                const active = answers.majorBudgetDrivers.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleMajorDriver(cat)}
                    className={`px-2.5 py-1 rounded-md border text-[11px] cursor-pointer ${
                      active
                        ? 'border-[#0b1c30] bg-[#0b1c30] text-[#ffffff] font-semibold'
                        : 'border-[#c6c6cd] bg-[#ffffff] text-[#45464d]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 5 — Configuração Final do Painel Familiar
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Defina como sua cesta começa e quais comparações quer ver em destaque na tela inicial.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              23. Como você deseja começar a sua cesta?
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
                Usar somente minhas informações e itens deste questionário (Recomendado)
              </span>
              <span className="text-[11px] text-[#45464d] block mt-0.5">
                Cria sua cesta real e limpa com base nas suas respostas acima.
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
                Explorar primeiro com a cesta de demonstração familiar
              </span>
              <span className="text-[11px] text-[#45464d] block mt-0.5">
                Carrega exemplos claramente marcados como demonstrativos para você testar os gráficos.
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 border-t border-[#eff4ff]">
            <label className="flex items-start gap-2.5 text-xs text-[#0b1c30] cursor-pointer">
              <input
                type="checkbox"
                checked={answers.compareIncomeVsInflation}
                onChange={(e) =>
                  onChange({ ...answers, compareIncomeVsInflation: e.target.checked })
                }
                className="mt-0.5"
              />
              <span>
                <strong>24. Comparar sua renda com a variação dos seus gastos</strong>
                <span className="block text-[11px] text-[#45464d]">
                  Mostra de forma simples se o rendimento da família está acompanhando a alta dos preços.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-[#0b1c30] cursor-pointer">
              <input
                type="checkbox"
                checked={answers.trackMonthlyBudgetImpact}
                onChange={(e) =>
                  onChange({ ...answers, trackMonthlyBudgetImpact: e.target.checked })
                }
                className="mt-0.5"
              />
              <span>
                <strong>25. Acompanhar o impacto dos aumentos de preço no orçamento mensal</strong>
                <span className="block text-[11px] text-[#45464d]">
                  Destaca quanto em Reais a mudança de preços está exigindo a mais por mês.
                </span>
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  );
};
