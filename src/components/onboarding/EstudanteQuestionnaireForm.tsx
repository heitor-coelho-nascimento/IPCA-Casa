import React from 'react';
import { EstudanteQuestionnaireAnswers, SurplusFrequency } from '../../types';
import {
  ESTUDANTE_CONSUMPTION_CATEGORIES,
  ESTUDANTE_EDUCATION_LEVELS,
  ESTUDANTE_EXPENSE_CATEGORIES,
  ESTUDANTE_INCOME_SOURCES,
  ESTUDANTE_INSTITUTION_TYPES,
  ESTUDANTE_LIVING_SITUATIONS,
  ESTUDANTE_STUDY_PERIODS,
  SURPLUS_FREQUENCY_LABELS,
  buildItemEntriesFromSelection,
} from '../../config/questionnaires';
import { QuestionnaireProductEditor } from './QuestionnaireProductEditor';

interface EstudanteQuestionnaireFormProps {
  step: number;
  answers: EstudanteQuestionnaireAnswers;
  onChange: (next: EstudanteQuestionnaireAnswers) => void;
  profileName: string;
  onProfileNameChange: (name: string) => void;
}

export const EstudanteQuestionnaireForm: React.FC<EstudanteQuestionnaireFormProps> = ({
  step,
  answers,
  onChange,
  profileName,
  onProfileNameChange,
}) => {
  const toggleIncomeSource = (src: string) => {
    if (src === 'Não possuo renda própria') {
      const nextFlag = !answers.hasNoOwnIncome;
      onChange({
        ...answers,
        hasNoOwnIncome: nextFlag,
        currentMonthlyIncome: nextFlag ? null : answers.currentMonthlyIncome,
        incomeSources: nextFlag ? ['Não possuo renda própria'] : [],
        incomePattern: nextFlag ? 'Não possuo renda própria' : 'Fixa',
        surplusFrequency: nextFlag ? 'sem_renda_propria' : 'as_vezes',
        reportedMonthlySurplus: nextFlag ? null : answers.reportedMonthlySurplus,
      });
      return;
    }

    const cleaned = answers.incomeSources.filter((s) => s !== 'Não possuo renda própria');
    const exists = cleaned.includes(src);
    const nextSources = exists ? cleaned.filter((s) => s !== src) : [...cleaned, src];
    onChange({
      ...answers,
      hasNoOwnIncome: false,
      incomeSources: nextSources,
    });
  };

  const toggleExpenseCategory = (cat: string) => {
    const exists = answers.selectedExpenseCategories.includes(cat);
    const nextCats = exists
      ? answers.selectedExpenseCategories.filter((c) => c !== cat)
      : [...answers.selectedExpenseCategories, cat];
    const nextEst = { ...answers.categoryEstimates };
    if (exists) delete nextEst[cat];
    onChange({
      ...answers,
      selectedExpenseCategories: nextCats,
      categoryEstimates: nextEst,
      directPaidCategories: answers.directPaidCategories.filter((c) => nextCats.includes(c)),
    });
  };

  const toggleDirectPaid = (cat: string) => {
    const exists = answers.directPaidCategories.includes(cat);
    onChange({
      ...answers,
      directPaidCategories: exists
        ? answers.directPaidCategories.filter((c) => c !== cat)
        : [...answers.directPaidCategories, cat],
    });
  };

  const toggleConsumptionCat = (catName: string) => {
    const exists = answers.selectedConsumptionCategories.includes(catName);
    const nextSelected = exists
      ? answers.selectedConsumptionCategories.filter((c) => c !== catName)
      : [...answers.selectedConsumptionCategories, catName];
    const nextEntries = buildItemEntriesFromSelection(
      nextSelected,
      answers.itemEntries,
      'estudante'
    );
    onChange({
      ...answers,
      selectedConsumptionCategories: nextSelected,
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
    !answers.hasNoOwnIncome &&
    answers.surplusFrequency !== 'nunca' &&
    answers.surplusFrequency !== 'nao_sei' &&
    answers.surplusFrequency !== 'sem_renda_propria';

  return (
    <div className="flex flex-col gap-5">
      {step === 1 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 1 — Identificação do Momento de Estudo
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Organizamos tudo sem exigir conta de luz ou aluguel se você morar com pais ou responsáveis.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#eff4ff] border border-[#c6c6cd]/60 text-[11px] text-[#0b1c30] leading-relaxed">
            <strong>Privacidade e proteção (LGPD e ECA):</strong> não pedimos CPF, RG, endereço residencial nem documentos escolares. As informações abaixo servem apenas para adaptar as categorias ao seu momento de estudos.
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#0b1c30]">Nome deste perfil</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => onProfileNameChange(e.target.value)}
              placeholder="Ex.: Meus Estudos"
              className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                1. Nível de ensino atual
              </label>
              <select
                value={answers.educationLevel}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    educationLevel: e.target
                      .value as EstudanteQuestionnaireAnswers['educationLevel'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {ESTUDANTE_EDUCATION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                2. Tipo de instituição
              </label>
              <select
                value={answers.institutionType}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    institutionType: e.target
                      .value as EstudanteQuestionnaireAnswers['institutionType'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {ESTUDANTE_INSTITUTION_TYPES.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                3. Período principal de estudo
              </label>
              <select
                value={answers.studyPeriod}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    studyPeriod: e.target.value as EstudanteQuestionnaireAnswers['studyPeriod'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {ESTUDANTE_STUDY_PERIODS.map((per) => (
                  <option key={per} value={per}>
                    {per}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                4. Onde você mora atualmente?
              </label>
              <select
                value={answers.livingSituation}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    livingSituation: e.target
                      .value as EstudanteQuestionnaireAnswers['livingSituation'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                {ESTUDANTE_LIVING_SITUATIONS.map((sit) => (
                  <option key={sit} value={sit}>
                    {sit}
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
              Etapa 2 — Renda, Mesada, Bolsa ou Sem Renda Própria
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Se você ainda não tem renda própria ou mesada, tudo bem! O IPCA-Casa acompanha apenas a evolução dos preços dos seus gastos.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-[#e5eeff] bg-[#f8f9ff]">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-[#0b1c30] cursor-pointer">
              <input
                type="checkbox"
                checked={answers.hasNoOwnIncome}
                onChange={(e) => {
                  const flag = e.target.checked;
                  onChange({
                    ...answers,
                    hasNoOwnIncome: flag,
                    currentMonthlyIncome: flag ? null : answers.currentMonthlyIncome,
                    incomeSources: flag ? ['Não possuo renda própria'] : ['Mesada'],
                    incomePattern: flag ? 'Não possuo renda própria' : 'Fixa',
                    surplusFrequency: flag ? 'sem_renda_propria' : 'as_vezes',
                    reportedMonthlySurplus: flag ? null : answers.reportedMonthlySurplus,
                  });
                }}
              />
              <span>5. Não possuo renda própria no momento (apenas acompanho os gastos)</span>
            </label>
          </div>

          {!answers.hasNoOwnIncome && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  5b. Quanto você recebe por mês somando bolsa, estágio, trabalho ou mesada? (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={answers.currentMonthlyIncome ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...answers,
                      currentMonthlyIncome:
                        e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="Ex.: 950"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  6. De onde vem essa renda ou auxílio?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ESTUDANTE_INCOME_SOURCES.map((src) => {
                    const active = answers.incomeSources.includes(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => toggleIncomeSource(src)}
                        className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          active
                            ? 'border-[#006a61] bg-[#006a61] text-[#ffffff] font-semibold'
                            : 'border-[#c6c6cd] bg-[#ffffff] text-[#45464d] hover:bg-[#eff4ff]'
                        }`}
                      >
                        {src}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                7. Há cerca de 1 ano, você possuía renda ou auxílio?
              </label>
              <select
                value={answers.incomeOneYearAgoStatus}
                onChange={(e) => {
                  const status = e.target
                    .value as EstudanteQuestionnaireAnswers['incomeOneYearAgoStatus'];
                  onChange({
                    ...answers,
                    incomeOneYearAgoStatus: status,
                    incomeOneYearAgo: status === 'informado' ? answers.incomeOneYearAgo : null,
                  });
                }}
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="informado">Sim, sei informar o valor aproximado</option>
                <option value="nao_sei">Não sei informar</option>
                <option value="nao_possuia_renda">Não possuía renda há 1 ano</option>
              </select>
            </div>

            {answers.incomeOneYearAgoStatus === 'informado' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  Valor mensal há ~1 ano (R$)
                </label>
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
                  placeholder="Ex.: 800"
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                8. Sua renda costuma ser:
              </label>
              <select
                value={answers.incomePattern}
                disabled={answers.hasNoOwnIncome}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    incomePattern: e.target.value as EstudanteQuestionnaireAnswers['incomePattern'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] disabled:opacity-60"
              >
                <option value="Fixa">Fixa</option>
                <option value="Variável">Variável</option>
                <option value="Combinação das duas">Combinação das duas</option>
                <option value="Não possuo renda própria">Não possuo renda própria</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                9. Nos últimos 12 meses, essa entrada:
              </label>
              <select
                value={answers.incomeTrend12M}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    incomeTrend12M: e.target.value as EstudanteQuestionnaireAnswers['incomeTrend12M'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Aumentou">Aumentou</option>
                <option value="Diminuiu">Diminuiu</option>
                <option value="Permaneceu igual">Permaneceu igual</option>
                <option value="Comecei recentemente">Comecei a receber recentemente</option>
                <option value="Não sei informar">Não sei informar</option>
              </select>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 3 — Gastos Estudantis e Sobra Mensal
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Selecione apenas as categorias com as quais você realmente gasta e marque quais são pagas diretamente por você.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                10. Gasto pessoal aproximado por mês (R$)
              </label>
              <input
                type="number"
                min="0"
                step="25"
                value={answers.estimatedMonthlyExpenses ?? ''}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    estimatedMonthlyExpenses:
                      e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
                placeholder="Ex.: 650 (opcional)"
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-mono tabular-nums"
              />
            </div>

            {!answers.hasNoOwnIncome && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  11. Costuma sobrar dinheiro no mês?
                </label>
                <select
                  value={answers.surplusFrequency}
                  onChange={(e) => {
                    const freq = e.target.value as SurplusFrequency;
                    onChange({
                      ...answers,
                      surplusFrequency: freq,
                      reportedMonthlySurplus:
                        freq === 'nunca' || freq === 'nao_sei' || freq === 'sem_renda_propria'
                          ? null
                          : answers.reportedMonthlySurplus,
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
            )}

            {showSurplusAmount && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#0b1c30]">
                  12. Quanto costuma sobrar (R$/mês)?
                </label>
                <input
                  type="number"
                  min="0"
                  step="25"
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

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#0b1c30]">
              13. Quais são suas principais categorias de gasto?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ESTUDANTE_EXPENSE_CATEGORIES.map((cat) => {
                const active = answers.selectedExpenseCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleExpenseCategory(cat)}
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

          {answers.selectedExpenseCategories.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#f8f9ff] border border-[#e5eeff] flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-[#0b1c30]">
                14 e 15. Valor mensal aproximado e se você paga diretamente:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {answers.selectedExpenseCategories.map((cat) => {
                  const paidDirectly = answers.directPaidCategories.includes(cat);
                  return (
                    <div
                      key={cat}
                      className="p-2.5 rounded-lg bg-[#ffffff] border border-[#e5eeff] flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs font-semibold text-[#0b1c30] truncate">{cat}</span>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-[#45464d] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paidDirectly}
                            onChange={() => toggleDirectPaid(cat)}
                          />
                          <span>Pago por mim</span>
                        </label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={answers.categoryEstimates[cat] ?? ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const next = { ...answers.categoryEstimates };
                          if (!e.target.value || !Number.isFinite(val)) delete next[cat];
                          else next[cat] = Math.max(0, val);
                          onChange({ ...answers, categoryEstimates: next });
                        }}
                        placeholder="R$/mês"
                        className="w-24 h-8 px-2 rounded border border-[#c6c6cd] text-xs font-mono tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#0b1c30] p-3 rounded-lg border border-[#e5eeff] cursor-pointer">
              <input
                type="checkbox"
                checked={answers.hasRecurringExpenses}
                onChange={(e) =>
                  onChange({ ...answers, hasRecurringExpenses: e.target.checked })
                }
              />
              <span>16. Possuo gastos fixos/recorrentes todo mês (ex.: passagem, curso, internet)</span>
            </label>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                17. Nos últimos 12 meses, esses gastos aumentaram?
              </label>
              <select
                value={answers.expensesIncreased12M}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    expensesIncreased12M: e.target
                      .value as EstudanteQuestionnaireAnswers['expensesIncreased12M'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
                <option value="Misto">Alguns subiram, outros não</option>
                <option value="Não sei informar">Não sei informar</option>
              </select>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Etapa 4 — Cesta de Consumo Estudantil
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Escolha os itens que fazem parte do seu dia a dia de estudo para monitorar variações de preço.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#0b1c30]">
              18. Selecione o que você compra ou paga com frequência:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ESTUDANTE_CONSUMPTION_CATEGORIES.map((item) => {
                const active = answers.selectedConsumptionCategories.includes(item.category);
                return (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => toggleConsumptionCat(item.category)}
                    className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      active
                        ? 'border-[#006a61] bg-[#006a61] text-[#ffffff] font-semibold'
                        : 'border-[#c6c6cd] bg-[#ffffff] text-[#45464d] hover:bg-[#eff4ff]'
                    }`}
                  >
                    {item.category}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                22. Você sabe o preço aproximado desses itens há ~1 ano?
              </label>
              <select
                value={answers.knowsOldPrices}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    knowsOldPrices: e.target
                      .value as EstudanteQuestionnaireAnswers['knowsOldPrices'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Sim">Sim</option>
                <option value="Apenas alguns">Apenas alguns</option>
                <option value="Não">Não</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0b1c30]">
                24. Frequência principal de compra/gasto
              </label>
              <select
                value={answers.purchaseFrequency}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    purchaseFrequency: e.target
                      .value as EstudanteQuestionnaireAnswers['purchaseFrequency'],
                  })
                }
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
              >
                <option value="Diariamente">Diariamente</option>
                <option value="Semanalmente">Semanalmente</option>
                <option value="Quinzenalmente">Quinzenalmente</option>
                <option value="Mensalmente">Mensalmente</option>
                <option value="Conforme a necessidade">Conforme a necessidade</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              19, 20 e 21. Itens da cesta estudantil e preços:
            </label>
            <QuestionnaireProductEditor
              mode="estudante"
              entries={answers.itemEntries}
              onChange={(entries) => onChange({ ...answers, itemEntries: entries })}
              categoryOptions={ESTUDANTE_EXPENSE_CATEGORIES}
              knowsOldPrices={answers.knowsOldPrices}
              itemLabelSingular="gasto"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              23. Quais gastos mais pesam no seu mês hoje?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {answers.selectedConsumptionCategories.map((cat) => {
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
              Etapa 5 — Configuração Final do Painel Estudantil
            </h3>
            <p className="text-xs text-[#45464d] mt-1">
              Escolha como prefere inicializar seus gastos e se deseja acompanhar a relação entre sua renda/auxílio e os preços.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-[#0b1c30]">
              25. Como deseja iniciar sua cesta estudantil?
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
                Usar minhas respostas e gastos deste questionário (Recomendado)
              </span>
              <span className="text-[11px] text-[#45464d] block mt-0.5">
                Cria sua cesta estudantil limpa apenas com o que você informou.
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
                Explorar primeiro com a cesta demonstrativa de estudante
              </span>
              <span className="text-[11px] text-[#45464d] block mt-0.5">
                Carrega um exemplo de lanches, transporte, xerox e internet para conhecer a plataforma.
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
                <strong>26. Comparar minha mesada, bolsa ou renda com o aumento dos preços</strong>
                <span className="block text-[11px] text-[#45464d]">
                  Quando não houver renda própria, o sistema mostra apenas a variação dos preços sem forçar comparação salarial.
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
                <strong>27. Acompanhar quanto os aumentos pesam no orçamento mensal</strong>
                <span className="block text-[11px] text-[#45464d]">
                  Destaca os itens que mais mudaram no mês e onde existem oportunidades de economia.
                </span>
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  );
};
