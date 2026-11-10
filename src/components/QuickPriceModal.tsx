import React, { useState } from 'react';
import { BasketItem } from '../types';

interface QuickPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BasketItem[];
  onUpdatePrice: (itemId: string, newPrice: number, referenceDate: string, note?: string) => void;
}

export const QuickPriceModal: React.FC<QuickPriceModalProps> = ({
  isOpen,
  onClose,
  items,
  onUpdatePrice,
}) => {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().substring(0, 10));
  const [note, setNote] = useState('Cupom fiscal recente / supermercado');

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.id === selectedItemId) || items[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || newPrice === '' || Number(newPrice) < 0) {
      alert('Informe um preço válido.');
      return;
    }
    onUpdatePrice(currentItem.id, Number(newPrice), referenceDate, note);
    alert(`Preço de "${currentItem.name}" atualizado para R$ ${Number(newPrice).toFixed(2).replace('.', ',')}!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#213145]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#ffffff] rounded-2xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden">
        <div className="p-5 bg-[#eff4ff] flex items-center justify-between border-b border-[#e5eeff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-[#006a61]">edit_calendar</span>
            <span className="font-bold text-lg text-[#0b1c30]">Atualizar Preço Unitário</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#dce9ff]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase">
              Produto ou Serviço
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                const found = items.find((i) => i.id === e.target.value);
                if (found) setNewPrice(found.currentPrice);
              }}
              className="h-10 px-3 bg-[#eff4ff] rounded-lg text-sm text-[#0b1c30] focus:outline-none"
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} (Atual: R$ {it.currentPrice.toFixed(2).replace('.', ',')})
                </option>
              ))}
            </select>
          </div>

          {currentItem && (
            <div className="p-3 bg-[#eff4ff] rounded-xl text-xs flex justify-between">
              <div>
                <span className="text-[#45464d]">Preço Anterior:</span>
                <span className="font-mono font-semibold text-[#0b1c30] ml-1">
                  R$ {currentItem.oldPrice.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div>
                <span className="text-[#45464d]">Preço Cadastrado:</span>
                <span className="font-mono font-semibold text-[#006a61] ml-1">
                  R$ {currentItem.currentPrice.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase">
              Novo Preço Registrado (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0,00"
              className="h-10 px-3 bg-[#eff4ff] rounded-lg text-sm font-mono font-semibold text-[#0b1c30] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase">
              Data de Aferição
            </label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="h-10 px-3 bg-[#eff4ff] rounded-lg text-xs font-mono text-[#0b1c30] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-semibold text-[#0b1c30] uppercase">
              Origem da Leitura / Nota Fiscal
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Nota Fiscal Paulista, Cupom Supermercado..."
              className="h-10 px-3 bg-[#eff4ff] rounded-lg text-xs text-[#0b1c30] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[#45464d] hover:bg-[#eff4ff]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#000000] text-[#ffffff] text-sm font-semibold hover:bg-[#213145] transition-colors"
            >
              Salvar Cotação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
