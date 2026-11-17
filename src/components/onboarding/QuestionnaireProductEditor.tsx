import React, { useState } from 'react';
import { ProfileMode, QuestionnaireItemEntry } from '../../types';

interface QuestionnaireProductEditorProps {
  mode: ProfileMode;
  entries: QuestionnaireItemEntry[];
  onChange: (entries: QuestionnaireItemEntry[]) => void;
  categoryOptions: readonly string[];
  knowsOldPrices: 'Sim' | 'Não' | 'Apenas alguns';
  suppliers?: string[];
  showSupplier?: boolean;
  itemLabelSingular?: string;
}

export const QuestionnaireProductEditor: React.FC<QuestionnaireProductEditorProps> = ({
  mode,
  entries,
  onChange,
  categoryOptions,
  knowsOldPrices,
  suppliers = [],
  showSupplier = false,
  itemLabelSingular = 'item',
}) => {
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>(categoryOptions[0] || 'Outros');
  const [newUnit, setNewUnit] = useState('un');

  const showHistoricalPrice = knowsOldPrices !== 'Não';

  const handleAddCustomItem = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const nextEntry: QuestionnaireItemEntry = {
      id: `qcustom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      category: newCategory || categoryOptions[0] || 'Outros',
      unit: newUnit.trim() || 'un',
      quantity: 1,
      currentPrice: null,
      oldPrice: null,
      supplierName: showSupplier && suppliers.length > 0 ? suppliers[0] : undefined,
      isMajorDriver: false,
      approximateSharePercent: null,
    };
    onChange([...entries, nextEntry]);
    setNewName('');
  };

  const updateEntry = (id: string, patch: Partial<QuestionnaireItemEntry>) => {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((entry) => entry.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl bg-[#f8f9ff] border border-[#e5eeff]">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddCustomItem();
            }
          }}
          placeholder={
            mode === 'negocio'
              ? 'Adicionar insumo, produto ou despesa específica...'
              : mode === 'estudante'
                ? 'Adicionar gasto específico (ex.: bandeijão, Xerox, ônibus)...'
                : 'Adicionar outro produto ou conta (ex.: leite em pó, condomínio)...'
          }
          className="flex-1 h-9 px-3 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="h-9 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
        >
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value)}
          placeholder="Unidade (kg, un, L)"
          className="w-28 h-9 px-2.5 rounded-lg border border-[#c6c6cd] text-xs text-[#0b1c30] bg-[#ffffff]"
        />
        <button
          type="button"
          onClick={handleAddCustomItem}
          className="h-9 px-3.5 rounded-lg bg-[#0b1c30] text-[#ffffff] text-xs font-semibold hover:bg-[#213145] transition-colors cursor-pointer shrink-0"
        >
          + Adicionar {itemLabelSingular}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-[#c6c6cd] text-center text-xs text-[#76777d]">
          Nenhum item detalhado ainda. Selecione opções acima ou adicione pelo campo acima.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="p-3 rounded-xl border border-[#e5eeff] bg-[#ffffff] flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={entry.name}
                    onChange={(e) => updateEntry(entry.id, { name: e.target.value })}
                    className="h-8 px-2.5 rounded-md border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] min-w-[160px]"
                  />
                  <select
                    value={entry.category}
                    onChange={(e) => updateEntry(entry.id, { category: e.target.value })}
                    className="h-8 px-2 rounded-md border border-[#c6c6cd] text-xs text-[#45464d] bg-[#f8f9ff]"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {!categoryOptions.includes(entry.category) && (
                      <option value={entry.category}>{entry.category}</option>
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`Remover ${entry.name}`}
                  className="text-xs text-[#ba1a1a] hover:underline cursor-pointer shrink-0"
                >
                  Remover
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#76777d]">Qtd / mês</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.5"
                    value={entry.quantity}
                    onChange={(e) =>
                      updateEntry(entry.id, {
                        quantity: Math.max(0.01, parseFloat(e.target.value) || 1),
                      })
                    }
                    className="h-8 px-2 rounded-md border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[#76777d]">Unidade</label>
                  <input
                    type="text"
                    value={entry.unit}
                    onChange={(e) => updateEntry(entry.id, { unit: e.target.value })}
                    className="h-8 px-2 rounded-md border border-[#c6c6cd] text-xs text-[#0b1c30]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-1">
                    <label className="text-[11px] font-mono text-[#76777d]">Preço atual (R$)</label>
                    <button
                      type="button"
                      onClick={() =>
                        updateEntry(entry.id, {
                          currentPrice: entry.currentPrice === null ? 0 : null,
                        })
                      }
                      className="text-[10px] text-[#497cff] hover:underline cursor-pointer"
                    >
                      {entry.currentPrice === null ? 'Informar' : 'Não sei'}
                    </button>
                  </div>
                  {entry.currentPrice === null ? (
                    <div className="h-8 px-2 rounded-md border border-dashed border-[#c6c6cd] bg-[#f8f9ff] flex items-center text-[11px] text-[#76777d]">
                      Não informado
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.currentPrice}
                      onChange={(e) =>
                        updateEntry(entry.id, {
                          currentPrice: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="h-8 px-2 rounded-md border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
                    />
                  )}
                </div>

                {showHistoricalPrice && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <label className="text-[11px] font-mono text-[#76777d]">Há ~1 ano (R$)</label>
                      <button
                        type="button"
                        onClick={() =>
                          updateEntry(entry.id, {
                            oldPrice: entry.oldPrice === null ? 0 : null,
                          })
                        }
                        className="text-[10px] text-[#497cff] hover:underline cursor-pointer"
                      >
                        {entry.oldPrice === null ? 'Informar' : 'Não sei'}
                      </button>
                    </div>
                    {entry.oldPrice === null ? (
                      <div className="h-8 px-2 rounded-md border border-dashed border-[#c6c6cd] bg-[#f8f9ff] flex items-center text-[11px] text-[#76777d]">
                        Sem histórico
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.oldPrice}
                        onChange={(e) =>
                          updateEntry(entry.id, {
                            oldPrice: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="h-8 px-2 rounded-md border border-[#c6c6cd] text-xs font-mono tabular-nums text-[#0b1c30]"
                      />
                    )}
                  </div>
                )}
              </div>

              {(showSupplier || mode !== 'negocio') && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#f8f9ff]">
                  {showSupplier && (
                    <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                      <span className="text-[11px] font-mono text-[#76777d]">Fornecedor:</span>
                      <input
                        type="text"
                        list="onboarding-suppliers-datalist"
                        value={entry.supplierName || ''}
                        onChange={(e) =>
                          updateEntry(entry.id, { supplierName: e.target.value })
                        }
                        placeholder="Opcional"
                        className="h-7 px-2 rounded border border-[#c6c6cd] text-xs text-[#0b1c30] flex-1"
                      />
                    </div>
                  )}

                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#45464d] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(entry.isMajorDriver)}
                      onChange={(e) =>
                        updateEntry(entry.id, { isMajorDriver: e.target.checked })
                      }
                      className="rounded border-[#c6c6cd]"
                    />
                    <span>Pesa muito no orçamento</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSupplier && suppliers.length > 0 && (
        <datalist id="onboarding-suppliers-datalist">
          {suppliers.map((sup) => (
            <option key={sup} value={sup} />
          ))}
        </datalist>
      )}
    </div>
  );
};
