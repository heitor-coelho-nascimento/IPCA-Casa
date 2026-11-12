import React, { useState, useEffect } from 'react';
import { BasketItem, ItemClassification, ConsumptionGroup, ConsumptionFrequency } from '../types';
import { StorageService } from '../services/storage';
import { getMonthsAgoIsoDate, getTodayIsoDate, isValidIsoDate } from '../utils/dates';

interface NewItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<BasketItem>) => void | Promise<void>;
  editingItem: BasketItem | null;
  totalMonthlySpend: number;
  groups?: ConsumptionGroup[];
}

type EntryMode = 'consumo' | 'fixo';

export const NewItemDrawer: React.FC<NewItemDrawerProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  totalMonthlySpend,
  groups: propGroups,
}) => {
  const [entryMode, setEntryMode] = useState<EntryMode>('consumo');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [group, setGroup] = useState('Alimentação e bebidas');
  const [classification, setClassification] = useState<ItemClassification>('Essencial');

  // Modo Consumo: Preço Unitário x Quantidade x Frequência
  const [currentPrice, setCurrentPrice] = useState<number | ''>('');
  const [oldPrice, setOldPrice] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [frequency, setFrequency] = useState<ConsumptionFrequency>('mensal');
  const [unit, setUnit] = useState('unidade');

  // Permite ajuste manual explícito do gasto mensal caso o usuário prefira
  const [manualSpendOverride, setManualSpendOverride] = useState<number | ''>('');
  const [isManualSpendCustomized, setIsManualSpendCustomized] = useState(false);

  // Modo Fixo: Valor Mensal
  const [fixedCurrentSpend, setFixedCurrentSpend] = useState<number | ''>('');
  const [fixedOldSpend, setFixedOldSpend] = useState<number | ''>('');

  // Datas de referência
  const [oldPriceDate, setOldPriceDate] = useState(() => getMonthsAgoIsoDate(12));
  const [currentPriceDate, setCurrentPriceDate] = useState(() => getTodayIsoDate());
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<ConsumptionGroup[]>(() => propGroups ?? StorageService.getGroups());

  useEffect(() => {
    setGroups(propGroups ?? StorageService.getGroups());
    const defaultOldDate = getMonthsAgoIsoDate(12);
    const defaultCurrentDate = getTodayIsoDate();

    if (editingItem) {
      setName(editingItem.name);
      setDescription(editingItem.description || '');
      setGroup(editingItem.group);
      setClassification(editingItem.classification);
      setOldPriceDate(editingItem.oldPriceDate || defaultOldDate);
      setCurrentPriceDate(editingItem.currentPriceDate || defaultCurrentDate);
      setUnit(editingItem.unit || 'unidade');
      setNotes(editingItem.notes || '');

      const isFixed =
        editingItem.unit === 'mensalidade' ||
        editingItem.group === 'Habitação' ||
        (editingItem.consumptionFrequency === 'mensal' && !editingItem.quantity);

      if (isFixed) {
        setEntryMode('fixo');
        setFixedCurrentSpend(editingItem.currentPrice > 0 ? editingItem.currentPrice : editingItem.monthlySpend);
        setFixedOldSpend(editingItem.oldPrice > 0 ? editingItem.oldPrice : '');
        setCurrentPrice(editingItem.currentPrice > 0 ? editingItem.currentPrice : '');
        setOldPrice(editingItem.oldPrice > 0 ? editingItem.oldPrice : '');
        setQuantity(1);
        setFrequency('mensal');
        setManualSpendOverride('');
        setIsManualSpendCustomized(false);
      } else {
        setEntryMode('consumo');
        setCurrentPrice(editingItem.currentPrice > 0 ? editingItem.currentPrice : '');
        setOldPrice(editingItem.oldPrice > 0 ? editingItem.oldPrice : '');
        setQuantity(editingItem.quantity || 1);
        setFrequency(editingItem.consumptionFrequency || 'mensal');
        setFixedCurrentSpend('');
        setFixedOldSpend('');
        setManualSpendOverride(editingItem.monthlySpend);
        setIsManualSpendCustomized(true);
      }
    } else {
      setEntryMode('consumo');
      setName('');
      setDescription('');
      setGroup('Alimentação e bebidas');
      setClassification('Essencial');
      setCurrentPrice('');
      setOldPrice('');
      setQuantity(1);
      setFrequency('mensal');
      setUnit('unidade');
      setFixedCurrentSpend('');
      setFixedOldSpend('');
      setManualSpendOverride('');
      setIsManualSpendCustomized(false);
      setOldPriceDate(defaultOldDate);
      setCurrentPriceDate(defaultCurrentDate);
      setNotes('');
      setShowAdvanced(false);
    }
    setErrorMsg('');
    setSaving(false);
  }, [editingItem, isOpen, propGroups]);

  // Multiplicador de frequência para conversão mensal
  const getFrequencyMultiplier = (freq: ConsumptionFrequency): number => {
    switch (freq) {
      case 'semanal':
        return 4.333; // ~52 / 12
      case 'quinzenal':
        return 2.0;
      case 'diaria':
        return 30.0;
      case 'anual':
        return 1 / 12;
      case 'mensal':
      default:
        return 1.0;
    }
  };

  // Cálculo do gasto mensal automático
  const numCurrentPrice = currentPrice !== '' ? Number(currentPrice) : 0;
  const numOldPrice = oldPrice !== '' ? Number(oldPrice) : 0;
  const numQty = quantity !== '' ? Number(quantity) : 1;
  const autoConsumptionMonthlySpend = Math.round(numCurrentPrice * numQty * getFrequencyMultiplier(frequency) * 100) / 100;

  const numFixedCurrent = fixedCurrentSpend !== '' ? Number(fixedCurrentSpend) : 0;
  const numFixedOld = fixedOldSpend !== '' ? Number(fixedOldSpend) : 0;

  // Gasto mensal final resolvido
  const resolvedMonthlySpend =
    entryMode === 'fixo'
      ? numFixedCurrent
      : isManualSpendCustomized && manualSpendOverride !== ''
      ? Number(manualSpendOverride)
      : autoConsumptionMonthlySpend;

  // Variação de preço percentual
  const effectiveOldPrice = entryMode === 'fixo' ? numFixedOld : numOldPrice;
  const effectiveCurrentPrice = entryMode === 'fixo' ? numFixedCurrent : numCurrentPrice;
  const priceVariation =
    effectiveOldPrice > 0
      ? ((effectiveCurrentPrice - effectiveOldPrice) / effectiveOldPrice) * 100
      : null;

  // Cálculo ao vivo do peso previsto na cesta
  const newTotal = editingItem ? totalMonthlySpend : totalMonthlySpend + resolvedMonthlySpend;
  const calculatedWeight = newTotal > 0 ? (resolvedMonthlySpend / newTotal) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setErrorMsg('Informe o nome do item ou serviço.');
      return;
    }

    if (entryMode === 'fixo') {
      if (numFixedCurrent <= 0) {
        setErrorMsg('Informe o valor mensal atual da conta.');
        return;
      }
    } else {
      if (numCurrentPrice <= 0) {
        setErrorMsg('Informe o preço atual do produto.');
        return;
      }
      if (numQty <= 0) {
        setErrorMsg('Informe uma quantidade válida consumida.');
        return;
      }
    }

    if (!Number.isFinite(resolvedMonthlySpend) || resolvedMonthlySpend < 0) {
      setErrorMsg('O gasto mensal calculado é inválido.');
      return;
    }

    if (!isValidIsoDate(currentPriceDate)) {
      setErrorMsg('Informe uma data válida para a referência atual.');
      return;
    }

    if (effectiveOldPrice > 0 && !isValidIsoDate(oldPriceDate)) {
      setErrorMsg('Informe uma data válida para a referência anterior.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      await onSave({
        id: editingItem?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        group,
        monthlySpend: resolvedMonthlySpend,
        classification,
        oldPrice: effectiveOldPrice,
        currentPrice: effectiveCurrentPrice,
        oldPriceDate: effectiveOldPrice > 0 ? oldPriceDate : '',
        currentPriceDate,
        unit: entryMode === 'fixo' ? 'mensalidade' : unit.trim() || 'unidade',
        quantity: entryMode === 'fixo' ? 1 : numQty,
        consumptionFrequency: entryMode === 'fixo' ? 'mensal' : frequency,
        expenseNature: entryMode === 'fixo' ? 'Fixa' : 'Variável',
        notes: notes.trim(),
        active: true,
      });
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'Erro ao salvar item. Verifique os campos e tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs z-50 transition-opacity duration-300 flex justify-end">
      <div className="h-full w-full max-w-lg bg-[#ffffff] shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-6 bg-[#eff4ff] flex items-center justify-between border-b border-[#e5eeff]">
          <div className="flex flex-col">
            <span className="text-xl font-bold text-[#0b1c30]">
              {editingItem ? 'Editar Gasto da Cesta' : 'Novo Gasto ou Produto'}
            </span>
            <span className="text-xs text-[#45464d] mt-0.5">
              Informe os dados básicos — o sistema calcula o gasto mensal e a inflação automaticamente
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Drawer Body */}
        <form id="itemDrawerForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-[#ffdad6] text-[#ba1a1a] rounded-lg text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Seletor de Tipo de Gasto */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Como você prefere informar?
            </label>
            <div className="grid grid-cols-2 gap-2 bg-[#eff4ff] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setEntryMode('consumo')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  entryMode === 'consumo'
                    ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm'
                    : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
                <span>Produto (Preço × Qtd)</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('fixo')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  entryMode === 'fixo'
                    ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm'
                    : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>Conta ou Mensalidade</span>
              </button>
            </div>
          </div>

          {/* Nome do Item */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              {entryMode === 'consumo' ? 'O que você compra? *' : 'Qual é a conta ou despesa? *'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                entryMode === 'consumo'
                  ? 'Ex: Café em Grão 1kg, Leite, Carne Moída, Gasolina...'
                  : 'Ex: Aluguel, Condomínio, Internet, Escola, Plano de Saúde...'
              }
              className="h-10 px-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-sm focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#006a61] transition-all"
            />
          </div>

          {/* Categoria IBGE */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Categoria *
            </label>
            <div className="relative flex items-center">
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full h-10 px-3 pr-8 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-sm appearance-none focus:outline-none focus:bg-[#ffffff] cursor-pointer font-medium"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name} {g.isCustom ? '(Personalizada)' : ''}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 text-[20px] text-[#45464d] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* MODO CONSUMO: Preço + Quantidade + Frequência */}
          {entryMode === 'consumo' && (
            <div className="flex flex-col gap-3 p-4 bg-[#f8faff] rounded-xl border border-[#e5eeff]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Preço Atual (R$) *
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 font-mono text-xs text-[#76777d] font-semibold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={currentPrice}
                      onChange={(e) => setCurrentPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Ex: 24,90"
                      className="w-full h-10 pl-9 pr-3 bg-[#ffffff] rounded-lg text-[#0b1c30] text-sm font-mono border border-[#c6c6cd]/40 focus:outline-none focus:border-[#006a61] tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Preço Anterior (Opcional)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 font-mono text-xs text-[#76777d] font-semibold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={oldPrice}
                      onChange={(e) => setOldPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Ex: 19,90 (há 1 ano)"
                      className="w-full h-10 pl-9 pr-3 bg-[#ffffff] rounded-lg text-[#0b1c30] text-sm font-mono border border-[#c6c6cd]/40 focus:outline-none focus:border-[#006a61] tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="1"
                    className="w-full h-10 px-3 bg-[#ffffff] rounded-lg text-[#0b1c30] text-sm font-mono border border-[#c6c6cd]/40 focus:outline-none focus:border-[#006a61]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Unidade
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="un, kg, litro, pct..."
                    className="w-full h-10 px-3 bg-[#ffffff] rounded-lg text-[#0b1c30] text-sm border border-[#c6c6cd]/40 focus:outline-none focus:border-[#006a61]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Frequência
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as ConsumptionFrequency)}
                    className="w-full h-10 px-3 bg-[#ffffff] rounded-lg text-[#0b1c30] text-xs font-medium border border-[#c6c6cd]/40 focus:outline-none cursor-pointer"
                  >
                    <option value="mensal">Por mês (1x)</option>
                    <option value="semanal">Por semana (~4x)</option>
                    <option value="quinzenal">A cada 15 dias (2x)</option>
                    <option value="diaria">Por dia (30x)</option>
                  </select>
                </div>
              </div>

              {/* Card de Cálculo Automático do Gasto */}
              <div className="bg-[#e5eeff] rounded-xl p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-[#45464d] uppercase font-mono">
                    Gasto Mensal Calculado Automaticamente
                  </span>
                  <span className="text-lg font-bold text-[#0b1c30] font-mono">
                    R$ {resolvedMonthlySpend.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs font-normal text-[#45464d] ml-1">/mês</span>
                  </span>
                </div>
                {calculatedWeight > 0 && (
                  <div className="text-right flex flex-col font-mono text-xs">
                    <span className="text-[#45464d]">Peso na Cesta:</span>
                    <span className="font-bold text-[#006a61]">{calculatedWeight.toFixed(1).replace('.', ',')}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODO FIXO: Valor Direto Mensal */}
          {entryMode === 'fixo' && (
            <div className="flex flex-col gap-3 p-4 bg-[#f8faff] rounded-xl border border-[#e5eeff]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Valor Deste Mês (R$) *
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 font-mono text-xs text-[#76777d] font-semibold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={fixedCurrentSpend}
                      onChange={(e) => setFixedCurrentSpend(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Ex: 1450,00"
                      className="w-full h-10 pl-9 pr-3 bg-[#ffffff] rounded-lg text-[#0b1c30] text-sm font-mono border border-[#c6c6cd]/40 focus:outline-none focus:border-[#006a61] tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Valor no Ano Anterior (Opcional)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 font-mono text-xs text-[#76777d] font-semibold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={fixedOldSpend}
                      onChange={(e) => setFixedOldSpend(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Ex: 1350,00"
                      className="w-full h-10 pl-9 pr-3 bg-[#ffffff] rounded-lg text-[#0b1c30] text-sm font-mono border border-[#c6c6cd]/40 focus:outline-none focus:border-[#006a61] tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {numFixedCurrent > 0 && (
                <div className="bg-[#e5eeff] rounded-xl p-3 flex items-center justify-between font-mono text-xs">
                  <span className="text-[#45464d]">Gasto mensal fixado:</span>
                  <span className="text-base font-bold text-[#0b1c30]">
                    R$ {numFixedCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Variação de Preço Calculada */}
          {effectiveOldPrice > 0 && effectiveCurrentPrice > 0 ? (
            <div className="p-3 bg-[#eff4ff] rounded-xl flex items-center justify-between text-xs">
              <span className="text-[#45464d] font-medium">Variação calculada no período:</span>
              <span
                className={`font-mono font-bold text-sm ${
                  priceVariation! > 0 ? 'text-[#ba1a1a]' : priceVariation! < 0 ? 'text-[#006a61]' : 'text-[#45464d]'
                }`}
              >
                {priceVariation! >= 0 ? '+' : ''}
                {priceVariation!.toFixed(2).replace('.', ',')}%
              </span>
            </div>
          ) : (
            <div className="p-2.5 bg-[#f8faff] rounded-lg text-[11px] text-[#76777d] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#497cff]">info</span>
              <span>
                Preço anterior não informado: o gasto será registrado na cesta, mas a inflação deste item ficará pendente até o preenchimento.
              </span>
            </div>
          )}

          {/* Classificação Essencial vs Supérfluo */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Importância no seu orçamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setClassification('Essencial')}
                className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  classification === 'Essencial'
                    ? 'border-[#006a61] bg-[#86f2e4]/20 text-[#006a61] font-bold'
                    : 'border-[#c6c6cd]/30 bg-[#eff4ff] text-[#45464d]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Essencial (básico da casa)</span>
              </button>
              <button
                type="button"
                onClick={() => setClassification('Supérfluo')}
                className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  classification === 'Supérfluo'
                    ? 'border-[#497cff] bg-[#dce9ff]/40 text-[#497cff] font-bold'
                    : 'border-[#c6c6cd]/30 bg-[#eff4ff] text-[#45464d]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">star</span>
                <span>Supérfluo / Opcional</span>
              </button>
            </div>
          </div>

          {/* Opções Avançadas (Datas, Descrição, Observações) */}
          <div className="border-t border-[#e5eeff] pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-[#45464d] hover:text-[#0b1c30] flex items-center gap-1 cursor-pointer py-1"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showAdvanced ? 'expand_less' : 'tune'}
              </span>
              <span>{showAdvanced ? 'Ocultar opções adicionais' : 'Opções adicionais (Datas e notas)'}</span>
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-3 mt-3 p-3 bg-[#eff4ff] rounded-xl">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Período de Comparação
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-[#76777d] block font-mono">Data Anterior:</span>
                      <input
                        type="date"
                        value={oldPriceDate}
                        onChange={(e) => setOldPriceDate(e.target.value)}
                        className="w-full h-9 px-2 bg-[#ffffff] rounded-lg text-[#0b1c30] text-xs font-mono border border-[#c6c6cd]/30"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#76777d] block font-mono">Data Atual:</span>
                      <input
                        type="date"
                        value={currentPriceDate}
                        onChange={(e) => setCurrentPriceDate(e.target.value)}
                        className="w-full h-9 px-2 bg-[#ffffff] rounded-lg text-[#0b1c30] text-xs font-mono border border-[#c6c6cd]/30"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Marca habitual comprada no mercado X..."
                    className="p-2.5 bg-[#ffffff] rounded-lg text-[#0b1c30] text-xs border border-[#c6c6cd]/30 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Drawer Footer Actions */}
        <div className="p-6 bg-[#eff4ff] flex items-center justify-end gap-3 border-t border-[#e5eeff]">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-lg text-[#45464d] hover:bg-[#e5eeff] hover:text-[#0b1c30] text-sm font-medium transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="itemDrawerForm"
            disabled={saving}
            className="h-10 px-6 rounded-lg bg-[#000000] hover:bg-[#213145] text-[#ffffff] text-sm font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">{saving ? 'sync' : 'check'}</span>
            <span>{saving ? 'Salvando...' : editingItem ? 'Atualizar Item' : 'Salvar na Cesta'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
