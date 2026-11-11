import React, { useEffect, useState } from 'react';
import { BasketItem, PriceHistory, EconomicCalculationSummary } from '../types';
import { StorageService } from '../services/storage';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  formatIsoDateBR,
  formatMonthYearLabel,
  getTodayIsoDate,
  isValidIsoDate,
  parseIsoDateToLocalTimestamp,
} from '../utils/dates';

interface PriceHistoryViewProps {
  summary: EconomicCalculationSummary;
  onRefreshData: () => void;
  isDemo: boolean;
  selectedItemForHistory?: BasketItem | null;
  priceRecords?: PriceHistory[];
  onAddPriceRecord?: (record: {
    itemId: string;
    price: number;
    referenceDate: string;
    unit?: string;
    origin?: string;
  }) => void | Promise<void>;
  onUpdatePriceRecord?: (
    priceId: string,
    updated: Partial<PriceHistory>
  ) => void | Promise<void>;
  onDeletePriceRecord?: (priceId: string) => void | Promise<void>;
}

function formatMoneyBR(val: number): string {
  const safe = Number.isFinite(val) ? val : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSignedPercent(val: number | null, digits = 2): string {
  if (val === null || !Number.isFinite(val)) return '—';
  return `${val > 0 ? '+' : val < 0 ? '-' : ''}${Math.abs(val).toFixed(digits).replace('.', ',')}%`;
}

export const PriceHistoryView: React.FC<PriceHistoryViewProps> = ({
  summary,
  onRefreshData,
  isDemo,
  selectedItemForHistory,
  priceRecords: propPriceRecords,
  onAddPriceRecord,
  onUpdatePriceRecord,
  onDeletePriceRecord,
}) => {
  const { calculatedItems } = summary;
  const [selectedItemId, setSelectedItemId] = useState<string>(
    selectedItemForHistory?.id || calculatedItems[0]?.id || ''
  );

  useEffect(() => {
    if (selectedItemForHistory?.id) {
      setSelectedItemId(selectedItemForHistory.id);
    } else if (
      (!selectedItemId || !calculatedItems.some((i) => i.id === selectedItemId)) &&
      calculatedItems[0]?.id
    ) {
      setSelectedItemId(calculatedItems[0].id);
    } else if (calculatedItems.length === 0 && selectedItemId) {
      setSelectedItemId('');
    }
  }, [selectedItemForHistory, calculatedItems, selectedItemId]);

  const selectedItem = calculatedItems.find((i) => i.id === selectedItemId);
  const [localPriceHistory, setLocalPriceHistory] = useState<PriceHistory[]>(() => {
    if (selectedItemId && !propPriceRecords) {
      return StorageService.getPriceHistory(selectedItemId);
    }
    return [];
  });

  useEffect(() => {
    if (!propPriceRecords) {
      setLocalPriceHistory(selectedItemId ? StorageService.getPriceHistory(selectedItemId) : []);
    }
  }, [selectedItemId, propPriceRecords, isDemo, calculatedItems.length]);

  const priceHistory = (
    propPriceRecords
      ? propPriceRecords.filter((p) => p.itemId === selectedItemId)
      : localPriceHistory
  )
    .slice()
    .sort(
      (a, b) =>
        parseIsoDateToLocalTimestamp(a.referenceDate) -
        parseIsoDateToLocalTimestamp(b.referenceDate)
    );

  // Modal Adicionar / Editar Cotação
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PriceHistory | null>(null);
  const [recordPrice, setRecordPrice] = useState<number>(selectedItem?.currentPrice || 0);
  const [recordDate, setRecordDate] = useState<string>(getTodayIsoDate());
  const [recordOrigin, setRecordOrigin] = useState<string>('Supermercado / Cupom');
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Confirmação de Exclusão
  const [recordToDelete, setRecordToDelete] = useState<PriceHistory | null>(null);

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    const item = calculatedItems.find((i) => i.id === id);
    if (item) {
      setRecordPrice(item.currentPrice);
    }
    if (!propPriceRecords) {
      setLocalPriceHistory(StorageService.getPriceHistory(id));
    }
  };

  const openNewRecordModal = () => {
    setEditingRecord(null);
    setModalError(null);
    setRecordPrice(selectedItem?.currentPrice || 0);
    setRecordDate(getTodayIsoDate());
    setRecordOrigin('Supermercado / Cupom');
    setIsPriceModalOpen(true);
  };

  const openEditRecordModal = (record: PriceHistory) => {
    setEditingRecord(record);
    setModalError(null);
    setRecordPrice(record.price);
    setRecordDate(isValidIsoDate(record.referenceDate) ? record.referenceDate : getTodayIsoDate());
    setRecordOrigin(record.source || 'Supermercado Local');
    setIsPriceModalOpen(true);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedItemId) {
      setModalError('Selecione um item da cesta antes de salvar uma cotação.');
      return;
    }
    if (!Number.isFinite(recordPrice) || recordPrice <= 0) {
      setModalError('Informe um preço unitário válido maior que R$ 0,00.');
      return;
    }
    if (!isValidIsoDate(recordDate)) {
      setModalError('Informe uma data válida para a cotação.');
      return;
    }
    const cleanOrigin = recordOrigin.trim();
    if (!cleanOrigin) {
      setModalError('Informe o estabelecimento ou origem do comprovante.');
      return;
    }

    setIsSavingRecord(true);
    try {
      if (editingRecord) {
        const updatedFields: Partial<PriceHistory> = {
          price: recordPrice,
          referenceDate: recordDate,
          source: cleanOrigin,
          unit: selectedItem?.unit || editingRecord.unit || 'un',
        };
        if (onUpdatePriceRecord) {
          await onUpdatePriceRecord(editingRecord.id, updatedFields);
        } else {
          StorageService.updatePriceRecord(editingRecord.id, updatedFields);
          setLocalPriceHistory(StorageService.getPriceHistory(selectedItemId));
        }
      } else {
        const recordPayload = {
          itemId: selectedItemId,
          price: recordPrice,
          referenceDate: recordDate,
          unit: selectedItem?.unit || 'un',
          origin: cleanOrigin,
        };
        if (onAddPriceRecord) {
          await onAddPriceRecord(recordPayload);
        } else {
          StorageService.addPriceRecord(recordPayload);
          setLocalPriceHistory(StorageService.getPriceHistory(selectedItemId));
        }
      }

      setIsPriceModalOpen(false);
      setEditingRecord(null);
      onRefreshData();
    } catch {
      setModalError('Não foi possível salvar a cotação. Tente novamente.');
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleConfirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    const targetId = recordToDelete.id;
    setRecordToDelete(null);
    if (onDeletePriceRecord) {
      await onDeletePriceRecord(targetId);
    } else {
      StorageService.deletePriceRecord(targetId);
      setLocalPriceHistory(StorageService.getPriceHistory(selectedItemId));
    }
    onRefreshData();
  };

  // Preço mínimo, máximo e média
  const pricesOnly = priceHistory.map((p) => p.price);
  const minPrice =
    pricesOnly.length > 0 ? Math.min(...pricesOnly) : selectedItem?.currentPrice || 0;
  const maxPrice =
    pricesOnly.length > 0 ? Math.max(...pricesOnly) : selectedItem?.currentPrice || 0;
  const avgPrice =
    pricesOnly.length > 0
      ? pricesOnly.reduce((a, b) => a + b, 0) / pricesOnly.length
      : selectedItem?.currentPrice || 0;

  return (
    <div className="flex flex-col w-full px-6 lg:px-12 py-8 max-w-[1440px] mx-auto gap-8">
      {/* Sub-Header / Demo Warning */}
      <div className="p-3 bg-[#eff4ff] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-[#e5eeff]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#006a61] animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-[#45464d] font-semibold">
            {isDemo ? 'Histórico Demonstrativo de Exemplo' : 'Série Temporal Auditada'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-[#45464d]">
          <span className="material-symbols-outlined text-[16px] text-[#006a61]">history_edu</span>
          <span>Rastreabilidade de Cotações: Ativa</span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline">Base de Preços Familiar</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#497cff] font-mono text-xs uppercase tracking-wider font-semibold">
            <span className="material-symbols-outlined text-[18px]">timeline</span>
            <span>Rastreabilidade de Preços & Cotações</span>
          </div>
          <h1 className="text-3xl font-bold text-[#0b1c30] tracking-tight mt-1">
            Histórico Temporal de Preços
          </h1>
          <p className="text-xs text-[#45464d] mt-1 max-w-2xl">
            Acompanhe a curva de variação de cada produto ou serviço da cesta com data, local de compra e série de cotações para auditoria da inflação domiciliar.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewRecordModal}
          disabled={!selectedItem}
          className="h-10 px-4 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] text-xs font-mono font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">add_chart</span>
          <span>Registrar Nova Cotação</span>
        </button>
      </div>

      {/* Item Selector & Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Item Selector */}
        <div className="lg:col-span-4 bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#eff4ff]">
            <span className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">
              Selecione o Item ({calculatedItems.length})
            </span>
            <span className="text-xs text-[#76777d]">Cesta Familiar</span>
          </div>

          {calculatedItems.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#eff4ff]/50 text-center text-xs font-mono text-[#76777d]">
              Nenhum item ativo cadastrado na cesta familiar. Cadastre produtos na aba Minha Cesta Familiar para acompanhar cotações.
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-h-[520px] overflow-y-auto pr-1">
              {calculatedItems.map((item) => {
                const isSelected = item.id === selectedItemId;
                const change = item.priceChangePercent;
                const isInflated = (change ?? 0) > 0;
                const isRelief = (change ?? 0) < 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectItem(item.id)}
                    className={`p-3 rounded-lg text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#000000] text-[#ffffff] shadow-sm'
                        : 'hover:bg-[#eff4ff] text-[#0b1c30]'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-semibold text-xs truncate">{item.name}</span>
                      <span
                        className={`text-[11px] font-mono truncate ${
                          isSelected ? 'text-[#c6c6cd]' : 'text-[#76777d]'
                        }`}
                      >
                        {item.group} • {item.unit || 'un'}
                      </span>
                    </div>

                    <div className="flex flex-col items-end shrink-0 font-mono text-xs">
                      <span className="font-bold">R$ {formatMoneyBR(item.currentPrice)}</span>
                      <span
                        className={`text-[10px] font-bold ${
                          change === null
                            ? isSelected
                              ? 'text-[#c6c6cd]'
                              : 'text-[#76777d]'
                            : isSelected
                            ? isInflated
                              ? 'text-[#ffb4ab]'
                              : isRelief
                              ? 'text-[#86f2e4]'
                              : 'text-[#dae2fd]'
                            : isInflated
                            ? 'text-[#ba1a1a]'
                            : isRelief
                            ? 'text-[#006a61]'
                            : 'text-[#45464d]'
                        }`}
                      >
                        {change === null ? 'Base pendente' : formatSignedPercent(change, 1)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Historical details for the selected item */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selectedItem ? (
            <>
              {/* Highlight KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm border border-[#eff4ff] flex flex-col">
                  <span className="font-mono text-xs text-[#45464d]">Preço Atual</span>
                  <span className="text-xl font-bold font-mono text-[#0b1c30] mt-1">
                    R$ {formatMoneyBR(selectedItem.currentPrice)}
                  </span>
                  <span className="text-[11px] text-[#76777d] mt-0.5">
                    por {selectedItem.unit || 'un'} ({formatIsoDateBR(selectedItem.currentPriceDate, 'atual')})
                  </span>
                </div>

                <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm border border-[#eff4ff] flex flex-col">
                  <span className="font-mono text-xs text-[#45464d]">Preço Anterior</span>
                  <span className="text-xl font-bold font-mono text-[#45464d] mt-1">
                    {selectedItem.oldPrice > 0 ? `R$ ${formatMoneyBR(selectedItem.oldPrice)}` : '—'}
                  </span>
                  <span className="text-[11px] text-[#76777d] mt-0.5">
                    {selectedItem.oldPrice > 0
                      ? `Ref.: ${formatIsoDateBR(selectedItem.oldPriceDate, 'base')}`
                      : 'Preço base não informado'}
                  </span>
                </div>

                <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm border border-[#eff4ff] flex flex-col">
                  <span className="font-mono text-xs text-[#45464d]">Variação Total</span>
                  <span
                    className={`text-xl font-bold font-mono mt-1 ${
                      selectedItem.priceChangePercent === null
                        ? 'text-[#76777d]'
                        : selectedItem.priceChangePercent > 0
                        ? 'text-[#ba1a1a]'
                        : selectedItem.priceChangePercent < 0
                        ? 'text-[#006a61]'
                        : 'text-[#0b1c30]'
                    }`}
                  >
                    {selectedItem.priceChangePercent === null
                      ? 'Pendente'
                      : formatSignedPercent(selectedItem.priceChangePercent)}
                  </span>
                  <span className="text-[11px] text-[#76777d] mt-0.5">impacto na cesta</span>
                </div>

                <div className="bg-[#ffffff] rounded-xl p-4 shadow-sm border border-[#eff4ff] flex flex-col">
                  <span className="font-mono text-xs text-[#45464d]">Peso Orçamentário</span>
                  <span className="text-xl font-bold font-mono text-[#0b1c30] mt-1">
                    {selectedItem.weightPercent.toFixed(2).replace('.', ',')}%
                  </span>
                  <span className="text-[11px] text-[#76777d] mt-0.5">
                    Gasto: R$ {formatMoneyBR(selectedItem.monthlySpend)}
                  </span>
                </div>
              </div>

              {/* Price Timeline Visual */}
              <div className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#eff4ff] flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[#0b1c30]">
                      Evolução das Cotações: {selectedItem.name}
                    </h3>
                    <p className="text-xs text-[#45464d]">
                      Série histórica de preços coletados para este item na família.
                    </p>
                  </div>
                  <div className="flex items-center flex-wrap gap-2 font-mono text-xs">
                    <span className="px-2.5 py-1 bg-[#eff4ff] text-[#45464d] rounded-md font-medium">
                      Mín: R$ {formatMoneyBR(minPrice)}
                    </span>
                    <span className="px-2.5 py-1 bg-[#eff4ff] text-[#45464d] rounded-md font-medium">
                      Média: R$ {formatMoneyBR(avgPrice)}
                    </span>
                    <span className="px-2.5 py-1 bg-[#eff4ff] text-[#45464d] rounded-md font-medium">
                      Máx: R$ {formatMoneyBR(maxPrice)}
                    </span>
                  </div>
                </div>

                {/* Bar Visual Representation of Price Evolution */}
                <div className="w-full min-h-48 bg-[#eff4ff] rounded-xl p-4 flex flex-col justify-between border border-[#e5eeff] relative overflow-hidden">
                  <div className="flex justify-between text-[11px] font-mono text-[#76777d] z-10">
                    <span>Teto: R$ {formatMoneyBR(maxPrice * 1.05)}</span>
                    <span>Piso: R$ {formatMoneyBR(minPrice * 0.95)}</span>
                  </div>

                  {priceHistory.length === 0 ? (
                    <div className="h-28 flex items-center justify-center text-center px-4 text-xs font-mono text-[#76777d]">
                      Nenhuma cotação histórica registrada ainda. Use &quot;Registrar Nova Cotação&quot; para construir a linha do tempo.
                    </div>
                  ) : (
                    <div className="h-32 w-full overflow-x-auto flex items-end justify-around gap-3 px-4 pb-2 relative z-10">
                      {priceHistory.map((pt, idx) => {
                        const spread = maxPrice - minPrice;
                        const heightPx =
                          spread === 0
                            ? 60
                            : Math.round(Math.max(18, Math.min(88, ((pt.price - minPrice) / spread) * 70 + 18)));
                        return (
                          <div key={pt.id || idx} className="flex flex-col items-center gap-1 group shrink-0">
                            <span className="text-[10px] font-mono font-bold text-[#0b1c30] group-hover:scale-105 transition-transform">
                              R$ {formatMoneyBR(pt.price)}
                            </span>
                            <div
                              className="w-8 bg-[#006a61] rounded-t-md transition-all group-hover:bg-[#497cff]"
                              style={{ height: `${heightPx}px` }}
                            />
                            <span className="text-[9px] font-mono text-[#76777d] mt-1">
                              {formatMonthYearLabel(pt.referenceDate)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] font-mono text-[#45464d] pt-2 border-t border-[#e5eeff] z-10">
                    <span>Origem dos dados: Registros e notas fiscais familiares</span>
                    <span>
                      {priceHistory.length}{' '}
                      {priceHistory.length === 1 ? 'cotação arquivada' : 'cotações históricas arquivadas'}
                    </span>
                  </div>
                </div>

                {/* Detailed Table of Records */}
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#eff4ff] text-[#45464d] font-mono uppercase tracking-wider">
                        <th className="py-2.5 px-4 font-semibold">Data da Cotação</th>
                        <th className="py-2.5 px-4 font-semibold">Preço Unitário</th>
                        <th className="py-2.5 px-4 font-semibold">Unidade</th>
                        <th className="py-2.5 px-4 font-semibold">Estabelecimento / Origem</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Registrado em</th>
                        <th className="py-2.5 px-4 font-semibold text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eff4ff] text-[#0b1c30]">
                      {priceHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 px-4 text-center text-[#76777d] font-mono">
                            Nenhuma cotação histórica registrada ainda para este item. Clique em &quot;Registrar Nova Cotação&quot; para iniciar a série.
                          </td>
                        </tr>
                      ) : (
                        priceHistory.map((record) => (
                          <tr key={record.id} className="hover:bg-[#eff4ff]/60 transition-colors">
                            <td className="py-3 px-4 font-mono font-semibold">
                              {formatIsoDateBR(record.referenceDate)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#0b1c30]">
                              R$ {formatMoneyBR(record.price)}
                            </td>
                            <td className="py-3 px-4 font-mono text-[#76777d]">
                              {record.unit || selectedItem.unit || 'un'}
                            </td>
                            <td className="py-3 px-4 text-[#45464d]">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[15px] text-[#76777d]">
                                  storefront
                                </span>
                                {record.source || 'Supermercado Local'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-[11px] text-[#76777d]">
                              {formatIsoDateBR(record.createdAt, '—')}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditRecordModal(record)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
                                  title="Editar cotação"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRecordToDelete(record)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#ffdad6] hover:text-[#ba1a1a] transition-colors cursor-pointer"
                                  title="Excluir cotação"
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
              </div>
            </>
          ) : (
            <div className="bg-[#ffffff] rounded-xl p-12 shadow-sm border border-[#eff4ff] text-center text-[#76777d]">
              {calculatedItems.length === 0
                ? 'Adicione itens à sua cesta familiar para registrar e acompanhar cotações históricas.'
                : 'Selecione um item da cesta ao lado para visualizar seu histórico de preços.'}
            </div>
          )}
        </div>
      </div>

      {/* Modal Adicionar / Editar Cotação */}
      {isPriceModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#ffffff] rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 border border-[#eff4ff]">
            <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  {editingRecord ? 'Editar Cotação Histórica' : 'Registrar Nova Cotação'}
                </h3>
                <p className="text-xs text-[#45464d]">
                  Item: <strong className="text-[#0b1c30]">{selectedItem.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPriceModalOpen(false);
                  setEditingRecord(null);
                  setModalError(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-[#eff4ff] flex items-center justify-center text-[#76777d] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg text-xs font-mono text-[#ba1a1a]">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSavePrice} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">
                  Preço Unitário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={recordPrice}
                  onChange={(e) => setRecordPrice(parseFloat(e.target.value) || 0)}
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] font-mono text-sm focus:border-[#497cff] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">
                  Data da Coleta
                </label>
                <input
                  type="date"
                  required
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] font-mono text-xs focus:border-[#497cff] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-xs text-[#45464d] uppercase tracking-wider font-semibold">
                  Estabelecimento / Origem do Comprovante
                </label>
                <input
                  type="text"
                  required
                  value={recordOrigin}
                  onChange={(e) => setRecordOrigin(e.target.value)}
                  placeholder="Ex: Supermercado, Nota Fiscal, Concessionária..."
                  className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs focus:border-[#497cff] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#eff4ff]">
                <button
                  type="button"
                  onClick={() => {
                    setIsPriceModalOpen(false);
                    setEditingRecord(null);
                    setModalError(null);
                  }}
                  className="h-9 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] font-mono text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingRecord}
                  className="h-9 px-5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#213145] font-mono text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSavingRecord
                    ? 'Salvando...'
                    : editingRecord
                    ? 'Salvar Alterações'
                    : 'Salvar Cotação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(recordToDelete)}
        title="Excluir Cotação Histórica"
        message={
          recordToDelete
            ? `Deseja realmente excluir a cotação de R$ ${formatMoneyBR(recordToDelete.price)} registrada em ${formatIsoDateBR(recordToDelete.referenceDate)}?`
            : ''
        }
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDeleteRecord}
        onCancel={() => setRecordToDelete(null)}
      />
    </div>
  );
};
