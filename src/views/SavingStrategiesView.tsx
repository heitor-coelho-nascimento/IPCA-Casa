import React, { useEffect, useMemo, useState } from 'react';
import {
  EconomicCalculationSummary,
  SubstitutePlanA,
  EfficiencyPlanB,
  OpportunityPlanC,
  ProfileMode,
} from '../types';
import {
  DEMO_PLANS_A,
  DEMO_PLANS_B,
  DEMO_PLAN_C,
  StorageService,
} from '../services/storage';
import {
  calculateCompoundAnnuity,
  calculateFisherRealYield,
} from '../services/economics';
import { ConfirmModal } from '../components/ConfirmModal';
import type { NavTab } from '../components/Sidebar';
import { getProfileModeCopy } from '../utils/profileMode';

interface SavingStrategiesViewProps {
  summary: EconomicCalculationSummary;
  isDemo: boolean;
  activeProfileId?: string;
  profileMode?: ProfileMode;
  plansA?: SubstitutePlanA[];
  plansB?: EfficiencyPlanB[];
  planC?: OpportunityPlanC;
  onSavePlanA?: (plan: SubstitutePlanA) => void | Promise<void>;
  onDeletePlanA?: (planId: string) => void | Promise<void>;
  onSavePlanB?: (plan: EfficiencyPlanB) => void | Promise<void>;
  onDeletePlanB?: (planId: string) => void | Promise<void>;
  onSavePlanC?: (plan: OpportunityPlanC) => void | Promise<void>;
  onDeletePlanC?: (strategyId?: string) => void | Promise<void>;
  onNavigateTab?: (tab: NavTab) => void;
}

function formatSignedPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(decimals).replace('.', ',')}%`;
}

function formatCurrencyBR(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolvePlansA(
  propPlansA: SubstitutePlanA[] | undefined,
  activeProfileId: string | undefined,
  isDemo: boolean
): SubstitutePlanA[] {
  if (propPlansA !== undefined) {
    if (isDemo && propPlansA.length === 0) {
      return DEMO_PLANS_A.map((tpl) => ({
        ...tpl,
        profileId: activeProfileId || tpl.profileId,
      }));
    }
    return propPlansA;
  }
  const stored = StorageService.getPlansA(activeProfileId);
  if (stored.length > 0) return stored;
  return isDemo ? DEMO_PLANS_A : [];
}

function resolvePlansB(
  propPlansB: EfficiencyPlanB[] | undefined,
  activeProfileId: string | undefined,
  isDemo: boolean
): EfficiencyPlanB[] {
  if (propPlansB !== undefined) {
    if (isDemo && propPlansB.length === 0) {
      return DEMO_PLANS_B.map((tpl) => ({
        ...tpl,
        profileId: activeProfileId || tpl.profileId,
      }));
    }
    return propPlansB;
  }
  const stored = StorageService.getPlansB(activeProfileId);
  if (stored.length > 0) return stored;
  return isDemo ? DEMO_PLANS_B : [];
}

export const SavingStrategiesView: React.FC<SavingStrategiesViewProps> = ({
  summary,
  isDemo,
  activeProfileId,
  profileMode = 'pessoal',
  plansA: propPlansA,
  plansB: propPlansB,
  planC: propPlanC,
  onSavePlanA,
  onDeletePlanA,
  onSavePlanB,
  onDeletePlanB,
  onSavePlanC,
  onDeletePlanC,
  onNavigateTab,
}) => {
  const modeCopy = getProfileModeCopy(profileMode);
  const isBiz = modeCopy.mode === 'negocio';
  const targetProfId = activeProfileId || 'default';

  const [plansA, setPlansA] = useState<SubstitutePlanA[]>(() =>
    resolvePlansA(propPlansA, activeProfileId, isDemo)
  );
  const [plansB, setPlansB] = useState<EfficiencyPlanB[]>(() =>
    resolvePlansB(propPlansB, activeProfileId, isDemo)
  );

  // Estado dos parâmetros editáveis do Plano C (nunca null)
  const initialPlanCSource = propPlanC ?? (isDemo ? DEMO_PLAN_C : StorageService.getPlanC(activeProfileId));
  const [nominalAnnualRate, setNominalAnnualRate] = useState<number>(
    initialPlanCSource?.nominalAnnualRate ?? 10.5
  );
  const [expectedAnnualInflation, setExpectedAnnualInflation] = useState<number>(
    initialPlanCSource?.expectedAnnualInflation ??
      (Number.isFinite(summary.ipcaIBGE12M) && summary.ipcaIBGE12M > 0 ? Number(summary.ipcaIBGE12M.toFixed(2)) : 4.5)
  );
  const [useLinkedSavings, setUseLinkedSavings] = useState<boolean>(
    initialPlanCSource?.useLinkedSavings ?? true
  );
  const [customMonthlyDeposit, setCustomMonthlyDeposit] = useState<number>(
    initialPlanCSource?.monthlyInvestment ?? 0
  );

  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSavingBusy, setIsSavingBusy] = useState(false);

  // Modais / formulários de criação e edição de Plano A e Plano B
  const [isPlanAModalOpen, setIsPlanAModalOpen] = useState(false);
  const [editingPlanAId, setEditingPlanAId] = useState<string | null>(null);
  const [formAOriginalItemId, setFormAOriginalItemId] = useState('');
  const [formAOriginalName, setFormAOriginalName] = useState('');
  const [formAOriginalPrice, setFormAOriginalPrice] = useState('');
  const [formASubstituteName, setFormASubstituteName] = useState('');
  const [formASubstitutePrice, setFormASubstitutePrice] = useState('');
  const [formAMonthlySavings, setFormAMonthlySavings] = useState('');
  const [formATradeoff, setFormATradeoff] = useState('');
  const [formAError, setFormAError] = useState<string | null>(null);

  const [isPlanBModalOpen, setIsPlanBModalOpen] = useState(false);
  const [editingPlanBId, setEditingPlanBId] = useState<string | null>(null);
  const [formBResourceName, setFormBResourceName] = useState('');
  const [formBUnit, setFormBUnit] = useState('kWh');
  const [formBTariff, setFormBTariff] = useState('');
  const [formBCurrentCons, setFormBCurrentCons] = useState('');
  const [formBTargetCons, setFormBTargetCons] = useState('');
  const [formBProgress, setFormBProgress] = useState('0');
  const [formBNotes, setFormBNotes] = useState('');
  const [formBError, setFormBError] = useState<string | null>(null);

  // Confirmação segura (substitui window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'A'; id: string; label: string }
    | { kind: 'B'; id: string; label: string }
    | { kind: 'C'; id?: string; label: string }
    | null
  >(null);

  useEffect(() => {
    setPlansA(resolvePlansA(propPlansA, activeProfileId, isDemo));
  }, [propPlansA, activeProfileId, isDemo]);

  useEffect(() => {
    setPlansB(resolvePlansB(propPlansB, activeProfileId, isDemo));
  }, [propPlansB, activeProfileId, isDemo]);

  useEffect(() => {
    const src = propPlanC ?? (isDemo ? DEMO_PLAN_C : StorageService.getPlanC(activeProfileId));
    if (src) {
      setNominalAnnualRate(src.nominalAnnualRate);
      setExpectedAnnualInflation(src.expectedAnnualInflation);
      setUseLinkedSavings(src.useLinkedSavings ?? true);
      setCustomMonthlyDeposit(src.monthlyInvestment);
    } else {
      setNominalAnnualRate(10.5);
      setExpectedAnnualInflation(
        Number.isFinite(summary.ipcaIBGE12M) && summary.ipcaIBGE12M > 0
          ? Number(summary.ipcaIBGE12M.toFixed(2))
          : 4.5
      );
      setUseLinkedSavings(true);
      setCustomMonthlyDeposit(0);
    }
  }, [propPlanC, isDemo, activeProfileId, summary.ipcaIBGE12M]);

  const togglePlanA = async (id: string) => {
    const target = plansA.find((p) => p.id === id);
    if (!target) return;
    const toggled = { ...target, applied: !target.applied };
    setPlansA((prev) => prev.map((p) => (p.id === id ? toggled : p)));
    try {
      if (onSavePlanA) {
        await onSavePlanA(toggled);
      } else {
        StorageService.savePlanA(toggled);
      }
    } catch {
      setPlansA((prev) => prev.map((p) => (p.id === id ? target : p)));
      setActionNotice({ type: 'error', text: 'Não foi possível atualizar a substituição.' });
    }
  };

  const togglePlanB = async (id: string) => {
    const target = plansB.find((p) => p.id === id);
    if (!target) return;
    const toggled = { ...target, applied: !target.applied };
    setPlansB((prev) => prev.map((p) => (p.id === id ? toggled : p)));
    try {
      if (onSavePlanB) {
        await onSavePlanB(toggled);
      } else {
        StorageService.savePlanB(toggled);
      }
    } catch {
      setPlansB((prev) => prev.map((p) => (p.id === id ? target : p)));
      setActionNotice({ type: 'error', text: 'Não foi possível atualizar a meta de eficiência.' });
    }
  };

  const openNewPlanAModal = () => {
    setEditingPlanAId(null);
    setFormAOriginalItemId('');
    setFormAOriginalName('');
    setFormAOriginalPrice('');
    setFormASubstituteName('');
    setFormASubstitutePrice('');
    setFormAMonthlySavings('');
    setFormATradeoff('');
    setFormAError(null);
    setIsPlanAModalOpen(true);
  };

  const openEditPlanAModal = (plan: SubstitutePlanA) => {
    setEditingPlanAId(plan.id);
    setFormAOriginalItemId(plan.originalItemId || '');
    setFormAOriginalName(plan.originalItemName);
    setFormAOriginalPrice(String(plan.originalPrice));
    setFormASubstituteName(plan.substituteName);
    setFormASubstitutePrice(String(plan.substitutePrice));
    setFormAMonthlySavings(String(plan.monthlySavings));
    setFormATradeoff(plan.qualitativeTradeoff);
    setFormAError(null);
    setIsPlanAModalOpen(true);
  };

  const handleSavePlanAForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormAError(null);
    const origPrice = Number(formAOriginalPrice);
    const subPrice = Number(formASubstitutePrice);
    const explicitSavings = formAMonthlySavings.trim()
      ? Number(formAMonthlySavings)
      : Math.max(0, origPrice - subPrice);

    if (!formAOriginalName.trim() || !formASubstituteName.trim()) {
      setFormAError('Informe o nome do item atual e do substituto recomendado.');
      return;
    }
    if (!Number.isFinite(origPrice) || origPrice <= 0 || !Number.isFinite(subPrice) || subPrice < 0) {
      setFormAError('Informe preços válidos (preço atual > 0 e novo preço ≥ 0).');
      return;
    }
    if (!Number.isFinite(explicitSavings) || explicitSavings < 0) {
      setFormAError('A economia mensal deve ser maior ou igual a zero.');
      return;
    }

    const existing = editingPlanAId ? plansA.find((p) => p.id === editingPlanAId) : undefined;
    const payload: SubstitutePlanA = {
      id: editingPlanAId || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profileId: targetProfId,
      originalItemId: formAOriginalItemId || 'custom',
      originalItemName: formAOriginalName.trim(),
      originalPrice: origPrice,
      substituteName: formASubstituteName.trim(),
      substitutePrice: subPrice,
      monthlySavings: explicitSavings,
      qualitativeTradeoff: formATradeoff.trim() || 'Equivalência funcional preservada no orçamento.',
      applied: existing ? existing.applied : true,
    };

    setIsSavingBusy(true);
    try {
      if (onSavePlanA) {
        await onSavePlanA(payload);
      } else {
        StorageService.savePlanA(payload);
        setPlansA(StorageService.getPlansA(activeProfileId));
      }
      setIsPlanAModalOpen(false);
      setActionNotice({
        type: 'success',
        text: editingPlanAId
          ? `Substituição "${payload.originalItemName}" atualizada.`
          : `Substituição "${payload.originalItemName}" adicionada ao Plano A.`,
      });
    } catch {
      setFormAError('Falha ao salvar substituição. Tente novamente.');
    } finally {
      setIsSavingBusy(false);
    }
  };

  const openNewPlanBModal = () => {
    setEditingPlanBId(null);
    setFormBResourceName('');
    setFormBUnit('kWh');
    setFormBTariff('');
    setFormBCurrentCons('');
    setFormBTargetCons('');
    setFormBProgress('0');
    setFormBNotes('');
    setFormBError(null);
    setIsPlanBModalOpen(true);
  };

  const openEditPlanBModal = (plan: EfficiencyPlanB) => {
    setEditingPlanBId(plan.id);
    setFormBResourceName(plan.resourceName);
    setFormBUnit(plan.unit);
    setFormBTariff(String(plan.tariffPerUnit));
    setFormBCurrentCons(String(plan.currentConsumption));
    setFormBTargetCons(String(plan.targetConsumption));
    setFormBProgress(String(plan.progressPercent));
    setFormBNotes(plan.notes || '');
    setFormBError(null);
    setIsPlanBModalOpen(true);
  };

  const handleSavePlanBForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormBError(null);
    const tariff = Number(formBTariff);
    const currCons = Number(formBCurrentCons);
    const tgtCons = Number(formBTargetCons);
    const progress = Math.min(100, Math.max(0, Math.round(Number(formBProgress) || 0)));

    if (!formBResourceName.trim() || !formBUnit.trim()) {
      setFormBError('Informe o recurso monitorado e a unidade física.');
      return;
    }
    if (
      !Number.isFinite(tariff) ||
      tariff <= 0 ||
      !Number.isFinite(currCons) ||
      currCons <= 0 ||
      !Number.isFinite(tgtCons) ||
      tgtCons < 0
    ) {
      setFormBError('Informe tarifa e consumo atual maiores que zero.');
      return;
    }

    const currentSpend = currCons * tariff;
    const estSavings = Math.max(0, (currCons - tgtCons) * tariff);
    const existing = editingPlanBId ? plansB.find((p) => p.id === editingPlanBId) : undefined;
    const payload: EfficiencyPlanB = {
      id: editingPlanBId || `eff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profileId: targetProfId,
      resourceName: formBResourceName.trim(),
      unit: formBUnit.trim(),
      tariffPerUnit: tariff,
      currentConsumption: currCons,
      targetConsumption: tgtCons,
      currentSpend,
      estimatedMonthlySavings: estSavings,
      progressPercent: progress,
      applied: existing ? existing.applied : true,
      notes: formBNotes.trim() || 'Meta de redução física acompanhada mensalmente.',
    };

    setIsSavingBusy(true);
    try {
      if (onSavePlanB) {
        await onSavePlanB(payload);
      } else {
        StorageService.savePlanB(payload);
        setPlansB(StorageService.getPlansB(activeProfileId));
      }
      setIsPlanBModalOpen(false);
      setActionNotice({
        type: 'success',
        text: editingPlanBId
          ? `Meta "${payload.resourceName}" atualizada.`
          : `Meta "${payload.resourceName}" criada no Plano B.`,
      });
    } catch {
      setFormBError('Erro ao salvar meta de eficiência.');
    } finally {
      setIsSavingBusy(false);
    }
  };

  const handleLoadSuggestedPlanA = async () => {
    setIsSavingBusy(true);
    try {
      const cloned = DEMO_PLANS_A.map((tpl) => ({
        ...tpl,
        id: `${tpl.id}_${targetProfId}_${Date.now().toString(36)}`,
        profileId: targetProfId,
        applied: true,
      }));
      if (onSavePlanA) {
        await Promise.all(cloned.map((p) => onSavePlanA(p)));
      } else {
        cloned.forEach((p) => StorageService.savePlanA(p));
        setPlansA(StorageService.getPlansA(activeProfileId));
      }
      setActionNotice({ type: 'info', text: 'Sugestões de substituição importadas para edição livre.' });
    } finally {
      setIsSavingBusy(false);
    }
  };

  const handleLoadSuggestedPlanB = async () => {
    setIsSavingBusy(true);
    try {
      const cloned = DEMO_PLANS_B.map((tpl) => ({
        ...tpl,
        id: `${tpl.id}_${targetProfId}_${Date.now().toString(36)}`,
        profileId: targetProfId,
        applied: true,
      }));
      if (onSavePlanB) {
        await Promise.all(cloned.map((p) => onSavePlanB(p)));
      } else {
        cloned.forEach((p) => StorageService.savePlanB(p));
        setPlansB(StorageService.getPlansB(activeProfileId));
      }
      setActionNotice({ type: 'info', text: 'Metas sugeridas de consumo importadas para edição livre.' });
    } finally {
      setIsSavingBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      if (target.kind === 'A') {
        if (onDeletePlanA) {
          await onDeletePlanA(target.id);
        } else {
          StorageService.deletePlanA(target.id);
          setPlansA((prev) => prev.filter((p) => p.id !== target.id));
        }
        setActionNotice({ type: 'info', text: `Substituição "${target.label}" removida do Plano A.` });
      } else if (target.kind === 'B') {
        if (onDeletePlanB) {
          await onDeletePlanB(target.id);
        } else {
          StorageService.deletePlanB(target.id);
          setPlansB((prev) => prev.filter((p) => p.id !== target.id));
        }
        setActionNotice({ type: 'info', text: `Meta "${target.label}" removida do Plano B.` });
      } else if (target.kind === 'C') {
        if (onDeletePlanC) {
          await onDeletePlanC(target.id);
        } else {
          StorageService.deletePlanC(targetProfId);
        }
        setCustomMonthlyDeposit(0);
        setUseLinkedSavings(true);
        setActionNotice({ type: 'info', text: 'Parâmetros salvos do Plano C removidos.' });
      }
    } catch {
      setActionNotice({ type: 'error', text: 'Não foi possível remover o item selecionado.' });
    }
  };

  // Economia total dos planos aplicados
  const totalSavingsA = plansA.filter((p) => p.applied).reduce((acc, p) => acc + p.monthlySavings, 0);
  const totalSavingsB = plansB
    .filter((p) => p.applied)
    .reduce((acc, p) => acc + p.estimatedMonthlySavings, 0);
  const totalMonthlySavings = totalSavingsA + totalSavingsB;

  const pctShareA = totalMonthlySavings > 0 ? (totalSavingsA / totalMonthlySavings) * 100 : 0;
  const pctShareB = totalMonthlySavings > 0 ? (totalSavingsB / totalMonthlySavings) * 100 : 0;

  // Impacto em alívio da inflação familiar
  const estimatedReliefPP =
    summary.totalMonthlySpend > 0
      ? (totalMonthlySavings / summary.totalMonthlySpend) * summary.ipcaCasa12M
      : 0;

  // Cálculos dinâmicos do Plano C (Fisher + Juros Compostos reais)
  const effectiveMonthlyDeposit = useLinkedSavings
    ? totalMonthlySavings
    : Math.max(0, customMonthlyDeposit);
  const realAnnualYield = calculateFisherRealYield(nominalAnnualRate, expectedAnnualInflation);
  const projection12Months = calculateCompoundAnnuity(effectiveMonthlyDeposit, nominalAnnualRate, 12);
  const projection24Months = calculateCompoundAnnuity(effectiveMonthlyDeposit, nominalAnnualRate, 24);
  const projection36Months = calculateCompoundAnnuity(effectiveMonthlyDeposit, nominalAnnualRate, 36);

  const planCCurve = useMemo(() => {
    if (effectiveMonthlyDeposit <= 0 || projection36Months <= 0) return null;
    const months = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
    const pts = months.map((m) => {
      const val = calculateCompoundAnnuity(effectiveMonthlyDeposit, nominalAnnualRate, m);
      const x = (m / 36) * 300;
      const y = 95 - (val / projection36Months) * 85;
      return { m, val, x, y };
    });
    const linePath = pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L 300 100 L 0 100 Z`;
    return { linePath, areaPath };
  }, [effectiveMonthlyDeposit, nominalAnnualRate, projection36Months]);

  const topBudgetGroup = useMemo(
    () =>
      [...summary.groupContributions].sort((a, b) => b.weightPercent - a.weightPercent)[0] ||
      null,
    [summary.groupContributions]
  );

  const isPlanCSaved = Boolean(propPlanC && !propPlanC.isSimulated);

  const handleSavePlanCClick = async () => {
    const payload: OpportunityPlanC = {
      id: propPlanC?.id || `opp_${targetProfId}`,
      profileId: targetProfId,
      monthlyInvestment: effectiveMonthlyDeposit,
      nominalAnnualRate,
      expectedAnnualInflation,
      realAnnualYield,
      projection12Months,
      projection24Months,
      projection36Months,
      useLinkedSavings,
      isSimulated: false,
      updatedAt: new Date().toISOString(),
    };
    setIsSavingBusy(true);
    try {
      if (onSavePlanC) {
        await onSavePlanC(payload);
      } else {
        StorageService.savePlanC(payload);
      }
      setActionNotice({ type: 'success', text: 'Projeção de juros compostos (Plano C) salva no perfil.' });
    } catch {
      setActionNotice({ type: 'error', text: 'Erro ao salvar os parâmetros do Plano C.' });
    } finally {
      setIsSavingBusy(false);
    }
  };

  const handleApplyAllPlans = async () => {
    setIsSavingBusy(true);
    try {
      if (onSavePlanA) {
        await Promise.all(plansA.filter((p) => p.applied).map((p) => onSavePlanA(p)));
      }
      if (onSavePlanB) {
        await Promise.all(plansB.filter((p) => p.applied).map((p) => onSavePlanB(p)));
      }
      await handleSavePlanCClick();
      setActionNotice({
        type: 'success',
        text: 'Plano de Otimização (Planos A, B e C) sincronizado com sucesso!',
      });
    } finally {
      setIsSavingBusy(false);
    }
  };

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
          <span>
            Simulação Ativa:{' '}
            {isDemo ? 'Cesta Demonstrativa' : `Orçamento Familiar (${summary.totalItemsCount} itens)`}
          </span>
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
                <span>{modeCopy.badgeLabel} • Economia Prática</span>
              </div>
              <h1 className="text-3xl font-bold text-[#0b1c30] tracking-tight">
                {isBiz ? 'Estratégias de Redução de Custos' : 'Estratégias de Economia'}
              </h1>
              <p className="text-xs text-[#45464d] leading-relaxed">
                {isBiz
                  ? 'Compare troca de fornecedores ou marcas de insumos, metas de consumo de energia/água e reserva do negócio.'
                  : 'Simule trocas de produtos por preço unitário equivalente, metas de economia nas contas e quanto rende investir a diferença.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openNewPlanAModal}
                className="h-10 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-medium transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Nova Substituição</span>
              </button>
              <button
                type="button"
                onClick={handleApplyAllPlans}
                disabled={isSavingBusy}
                className="h-10 px-4 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] disabled:opacity-60 text-xs font-mono font-semibold transition-opacity flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span>{isSavingBusy ? 'Sincronizando...' : 'Aplicar ao Plano do Mês'}</span>
              </button>
            </div>
          </div>

          {actionNotice && (
            <div
              className={`p-3 rounded-xl text-xs font-mono flex items-center justify-between border ${
                actionNotice.type === 'error'
                  ? 'bg-[#ffdad6]/50 border-[#ba1a1a]/30 text-[#ba1a1a]'
                  : actionNotice.type === 'info'
                  ? 'bg-[#eff4ff] border-[#497cff]/30 text-[#0b1c30]'
                  : 'bg-[#86f2e4]/20 border-[#006a61]/30 text-[#005049]'
              }`}
            >
              <span>{actionNotice.text}</span>
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
                      {formatCurrencyBR(totalMonthlySavings)}
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
                    <span>
                      {estimatedReliefPP > 0 ? `-${estimatedReliefPP.toFixed(2).replace('.', ',')}` : '0,00'} p.p.
                    </span>
                  </div>
                  <span className="text-[11px] text-[#005049] font-mono">estimado no IPCA-Casa</span>
                </div>
              </div>

              {/* Composition Bar (100% dinâmica sobre Planos A e B aplicados) */}
              <div className="mt-6 flex flex-col gap-2 relative z-10">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 font-mono text-xs text-[#45464d]">
                  <span>Distribuição Real por Pilar Ativo</span>
                  <span className="font-semibold text-[#0b1c30]">
                    {totalMonthlySavings > 0
                      ? `Substituições (A): ${pctShareA.toFixed(0)}% • Eficiência (B): ${pctShareB.toFixed(0)}%`
                      : 'Nenhuma economia ativa selecionada'}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#eff4ff] flex overflow-hidden">
                  {totalMonthlySavings > 0 && (
                    <>
                      <div
                        className="h-full bg-[#006a61] transition-all duration-500"
                        style={{ width: `${pctShareA}%` }}
                        title={`Substituições (Plano A): ${formatCurrencyBR(totalSavingsA)}`}
                      />
                      <div
                        className="h-full bg-[#497cff] transition-all duration-500"
                        style={{ width: `${pctShareB}%` }}
                        title={`Eficiência (Plano B): ${formatCurrencyBR(totalSavingsB)}`}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Metodological Notice Strip */}
              <div className="mt-4 p-3 bg-[#eff4ff] rounded-lg flex items-start gap-2 text-xs text-[#45464d] relative z-10">
                <span className="material-symbols-outlined text-[18px] text-[#497cff] shrink-0 mt-0.5">info</span>
                <p className="leading-snug">
                  <strong className="text-[#0b1c30]">Aviso metodológico:</strong> As projeções são estimativas calculadas com base nas substituições e reduções de consumo informadas no seu perfil.
                </p>
              </div>
            </div>

            {/* Secondary Side Card */}
            <div className="md:col-span-4 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">
                    {isBiz ? 'Estrutura de Custos' : 'Cesta de Gastos'}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#006a61]" />
                </div>
                <span className="text-base font-bold text-[#0b1c30]">Onde Focar Primeiro</span>
                <p className="text-xs text-[#45464d] leading-relaxed">
                  {topBudgetGroup ? (
                    <>
                      O grupo <strong className="text-[#0b1c30]">{topBudgetGroup.group}</strong> concentra atualmente{' '}
                      <strong className="text-[#0b1c30]">
                        {topBudgetGroup.weightPercent.toFixed(1).replace('.', ',')}%
                      </strong>{' '}
                      do total cadastrado no seu perfil.
                    </>
                  ) : (
                    `Cadastre itens em ${modeCopy.basketNavLabel} para identificar onde estão os maiores pesos do orçamento.`
                  )}
                </p>
              </div>
              <div className="mt-4 p-3 bg-[#eff4ff] rounded-lg flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono text-[#76777d]">{modeCopy.inflationLabel}</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      summary.ipcaCasa12M < 0 ? 'text-[#006a61]' : 'text-[#ba1a1a]'
                    }`}
                  >
                    {formatSignedPercent(summary.ipcaCasa12M)}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#76777d]">arrow_forward</span>
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-mono text-[#006a61]">IPCA Otimizado</span>
                  <span className="text-lg font-bold text-[#006a61] font-mono">
                    {formatSignedPercent(summary.ipcaCasa12M - estimatedReliefPP)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Plano A — Substituição por Bens Sucedâneos */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center font-mono text-sm font-bold text-[#0b1c30]">
                A
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">
                  Plano A — Substituição por Bens Sucedâneos
                </h2>
                <p className="text-xs text-[#45464d]">
                  Trade-offs racionais entre marcas de referência, formatos próprios e alternativas equivalentes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isDemo && plansA.length === 0 && (
                <button
                  type="button"
                  onClick={handleLoadSuggestedPlanA}
                  disabled={isSavingBusy}
                  className="h-9 px-3 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] font-mono text-xs font-medium cursor-pointer"
                >
                  Carregar Sugestões
                </button>
              )}
              <button
                type="button"
                onClick={openNewPlanAModal}
                className="h-9 px-3.5 rounded-lg bg-[#000000] hover:bg-[#213145] text-[#ffffff] font-mono text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Adicionar</span>
              </button>
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
                    <th className="py-3 px-4 font-semibold text-center">Ações / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff] text-[#0b1c30]">
                  {plansA.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 px-4 text-center text-xs text-[#76777d]">
                        Nenhuma substituição cadastrada neste perfil ainda. Clique em{' '}
                        <strong className="text-[#0b1c30]">Adicionar</strong> para registrar uma troca ou{' '}
                        <strong className="text-[#0b1c30]">Carregar Sugestões</strong> para iniciar com exemplos editáveis.
                      </td>
                    </tr>
                  ) : (
                    plansA.map((plan) => (
                      <tr key={plan.id} className="hover:bg-[#eff4ff]/60 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#0b1c30]">{plan.originalItemName}</span>
                            <span className="text-[11px] text-[#76777d]">Consumo recorrente</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#006a61]">{plan.substituteName}</span>
                            <span className="text-[11px] text-[#76777d]">Alternativa equivalente</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-[#76777d]">
                          {formatCurrencyBR(plan.originalPrice)}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-[#0b1c30]">
                          {formatCurrencyBR(plan.substitutePrice)}
                        </td>
                        <td className="py-4 px-4 text-right font-mono">
                          <span className="font-bold px-2 py-0.5 rounded-full bg-[#86f2e4]/30 text-[#006a61] inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
                            -{formatCurrencyBR(plan.monthlySavings)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[#45464d] max-w-xs">
                          <span className="line-clamp-2 leading-relaxed">{plan.qualitativeTradeoff}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => togglePlanA(plan.id)}
                              className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
                                plan.applied
                                  ? 'bg-[#006a61] text-[#ffffff]'
                                  : 'bg-[#eff4ff] text-[#76777d] hover:bg-[#e5eeff]'
                              }`}
                              title={plan.applied ? 'Substituição ativa (clique para pausar)' : 'Clique para ativar'}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {plan.applied ? 'check' : 'add'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditPlanAModal(plan)}
                              className="w-8 h-8 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] inline-flex items-center justify-center cursor-pointer"
                              title="Editar substituição"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({ kind: 'A', id: plan.id, label: plan.originalItemName })
                              }
                              className="w-8 h-8 rounded-lg bg-[#ffdad6]/40 hover:bg-[#ffdad6] text-[#ba1a1a] inline-flex items-center justify-center cursor-pointer"
                              title="Excluir substituição"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[#eff4ff] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#45464d] border-t border-[#e5eeff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#006a61]">insights</span>
                <span>
                  Total economizado com Bens Sucedâneos:{' '}
                  <strong className="text-[#0b1c30]">{formatCurrencyBR(totalSavingsA)} / mês</strong>
                </span>
              </div>
              <span>
                {plansA.filter((p) => p.applied).length} de {plansA.length} substituições ativas
              </span>
            </div>
          </div>
        </section>

        {/* 3. Plano B — Eficiência e Otimização de Recursos */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
            <div className="flex items-center gap-2">
              {!isDemo && plansB.length === 0 && (
                <button
                  type="button"
                  onClick={handleLoadSuggestedPlanB}
                  disabled={isSavingBusy}
                  className="h-9 px-3 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] font-mono text-xs font-medium cursor-pointer"
                >
                  Carregar Sugestões
                </button>
              )}
              <button
                type="button"
                onClick={openNewPlanBModal}
                className="h-9 px-3.5 rounded-lg bg-[#000000] hover:bg-[#213145] text-[#ffffff] font-mono text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Nova Meta</span>
              </button>
            </div>
          </div>

          {plansB.length === 0 ? (
            <div className="bg-[#ffffff] rounded-xl p-8 border border-dashed border-[#c6c6cd] text-center text-xs text-[#76777d]">
              Nenhuma meta de eficiência energética ou física cadastrada neste perfil. Crie sua primeira meta clicando em{' '}
              <strong className="text-[#0b1c30]">Nova Meta</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plansB.map((eff) => {
                const reductionPct =
                  eff.currentConsumption > 0
                    ? ((eff.currentConsumption - eff.targetConsumption) / eff.currentConsumption) * 100
                    : 0;
                return (
                  <div
                    key={eff.id}
                    className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between gap-4 border border-[#eff4ff]"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#0b1c30] text-sm truncate">{eff.resourceName}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => togglePlanB(eff.id)}
                            className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                              eff.applied ? 'bg-[#006a61] text-[#ffffff]' : 'bg-[#eff4ff] text-[#76777d]'
                            }`}
                          >
                            {eff.applied ? 'Ativo' : 'Pausado'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPlanBModal(eff)}
                            className="w-7 h-7 rounded bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] inline-flex items-center justify-center cursor-pointer"
                            title="Editar meta"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ kind: 'B', id: eff.id, label: eff.resourceName })
                            }
                            className="w-7 h-7 rounded bg-[#ffdad6]/40 hover:bg-[#ffdad6] text-[#ba1a1a] inline-flex items-center justify-center cursor-pointer"
                            title="Excluir meta"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
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
                          {eff.targetConsumption} {eff.unit} ({formatSignedPercent(-reductionPct, 0)})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#76777d]">Economia Estimada:</span>
                        <span className="font-bold text-[#006a61]">
                          {formatCurrencyBR(eff.estimatedMonthlySavings)}/mês
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-xs">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="text-[#76777d]">Progresso no ciclo</span>
                        <span className="font-bold text-[#0b1c30]">{eff.progressPercent}% atingido</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#eff4ff] overflow-hidden">
                        <div
                          className="h-full bg-[#006a61] rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, eff.progressPercent))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. Plano C — Custo de Oportunidade e Alocação do Excedente (Fisher + Juros Compostos Reais) */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center font-mono text-sm font-bold text-[#0b1c30]">
                C
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">
                  Plano C — Custo de Oportunidade e Alocação do Excedente
                </h2>
                <p className="text-xs text-[#45464d]">
                  Transformando economia de consumo em reserva real calculada pela Equação de Fisher e juros compostos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold ${
                  isPlanCSaved
                    ? 'bg-[#86f2e4]/30 text-[#006a61]'
                    : 'bg-[#eff4ff] text-[#45464d]'
                }`}
              >
                {isPlanCSaved ? 'Salvo no Perfil' : 'Simulação Dinâmica'}
              </span>
              {isPlanCSaved && (
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      kind: 'C',
                      id: propPlanC?.id,
                      label: 'Alocação do Plano C',
                    })
                  }
                  className="h-8 px-3 rounded-lg bg-[#ffdad6]/40 hover:bg-[#ffdad6] text-[#ba1a1a] font-mono text-xs font-semibold cursor-pointer"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Interactive Parameters + Calculated Matrix */}
            <div className="lg:col-span-7 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between gap-5 border border-[#eff4ff]">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#eff4ff] p-3.5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[24px] text-[#497cff]">savings</span>
                    <div>
                      <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
                        Aporte Mensal Projetado
                      </span>
                      <div className="text-xl font-bold font-mono text-[#0b1c30]">
                        {formatCurrencyBR(effectiveMonthlyDeposit)}{' '}
                        <span className="text-xs text-[#76777d] font-normal">/mês reinvestidos</span>
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-mono text-[#0b1c30] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useLinkedSavings}
                      onChange={(e) => setUseLinkedSavings(e.target.checked)}
                      className="accent-[#006a61]"
                    />
                    <span>Vincular aos Planos A + B</span>
                  </label>
                </div>

                {/* Inputs editáveis de taxa e aporte manual */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[11px] text-[#45464d] uppercase font-semibold">
                      Aporte Manual (R$/mês)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      disabled={useLinkedSavings}
                      value={useLinkedSavings ? Number(totalMonthlySavings.toFixed(2)) : customMonthlyDeposit}
                      onChange={(e) => setCustomMonthlyDeposit(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-9 px-3 rounded-lg bg-[#eff4ff] disabled:opacity-60 font-mono text-xs font-semibold text-[#0b1c30] focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[11px] text-[#45464d] uppercase font-semibold">
                      Taxa Nominal (% a.a.)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={nominalAnnualRate}
                      onChange={(e) => setNominalAnnualRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-9 px-3 rounded-lg bg-[#eff4ff] font-mono text-xs font-semibold text-[#0b1c30] focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[11px] text-[#45464d] uppercase font-semibold">
                      Inflação Esperada (% a.a.)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={expectedAnnualInflation}
                      onChange={(e) => setExpectedAnnualInflation(parseFloat(e.target.value) || 0)}
                      className="h-9 px-3 rounded-lg bg-[#eff4ff] font-mono text-xs font-semibold text-[#0b1c30] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Matrix */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-[#eff4ff] rounded-lg flex flex-col">
                    <span className="font-mono text-xs text-[#45464d]">Rentabilidade Nominal</span>
                    <span className="text-base font-bold font-mono text-[#0b1c30] mt-1">
                      {nominalAnnualRate.toFixed(2).replace('.', ',')}%
                    </span>
                    <span className="text-[11px] text-[#76777d]">ao ano (Selic/CDI)</span>
                  </div>
                  <div className="p-3 bg-[#eff4ff] rounded-lg flex flex-col">
                    <span className="font-mono text-xs text-[#45464d]">Inflação Projetada</span>
                    <span className="text-base font-bold font-mono text-[#ba1a1a] mt-1">
                      {expectedAnnualInflation.toFixed(2).replace('.', ',')}%
                    </span>
                    <span className="text-[11px] text-[#76777d]">ao ano</span>
                  </div>
                  <div className="p-3 bg-[#86f2e4]/20 rounded-lg flex flex-col border border-[#006a61]/20">
                    <span className="font-mono text-xs text-[#005049] font-medium">Ganho Real (Fisher)</span>
                    <span
                      className={`text-base font-bold font-mono mt-1 ${
                        realAnnualYield < 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                      }`}
                    >
                      {formatSignedPercent(realAnnualYield)}
                    </span>
                    <span className="text-[11px] text-[#005049]">ao ano real</span>
                  </div>
                </div>
              </div>

              {/* Scenarios */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#eff4ff]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider">
                    Acumulação Composta Projetada:
                  </span>
                  <button
                    type="button"
                    onClick={handleSavePlanCClick}
                    disabled={isSavingBusy}
                    className="h-8 px-3 rounded-lg bg-[#000000] hover:bg-[#213145] disabled:opacity-60 text-[#ffffff] font-mono text-[11px] font-semibold cursor-pointer"
                  >
                    Salvar Taxas do Plano C
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs p-3 bg-[#eff4ff] rounded-lg font-mono">
                  <div>
                    <span className="text-[#45464d]">12 meses: </span>
                    <span className="font-bold text-[#006a61]">{formatCurrencyBR(projection12Months)}</span>
                  </div>
                  <span className="text-[#c6c6cd] hidden sm:inline">•</span>
                  <div>
                    <span className="text-[#45464d]">24 meses: </span>
                    <span className="font-bold text-[#006a61]">{formatCurrencyBR(projection24Months)}</span>
                  </div>
                  <span className="text-[#c6c6cd] hidden sm:inline">•</span>
                  <div>
                    <span className="text-[#45464d]">36 meses: </span>
                    <span className="font-bold text-[#006a61]">{formatCurrencyBR(projection36Months)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Dynamic Sparkline Chart & Disclaimer */}
            <div className="lg:col-span-5 bg-[#ffffff] rounded-xl p-6 shadow-sm flex flex-col justify-between gap-4 border border-[#eff4ff]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">
                    Projeção de Patrimônio Acumulado
                  </span>
                  <span className="font-mono text-xs text-[#006a61] font-semibold">36 Meses</span>
                </div>
                <p className="text-xs text-[#45464d] mt-1">
                  Curva de capitalização mensal gerada com aportes de{' '}
                  <strong>{formatCurrencyBR(effectiveMonthlyDeposit)}</strong> a{' '}
                  <strong>{nominalAnnualRate.toFixed(2).replace('.', ',')}% a.a.</strong>
                </p>
              </div>

              {/* Dynamic SVG Sparkline */}
              <div className="w-full h-36 bg-[#eff4ff] rounded-lg p-3 flex items-end relative overflow-hidden border border-[#e5eeff]">
                {!planCCurve ? (
                  <div className="m-auto text-center font-mono text-xs text-[#76777d] px-4">
                    Ative estratégias nos Planos A/B ou defina um aporte manual maior que zero para projetar a curva de 36 meses.
                  </div>
                ) : (
                  <>
                    <svg className="w-full h-full text-[#006a61]" fill="none" preserveAspectRatio="none" viewBox="0 0 300 100">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#006a61" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#006a61" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d={planCCurve.areaPath} fill="url(#areaGradient)" />
                      <path d={planCCurve.linePath} fill="none" stroke="#006a61" strokeLinecap="round" strokeWidth="3" />
                      <circle cx="300" cy="10" fill="#006a61" r="4" />
                    </svg>
                    <div className="absolute top-2 right-3 font-mono font-bold text-xs text-[#006a61] bg-[#ffffff] px-2 py-0.5 rounded shadow-sm">
                      {formatCurrencyBR(projection36Months)}
                    </div>
                    <div className="absolute bottom-2 left-3 font-mono text-[10px] text-[#76777d]">
                      Mês 0: R$ 0,00
                    </div>
                  </>
                )}
              </div>

              {/* Disclaimer */}
              <div className="p-3 bg-[#eff4ff] rounded-lg flex items-start gap-2 text-xs text-[#45464d]">
                <span className="material-symbols-outlined text-[18px] text-[#76777d] shrink-0 mt-0.5">gavel</span>
                <p className="leading-snug">
                  <strong className="text-[#0b1c30]">Aviso regulatório:</strong> Simulação matemática baseada em taxa nominal e inflação constantes. Não constitui recomendação de investimento.
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
                Pronto para aplicar as estratégias ao seu orçamento mensal?
              </span>
              <span className="text-xs text-[#45464d]">
                Acompanhe as compras e registre os comprovantes para verificar a redução do IPCA-Casa mês a mês.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('relatorios')}
              className="h-10 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              Exportar Metas (PDF)
            </button>
            <button
              type="button"
              onClick={handleApplyAllPlans}
              disabled={isSavingBusy}
              className="h-10 px-5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] disabled:opacity-60 text-xs font-mono font-semibold transition-opacity shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Salvar Plano de Otimização</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Criar / Editar Substituição (Plano A) */}
      {isPlanAModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-[#ffffff] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#eff4ff] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
              <h3 className="text-base font-bold text-[#0b1c30]">
                {editingPlanAId ? 'Editar Substituição (Plano A)' : 'Nova Substituição (Plano A)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsPlanAModalOpen(false)}
                className="text-[#76777d] hover:text-[#0b1c30] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePlanAForm} className="flex flex-col gap-3">
              {summary.calculatedItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Preencher a partir da cesta (opcional)
                  </label>
                  <select
                    value={formAOriginalItemId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormAOriginalItemId(val);
                      const found = summary.calculatedItems.find((it) => it.id === val);
                      if (found) {
                        setFormAOriginalName(found.name);
                        setFormAOriginalPrice(
                          String(found.currentPrice > 0 ? found.currentPrice : found.monthlySpend)
                        );
                      }
                    }}
                    className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs text-[#0b1c30] focus:outline-none"
                  >
                    <option value="">Selecionar item da cesta...</option>
                    {summary.calculatedItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({formatCurrencyBR(it.currentPrice || it.monthlySpend)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Item Atual *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAOriginalName}
                    onChange={(e) => setFormAOriginalName(e.target.value)}
                    placeholder="Ex: Café Marca Líder"
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Preço Atual (R$) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    value={formAOriginalPrice}
                    onChange={(e) => setFormAOriginalPrice(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Substituto Recomendado *
                  </label>
                  <input
                    type="text"
                    required
                    value={formASubstituteName}
                    onChange={(e) => setFormASubstituteName(e.target.value)}
                    placeholder="Ex: Café Equivalente 500g"
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Novo Preço (R$) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formASubstitutePrice}
                    onChange={(e) => setFormASubstitutePrice(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                  Economia Mensal Estimada (R$/mês) — deixe vazio para cálculo automático
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAMonthlySavings}
                  onChange={(e) => setFormAMonthlySavings(e.target.value)}
                  placeholder="Calculado automaticamente pela diferença se vazio"
                  className="h-9 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                  Trade-off Qualitativo / Observação
                </label>
                <textarea
                  rows={2}
                  value={formATradeoff}
                  onChange={(e) => setFormATradeoff(e.target.value)}
                  placeholder="Descreva equivalência nutricional, garantia ou praticidade..."
                  className="p-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                />
              </div>

              {formAError && (
                <div className="p-2.5 rounded-lg bg-[#ffdad6]/50 text-[#ba1a1a] font-mono text-xs">
                  {formAError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eff4ff]">
                <button
                  type="button"
                  onClick={() => setIsPlanAModalOpen(false)}
                  className="h-9 px-4 rounded-lg bg-[#eff4ff] text-[#0b1c30] text-xs font-mono cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingBusy}
                  className="h-9 px-5 rounded-lg bg-[#000000] text-[#ffffff] text-xs font-mono font-semibold cursor-pointer disabled:opacity-60"
                >
                  {isSavingBusy ? 'Salvando...' : 'Salvar Substituição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criar / Editar Meta de Eficiência (Plano B) */}
      {isPlanBModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-[#ffffff] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#eff4ff] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
              <h3 className="text-base font-bold text-[#0b1c30]">
                {editingPlanBId ? 'Editar Meta de Eficiência (Plano B)' : 'Nova Meta de Eficiência (Plano B)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsPlanBModalOpen(false)}
                className="text-[#76777d] hover:text-[#0b1c30] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePlanBForm} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Recurso Monitorado *
                  </label>
                  <input
                    type="text"
                    required
                    value={formBResourceName}
                    onChange={(e) => setFormBResourceName(e.target.value)}
                    placeholder="Ex: Energia Elétrica Residencial"
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Unidade Física *
                  </label>
                  <input
                    type="text"
                    required
                    value={formBUnit}
                    onChange={(e) => setFormBUnit(e.target.value)}
                    placeholder="Ex: kWh, m³, Litros"
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Tarifa (R$/un) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    value={formBTariff}
                    onChange={(e) => setFormBTariff(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Atual *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    min="0.1"
                    value={formBCurrentCons}
                    onChange={(e) => setFormBCurrentCons(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Meta *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    min="0"
                    value={formBTargetCons}
                    onChange={(e) => setFormBTargetCons(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                    Progresso (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formBProgress}
                    onChange={(e) => setFormBProgress(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono text-[#45464d] uppercase font-semibold">
                  Plano de Ação Prático
                </label>
                <textarea
                  rows={2}
                  value={formBNotes}
                  onChange={(e) => setFormBNotes(e.target.value)}
                  placeholder="Ações práticas para redução do consumo físico..."
                  className="p-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] focus:outline-none focus:border-[#000000]"
                />
              </div>

              {formBError && (
                <div className="p-2.5 rounded-lg bg-[#ffdad6]/50 text-[#ba1a1a] font-mono text-xs">
                  {formBError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eff4ff]">
                <button
                  type="button"
                  onClick={() => setIsPlanBModalOpen(false)}
                  className="h-9 px-4 rounded-lg bg-[#eff4ff] text-[#0b1c30] text-xs font-mono cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingBusy}
                  className="h-9 px-5 rounded-lg bg-[#000000] text-[#ffffff] text-xs font-mono font-semibold cursor-pointer disabled:opacity-60"
                >
                  {isSavingBusy ? 'Salvando...' : 'Salvar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação Segura (substitui window.confirm) */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Excluir Estratégia"
        message={
          deleteTarget
            ? `Tem certeza que deseja remover "${deleteTarget.label}"? Os cálculos de alívio e projeções serão recalculados imediatamente.`
            : ''
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

