import React, { useEffect, useState } from 'react';
import { EconomicCalculationSummary, SubstitutePlanA, EfficiencyPlanB, OpportunityPlanC } from '../types';
import { DEMO_PLANS_A, DEMO_PLANS_B, DEMO_PLAN_C, StorageService } from '../services/storage';

interface SavingStrategiesViewProps {
  summary: EconomicCalculationSummary;
  isDemo: boolean;
  activeProfileId?: string;
  plansA?: SubstitutePlanA[];
  plansB?: EfficiencyPlanB[];
  planC?: OpportunityPlanC;
  onSavePlanA?: (plan: SubstitutePlanA) => void | Promise<void>;
  onSavePlanB?: (plan: EfficiencyPlanB) => void | Promise<void>;
  onNavigateTab?: (tab: any) => void;
}

function buildEffectivePlansA(
  propPlansA: SubstitutePlanA[] | undefined,
  activeProfileId: string | undefined,
  isDemo: boolean
): SubstitutePlanA[] {
  if (!propPlansA) {
    return StorageService.getPlansA();
  }
  const targetProfId = activeProfileId || 'default';
  const starter = DEMO_PLANS_A.map((tpl) => {
    const scopedId = `${tpl.id}_${targetProfId}`;
    const saved = propPlansA.find((p) => p.id === scopedId || p.id === tpl.id);
    if (saved) return saved;
    return {
      ...tpl,
      id: scopedId,
      profileId: targetProfId,
      applied: isDemo,
    };
  });
  const extras = propPlansA.filter(
    (p) => !DEMO_PLANS_A.some((tpl) => p.id === `${tpl.id}_${targetProfId}` || p.id === tpl.id)
  );
  return [...starter, ...extras];
}

function buildEffectivePlansB(
  propPlansB: EfficiencyPlanB[] | undefined,
  activeProfileId: string | undefined,
  isDemo: boolean
): EfficiencyPlanB[] {
  if (!propPlansB) {
    return StorageService.getPlansB();
  }
  const targetProfId = activeProfileId || 'default';
  const starter = DEMO_PLANS_B.map((tpl) => {
    const scopedId = `${tpl.id}_${targetProfId}`;
    const saved = propPlansB.find((p) => p.id === scopedId || p.id === tpl.id);
    if (saved) return saved;
    return {
      ...tpl,
      id: scopedId,
      profileId: targetProfId,
      applied: isDemo,
    };
  });
  const extras = propPlansB.filter(
    (p) => !DEMO_PLANS_B.some((tpl) => p.id === `${tpl.id}_${targetProfId}` || p.id === tpl.id)
  );
  return [...starter, ...extras];
}

