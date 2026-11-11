import React, { useState, useEffect } from 'react';
import { BasketItem, ItemClassification, ConsumptionGroup } from '../types';
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

export const NewItemDrawer: React.FC<NewItemDrawerProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  totalMonthlySpend,
  groups: propGroups,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [group, setGroup] = useState('Alimentação e bebidas');
  const [monthlySpend, setMonthlySpend] = useState<number | ''>('');
  const [classification, setClassification] = useState<ItemClassification>('Essencial');
  const [oldPrice, setOldPrice] = useState<number | ''>('');
  const [currentPrice, setCurrentPrice] = useState<number | ''>('');
  const [oldPriceDate, setOldPriceDate] = useState(() => getMonthsAgoIsoDate(12));
  const [currentPriceDate, setCurrentPriceDate] = useState(() => getTodayIsoDate());
  const [unit, setUnit] = useState('unidade');
  const [notes, setNotes] = useState('');
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
      setMonthlySpend(editingItem.monthlySpend);
      setClassification(editingItem.classification);
      setOldPrice(editingItem.oldPrice > 0 ? editingItem.oldPrice : '');
      setCurrentPrice(editingItem.currentPrice > 0 ? editingItem.currentPrice : '');
      setOldPriceDate(editingItem.oldPriceDate || defaultOldDate);
      setCurrentPriceDate(editingItem.currentPriceDate || defaultCurrentDate);
      setUnit(editingItem.unit || 'unidade');
      setNotes(editingItem.notes || '');
    } else {
      setName('');
      setDescription('');
      setGroup('Alimentação e bebidas');
      setMonthlySpend('');
      setClassification('Essencial');
      setOldPrice('');
      setCurrentPrice('');
      setOldPriceDate(defaultOldDate);
      setCurrentPriceDate(defaultCurrentDate);
      setUnit('unidade');
      setNotes('');
    }
    setErrorMsg('');
    setSaving(false);
  }, [editingItem, isOpen, propGroups]);

  // Cálculo ao vivo do peso previsto
  const numericSpend = Number(monthlySpend) || 0;
  const newTotal = editingItem ? totalMonthlySpend : totalMonthlySpend + numericSpend;
  const calculatedWeight = newTotal > 0 ? (numericSpend / newTotal) * 100 : 0;

  // Cálculo da variação de preço prevista
  const numOldPrice = oldPrice !== '' ? Number(oldPrice) : 0;
  const numCurrentPrice = currentPrice !== '' ? Number(currentPrice) : 0;
  const priceVariation = numOldPrice > 0 ? ((numCurrentPrice - numOldPrice) / numOldPrice) * 100 : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setErrorMsg('Informe o nome do produto ou serviço.');
      return;
    }
    if (!Number.isFinite(numericSpend) || numericSpend < 0) {
      setErrorMsg('O gasto mensal não pode ser negativo.');
      return;
    }
    if (!isValidIsoDate(currentPriceDate)) {
      setErrorMsg('Informe uma data válida para o preço atual.');
      return;
    }
    if (numOldPrice > 0 && !isValidIsoDate(oldPriceDate)) {
      setErrorMsg('Informe uma data válida para o preço anterior.');
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
        monthlySpend: numericSpend,
        classification,
        oldPrice: numOldPrice,
        currentPrice: numCurrentPrice,
        oldPriceDate: numOldPrice > 0 ? oldPriceDate : '',
        currentPriceDate,
        unit: unit.trim() || 'unidade',
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
    <div className="fixed inset-0 bg-[#213145]/40 backdrop-blur-xs z-50 transition-opacity duration-300 flex justify-end">
      <div className="h-full w-full max-w-lg bg-[#ffffff] shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-6 bg-[#eff4ff] flex items-center justify-between border-b border-[#e5eeff]">
          <div className="flex flex-col">
            <span className="text-xl font-bold text-[#0b1c30]">
              {editingItem ? 'Editar Item da Cesta' : 'Adicionar à Cesta'}
            </span>
            <span className="text-xs text-[#45464d] mt-0.5">
              Cadastre produto ou serviço para cálculo ponderado
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

          {/* Info Banner: Dynamic Weight Explanation */}
          <div className="bg-[#dce9ff] rounded-xl p-3.5 flex items-start gap-2.5 text-[#0b1c30]">
            <span className="material-symbols-outlined text-[#497cff] text-[20px] shrink-0 mt-0.5">
              info
            </span>
            <div className="flex flex-col text-xs leading-relaxed">
              <span className="font-semibold text-[#0b1c30]">Ponderação Orçamentária Automática</span>
              <span className="text-[#45464d] mt-0.5">
                O peso percentual deste item na inflação familiar é computado matematicamente pela fração de seu gasto mensal sobre o gasto total da família.
              </span>
              {numericSpend > 0 && (
                <div className="mt-2 pt-2 border-t border-[#c6c6cd]/30 font-mono flex items-center justify-between">
                  <span>Peso Estimado na Cesta:</span>
                  <span className="font-bold text-[#006a61]">{calculatedWeight.toFixed(2).replace('.', ',')}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Field 1: Item Name */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Nome do Produto ou Serviço *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Café em Grão 1kg, Mensalidade Escolar..."
              className="h-10 px-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-sm focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#006a61] transition-all"
            />
          </div>

          {/* Field: Description (Optional) */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Descrição / Especificação (Opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Marca premium, pacote 500g, plano contratual..."
              className="h-10 px-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-xs focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#006a61] transition-all"
            />
          </div>

          {/* Field 2: IBGE Group / Category */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Grupo de Consumo / Categoria *
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

          {/* Two Columns: Monthly Spend & Classification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                Gasto Mensal (R$) *
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 font-mono text-xs text-[#76777d] font-semibold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={monthlySpend}
                  onChange={(e) => setMonthlySpend(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0,00"
                  className="w-full h-10 pl-9 pr-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-sm font-mono focus:outline-none focus:bg-[#ffffff] tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                Classificação *
              </label>
              <div className="relative flex items-center">
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as ItemClassification)}
                  className="w-full h-10 px-3 pr-8 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-sm appearance-none focus:outline-none focus:bg-[#ffffff] cursor-pointer font-medium"
                >
                  <option value="Essencial">Essencial</option>
                  <option value="Supérfluo">Supérfluo</option>
                  <option value="Não classificado">Não classificado</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 text-[20px] text-[#45464d] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {/* Two Columns: Old Price & Current Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                Preço Anterior (Base)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 font-mono text-xs text-[#76777d] font-semibold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={oldPrice}
                  onChange={(e) => setOldPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Ex: 24,50"
                  className="w-full h-10 pl-9 pr-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-sm font-mono focus:outline-none focus:bg-[#ffffff] tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
                Preço Atual
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 font-mono text-xs text-[#76777d] font-semibold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Ex: 31,90"
                  className="w-full h-10 pl-9 pr-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-sm font-mono focus:outline-none focus:bg-[#ffffff] tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Indicator of Price Status */}
          {numOldPrice > 0 && numCurrentPrice > 0 ? (
            <div className="p-2.5 bg-[#eff4ff] rounded-lg flex items-center justify-between text-xs">
              <span className="text-[#45464d]">Variação calculada:</span>
              <span
                className={`font-mono font-bold ${
                  priceVariation! > 0 ? 'text-[#ba1a1a]' : priceVariation! < 0 ? 'text-[#006a61]' : 'text-[#45464d]'
                }`}
              >
                {priceVariation! >= 0 ? '+' : ''}
                {priceVariation!.toFixed(2).replace('.', ',')}%
              </span>
            </div>
          ) : (
            <div className="p-2.5 bg-[#fff8f6] border border-[#ffdad6] rounded-lg text-[11px] text-[#ba1a1a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">info</span>
              <span>
                Preço anterior não informado: o item será registrado, mas sua variação de preço ficará indisponível até o preenchimento.
              </span>
            </div>
          )}

          {/* Reference Dates */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Período de Comparação de Preços
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={oldPriceDate}
                onChange={(e) => setOldPriceDate(e.target.value)}
                className="h-10 px-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-xs font-mono focus:outline-none"
              />
              <input
                type="date"
                value={currentPriceDate}
                onChange={(e) => setCurrentPriceDate(e.target.value)}
                className="h-10 px-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-xs font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Unit of Measurement */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Unidade de Medida
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ex: unidade, kg, litro, kWh, m³, mensalidade..."
              className="h-10 px-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-sm focus:outline-none"
            />
          </div>

          {/* Observations */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase tracking-wider">
              Observações / Detalhes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Marca habitual comprada no supermercado X, consumo de 2 unidades..."
              className="p-3 bg-[#eff4ff] rounded-lg text-[#0b1c30] text-xs focus:outline-none resize-none"
            />
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