export const SavingStrategiesView: React.FC<SavingStrategiesViewProps> = ({
  summary,
  isDemo,
  activeProfileId,
  plansA: propPlansA,
  plansB: propPlansB,
  planC: propPlanC,
  onSavePlanA,
  onSavePlanB,
  onNavigateTab,
}) => {
  const [plansA, setPlansA] = useState<SubstitutePlanA[]>(() =>
    buildEffectivePlansA(propPlansA, activeProfileId, isDemo)
  );
  const [plansB, setPlansB] = useState<EfficiencyPlanB[]>(() =>
    buildEffectivePlansB(propPlansB, activeProfileId, isDemo)
  );
  const [planC, setPlanC] = useState<OpportunityPlanC>(
    () => propPlanC ?? (isDemo ? DEMO_PLAN_C : StorageService.getPlanC())
  );
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    setPlansA(buildEffectivePlansA(propPlansA, activeProfileId, isDemo));
  }, [propPlansA, activeProfileId, isDemo]);

  useEffect(() => {
    setPlansB(buildEffectivePlansB(propPlansB, activeProfileId, isDemo));
  }, [propPlansB, activeProfileId, isDemo]);

  useEffect(() => {
    setPlanC(propPlanC ?? (isDemo ? DEMO_PLAN_C : StorageService.getPlanC()));
  }, [propPlanC, isDemo]);

  const togglePlanA = async (id: string) => {
    const updated = plansA.map((p) => (p.id === id ? { ...p, applied: !p.applied } : p));
    setPlansA(updated);
    const target = updated.find((p) => p.id === id);
    if (!target) return;
    if (onSavePlanA) {
      await onSavePlanA(target);
    } else {
      StorageService.savePlanA(target);
    }
  };

  const togglePlanB = async (id: string) => {
    const updated = plansB.map((p) => (p.id === id ? { ...p, applied: !p.applied } : p));
    setPlansB(updated);
    const target = updated.find((p) => p.id === id);
    if (!target) return;
    if (onSavePlanB) {
      await onSavePlanB(target);
    } else {
      StorageService.savePlanB(target);
    }
  };

  const handleApplyAllPlans = async () => {
    if (onSavePlanA) {
      await Promise.all(plansA.filter((p) => p.applied).map((p) => onSavePlanA(p)));
    }
    if (onSavePlanB) {
      await Promise.all(plansB.filter((p) => p.applied).map((p) => onSavePlanB(p)));
    }
    setActionNotice('Plano de Otimização sincronizado com sucesso para o ciclo atual.');
  };

  // Economia total dos planos aplicados
  const totalSavingsA = plansA.filter((p) => p.applied).reduce((acc, p) => acc + p.monthlySavings, 0);
  const totalSavingsB = plansB.filter((p) => p.applied).reduce((acc, p) => acc + p.estimatedMonthlySavings, 0);
  const totalMonthlySavings = totalSavingsA + totalSavingsB;

  // Impacto em alívio da inflação familiar
  const estimatedReliefPP =
    summary.totalMonthlySpend > 0
      ? (totalMonthlySavings / summary.totalMonthlySpend) * summary.ipcaCasa12M
      : 0;

  return (
    <div className="flex flex-col w-full">
      {/* Sub-Header / Demo Warning Strip */}
      <div className="px-6 lg:px-12 py-2.5 bg-[#eff4ff] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#e5eeff]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#006a61] animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-[#45464d] font-semibold">
            {isDemo ? 'Modo demonstração — valores didáticos' : 'Estratégias Reais Ativas'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[#45464d] font-mono text-xs">
          <span className="material-symbols-outlined text-[16px] text-[#006a61]">verified_user</span>
          <span>Simulação Ativa: {isDemo ? 'Cesta Demonstrativa (4 membros)' : 'Orçamento Familiar'}</span>
          <span className="hidden md:inline text-[#c6c6cd]">•</span>
          <span className="hidden md:inline">Algoritmo de Paridade IPCA</span>
        </div>
      </div>

      <div className="px-6 lg:px-12 py-8 flex flex-col gap-8 max-w-[1440px] mx-auto w-full">
        {/* 1. Cabeçalho de Planejamento */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex flex-col gap-1 max-w-2xl">
              <div className="flex items-center gap-2 text-[#497cff] font-mono text-xs uppercase tracking-wider font-semibold">
                <span className="material-symbols-outlined text-[18px]">balance</span>
                <span>Otimização Orçamentária & Elasticidade</span>
              </div>
              <h1 className="text-3xl font-bold text-[#0b1c30] tracking-tight">
                Estratégias de Economia Familiar
              </h1>
              <p className="text-xs text-[#45464d] leading-relaxed">
                Matriz tática de rebalanceamento da cesta de consumo para neutralização dos picos inflacionários domésticos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActionNotice('Simulações anteriores preservadas automaticamente no histórico do perfil.')
                }
                className="h-10 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-medium transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span>Histórico de Simulações</span>
              </button>
              <button
                type="button"
                onClick={handleApplyAllPlans}
                className="h-10 px-4 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-opacity flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span>Aplicar ao Plano do Mês</span>
              </button>
            </div>
          </div>

          {actionNotice && (
            <div className="p-3 bg-[#86f2e4]/20 border border-[#006a61]/30 rounded-xl text-xs font-mono text-[#005049] flex items-center justify-between">
              <span>{actionNotice}</span>
              <button type="button" onClick={() => setActionNotice(null)} className="cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* Hero KPI Banner (Bento style) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Main Highlight Card */}
            <div className="md:col-span-8 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden border border-[#eff4ff]">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">
                    Potencial Mensal Identificado
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                      R$ {totalMonthlySavings.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-[#76777d]">/ mês</span>
                  </div>
                </div>

                <div className="inline-flex flex-col items-end bg-[#86f2e4]/30 p-3 rounded-xl border border-[#006a61]/20">
                  <span className="font-mono text-[11px] text-[#006a61] uppercase tracking-wide font-semibold">
                    Alívio na Inflação Familiar
                  </span>
                  <div className="flex items-center gap-1 text-[#006a61] text-xl font-bold font-mono">
                    <span className="material-symbols-outlined text-[20px]">trending_down</span>
                    <span>-{estimatedReliefPP.toFixed(2).replace('.', ',')} p.p.</span>
                  </div>
                  <span className="text-[11px] text-[#005049] font-mono">no IPCA-Casa (12M)</span>
                </div>
              </div>

              {/* Composition Bar */}
              <div className="mt-6 flex flex-col gap-2 relative z-10">
                <div className="flex justify-between font-mono text-xs text-[#45464d]">
                  <span>Distribuição do Alívio por Pilar</span>
                  <span className="font-semibold text-[#0b1c30]">Substituições: 38% • Eficiência: 49% • Custos Fixos: 13%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#eff4ff] flex overflow-hidden">
                  <div className="h-full bg-[#006a61]" style={{ width: '38%' }} title="Bens Sucedâneos" />
                  <div className="h-full bg-[#497cff]" style={{ width: '49%' }} title="Eficiência & Consumo" />
                  <div className="h-full bg-[#565e74]" style={{ width: '13%' }} title="Custos Fixos" />
                </div>
              </div>

              {/* Metodological Notice Strip */}
              <div className="mt-4 p-3 bg-[#eff4ff] rounded-lg flex items-start gap-2 text-xs text-[#45464d] relative z-10">
                <span className="material-symbols-outlined text-[18px] text-[#497cff] shrink-0 mt-0.5">info</span>
                <p className="leading-snug">
                  <strong className="text-[#0b1c30]">Aviso metodológico:</strong> As projeções são estimativas calculadas com base nas médias e consumos informados. Resultados reais dependem de adesão aos novos hábitos e flutuações de mercado por sazonalidade.
                </p>
              </div>
            </div>

            {/* Secondary Side Card */}
            <div className="md:col-span-4 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">Cesta Familiar</span>
                  <span className="w-2 h-2 rounded-full bg-[#006a61]" />
                </div>
                <span className="text-base font-bold text-[#0b1c30]">Sensibilidade de Preços</span>
                <p className="text-xs text-[#45464d] leading-relaxed">
                  Itens da categoria <strong className="text-[#0b1c30]">Alimentação & Bebidas</strong> respondem atualmente por mais de 34% da pressão no orçamento familiar da residência.
                </p>
              </div>
              <div className="mt-4 p-3 bg-[#eff4ff] rounded-lg flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono text-[#76777d]">IPCA Família Atual</span>
                  <span className="text-lg font-bold text-[#ba1a1a] font-mono">
                    +{summary.ipcaCasa12M.toFixed(2).replace('.', ',')}%
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#76777d]">arrow_forward</span>
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-mono text-[#006a61]">IPCA Otimizado</span>
                  <span className="text-lg font-bold text-[#006a61] font-mono">
                    +{(summary.ipcaCasa12M - estimatedReliefPP).toFixed(2).replace('.', ',')}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Plano A — Substituição por Bens Sucedâneos */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center font-mono text-sm font-bold text-[#0b1c30]">
                A
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">
                  Plano A — Substituição por Bens Sucedâneos
                </h2>
                <p className="text-xs text-[#45464d]">
                  Trade-offs racionais entre marcas de referência, formatos próprios e proteínas substitutas.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#ffffff] rounded-xl shadow-sm overflow-hidden flex flex-col border border-[#eff4ff]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#eff4ff] text-[#45464d] font-mono uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Item & Hábito Atual</th>
                    <th className="py-3 px-4 font-semibold">Substituto Recomendado</th>
                    <th className="py-3 px-4 font-semibold text-right">Preço Atual</th>
                    <th className="py-3 px-4 font-semibold text-right">Novo Preço</th>
                    <th className="py-3 px-4 font-semibold text-right">Impacto Mensal</th>
                    <th className="py-3 px-4 font-semibold">Trade-off Qualitativo</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff] text-[#0b1c30]">
                  {plansA.map((plan) => (
                    <tr key={plan.id} className="hover:bg-[#eff4ff]/60 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#0b1c30]">{plan.originalItemName}</span>
                          <span className="text-[11px] text-[#76777d]">Consumo recorrente habitual</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#006a61]">{plan.substituteName}</span>
                          <span className="text-[11px] text-[#76777d]">Alternativa de mesma equivalência</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-[#76777d]">
                        R$ {plan.originalPrice.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-[#0b1c30]">
                        R$ {plan.substitutePrice.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-4 px-4 text-right font-mono">
                        <span className="font-bold px-2 py-0.5 rounded-full bg-[#86f2e4]/30 text-[#006a61] inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
                          -R$ {plan.monthlySavings.toFixed(2).replace('.', ',')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-[#45464d] max-w-xs">
                        <span className="line-clamp-2 leading-relaxed">{plan.qualitativeTradeoff}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => togglePlanA(plan.id)}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
                            plan.applied ? 'bg-[#006a61] text-[#ffffff]' : 'bg-[#eff4ff] text-[#76777d] hover:bg-[#e5eeff]'
                          }`}
                          title={plan.applied ? 'Substituição ativa (clique para pausar)' : 'Clique para aderir'}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {plan.applied ? 'check' : 'add'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[#eff4ff] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#45464d] border-t border-[#e5eeff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#006a61]">insights</span>
                <span>
                  Total economizado com Bens Sucedâneos:{' '}
                  <strong className="text-[#0b1c30]">R$ {totalSavingsA.toFixed(2).replace('.', ',')} / mês</strong>
                </span>
              </div>
              <span>{plansA.filter((p) => p.applied).length} de {plansA.length} substituições ativas</span>
            </div>
          </div>
        </section>

        {/* 3. Plano B — Eficiência e Otimização de Recursos */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center font-mono text-sm font-bold text-[#0b1c30]">
              B
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0b1c30]">
                Plano B — Eficiência e Otimização de Recursos
              </h2>
              <p className="text-xs text-[#45464d]">
                Metas de decréscimo volumétrico físico (kWh, m³ e Litros) para proteção contra tarifas e bandeiras.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plansB.map((eff) => (
              <div
                key={eff.id}
                className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between gap-4 border border-[#eff4ff]"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0b1c30] text-sm">{eff.resourceName}</span>
                    <button
                      type="button"
                      onClick={() => togglePlanB(eff.id)}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                        eff.applied ? 'bg-[#006a61] text-[#ffffff]' : 'bg-[#eff4ff] text-[#76777d]'
                      }`}
                    >
                      {eff.applied ? 'Ativo' : 'Pausado'}
                    </button>
                  </div>
                  <p className="text-xs text-[#45464d] mt-1 leading-relaxed">{eff.notes}</p>
                </div>

                <div className="p-3 bg-[#eff4ff] rounded-lg flex flex-col gap-1.5 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#76777d]">Consumo Atual:</span>
                    <span className="font-semibold text-[#0b1c30]">
                      {eff.currentConsumption} {eff.unit}/mês
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#76777d]">Meta Pactuada:</span>
                    <span className="font-semibold text-[#006a61]">
                      {eff.targetConsumption} {eff.unit} (-
                      {eff.currentConsumption > 0
                        ? (((eff.currentConsumption - eff.targetConsumption) / eff.currentConsumption) * 100).toFixed(0)
                        : '0'}
                      %)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#76777d]">Economia Estimada:</span>
                    <span className="font-bold text-[#006a61]">R$ {eff.estimatedMonthlySavings.toFixed(2).replace('.', ',')}/mês</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#76777d]">Progresso no ciclo</span>
                    <span className="font-bold text-[#0b1c30]">{eff.progressPercent}% atingido</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#eff4ff] overflow-hidden">
                    <div className="h-full bg-[#006a61] rounded-full" style={{ width: `${eff.progressPercent}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Plano C — Custo de Oportunidade e Alocação do Excedente */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center font-mono text-sm font-bold text-[#0b1c30]">
              C
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0b1c30]">
                Plano C — Custo de Oportunidade e Alocação do Excedente
              </h2>
              <p className="text-xs text-[#45464d]">
                Transformando economia de consumo em patrimônio real blindado contra a desvalorização cambial e monetária.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Destination Card */}
            <div className="lg:col-span-7 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between gap-6 border border-[#eff4ff]">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 bg-[#eff4ff] p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[24px] text-[#497cff]">savings</span>
                    <div>
                      <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">Aporte Automático Mensal</span>
                      <div className="text-xl font-bold font-mono text-[#0b1c30]">
                        R$ {totalMonthlySavings.toFixed(2).replace('.', ',')}{' '}
                        <span className="text-xs text-[#76777d] font-normal">/mês reinvestidos</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-[#86f2e4]/30 text-[#006a61] font-mono text-xs font-semibold rounded-full">
                    Destino Ativo
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold text-[#0b1c30]">
                    Reserva de Emergência em Renda Fixa Soberana
                  </h3>
                  <p className="text-xs text-[#45464d] leading-relaxed">
                    Alocação em instrumentos de liquidez diária indexados aos juros básicos: <strong>Tesouro Selic</strong> ou <strong>CDB pós-fixado a 100% do CDI</strong> com garantia do FGC.
                  </p>
                </div>

                {/* Matrix */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-[#eff4ff] rounded-lg flex flex-col">
                    <span className="font-mono text-xs text-[#45464d]">Rentabilidade Nominal</span>
                    <span className="text-base font-bold font-mono text-[#0b1c30] mt-1">{planC.nominalAnnualRate.toFixed(2)}%</span>
                    <span className="text-[11px] text-[#76777d]">ao ano</span>
                  </div>
                  <div className="p-3 bg-[#eff4ff] rounded-lg flex flex-col">
                    <span className="font-mono text-xs text-[#45464d]">Inflação Projetada</span>
                    <span className="text-base font-bold font-mono text-[#ba1a1a] mt-1">{planC.expectedAnnualInflation.toFixed(2)}%</span>
                    <span className="text-[11px] text-[#76777d]">IPCA Focus 12M</span>
                  </div>
                  <div className="p-3 bg-[#86f2e4]/20 rounded-lg flex flex-col border border-[#006a61]/20">
                    <span className="font-mono text-xs text-[#005049] font-medium">Ganho Real Estimado</span>
                    <span className="text-base font-bold font-mono text-[#006a61] mt-1">+{planC.realAnnualYield.toFixed(2)}%</span>
                    <span className="text-[11px] text-[#005049]">ao ano real</span>
                  </div>
                </div>
              </div>

              {/* Scenarios */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#eff4ff]">
                <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
                  Cenário de Acumulação Linear (com juros compostos):
                </span>
                <div className="flex items-center justify-between text-xs p-3 bg-[#eff4ff] rounded-lg font-mono">
                  <div>
                    <span className="text-[#45464d]">12 meses: </span>
                    <span className="font-bold text-[#006a61]">R$ {planC.projection12Months.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <span className="text-[#c6c6cd]">•</span>
                  <div>
                    <span className="text-[#45464d]">24 meses: </span>
                    <span className="font-bold text-[#006a61]">R$ {planC.projection24Months.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <span className="text-[#c6c6cd]">•</span>
                  <div>
                    <span className="text-[#45464d]">36 meses: </span>
                    <span className="font-bold text-[#006a61]">R$ {planC.projection36Months.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Sparkline Chart & Disclaimer */}
            <div className="lg:col-span-5 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between gap-4 border border-[#eff4ff]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">
                    Projeção de Patrimônio Acumulado
                  </span>
                  <span className="font-mono text-xs text-[#006a61] font-semibold">36 Meses</span>
                </div>
                <p className="text-xs text-[#45464d] mt-1">
                  Curva de capitalização gerada exclusivamente pela economia de despesas operacionais da casa.
                </p>
              </div>

              {/* SVG Sparkline */}
              <div className="w-full h-36 bg-[#eff4ff] rounded-lg p-3 flex items-end relative overflow-hidden border border-[#e5eeff]">
                <svg className="w-full h-full text-[#006a61]" fill="none" preserveAspectRatio="none" viewBox="0 0 300 100">
                  <defs>
                    <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#006a61" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#006a61" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,95 Q50,90 100,75 T200,45 T300,10 L300,100 L0,100 Z" fill="url(#areaGradient)" />
                  <path d="M0,95 Q50,90 100,75 T200,45 T300,10" fill="none" stroke="#006a61" strokeLinecap="round" strokeWidth="3" />
                  <circle cx="300" cy="10" fill="#006a61" r="4" />
                </svg>
                <div className="absolute top-2 right-3 font-mono font-bold text-xs text-[#006a61] bg-[#ffffff] px-2 py-0.5 rounded shadow-sm">
                  R$ {planC.projection36Months.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="absolute bottom-2 left-3 font-mono text-[10px] text-[#76777d]">
                  Mês 0: R$ 0,00
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3 bg-[#eff4ff] rounded-lg flex items-start gap-2 text-xs text-[#45464d]">
                <span className="material-symbols-outlined text-[18px] text-[#76777d] shrink-0 mt-0.5">gavel</span>
                <p className="leading-snug">
                  <strong className="text-[#0b1c30]">Aviso regulatório:</strong> Projeções financeiras passadas não garantem rentabilidade futura. Esta ferramenta é analítica voltada para otimização doméstica e não constitui consultoria de valores mobiliários.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Action Summary Sticky Strip */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 border border-[#eff4ff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#86f2e4]/40 flex items-center justify-center shrink-0 text-[#006a61]">
              <span className="material-symbols-outlined text-[24px]">task_alt</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#0b1c30]">
                Pronto para aplicar as estratégias ao seu orçamento de 2024?
              </span>
              <span className="text-xs text-[#45464d]">
                Acompanhe as compras e registre os comprovantes para verificar a redução do IPCA-Casa mês a mês.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigateTab && onNavigateTab('relatorios')}
              className="h-10 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              Exportar Metas (PDF)
            </button>
            <button
              onClick={handleApplyAllPlans}
              className="h-10 px-5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-opacity shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Salvar Plano de Otimização</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
