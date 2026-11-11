import React, { useEffect, useState, useMemo } from 'react';
import { BasketItem, CalculatedItem, EconomicCalculationSummary, ConsumptionGroup } from '../types';
import { StorageService } from '../services/storage';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatIsoDateBR, getTodayIsoDate } from '../utils/dates';

interface BasketViewProps {
  summary: EconomicCalculationSummary;
  onOpenNewItem: () => void;
  onEditItem: (item: BasketItem) => void;
  onDeleteItem: (itemId: string) => void | Promise<void>;
  onOpenImportExport: () => void;
  onViewPriceHistory: (item: BasketItem) => void;
  onRefreshData?: () => void;
  isDemo: boolean;
  groups?: ConsumptionGroup[];
  onSaveGroup?: (group: ConsumptionGroup) => void | Promise<void>;
  onDeleteGroup?: (
    groupId: string
  ) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
  externalSearchTerm?: string;
  onExternalSearchChange?: (term: string) => void;
}

function formatMoneyBR(val: number): string {
  const safe = Number.isFinite(val) ? val : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSignedPercent(val: number, digits = 2): string {
  const safe = Number.isFinite(val) ? val : 0;
  return `${safe > 0 ? '+' : safe < 0 ? '-' : ''}${Math.abs(safe).toFixed(digits).replace('.', ',')}%`;
}

function formatSignedPP(val: number, digits = 2): string {
  const safe = Number.isFinite(val) ? val : 0;
  return `${safe > 0 ? '+' : safe < 0 ? '-' : ''}${Math.abs(safe).toFixed(digits).replace('.', ',')} p.p.`;
}

export const BasketView: React.FC<BasketViewProps> = ({
  summary,
  onOpenNewItem,
  onEditItem,
  onDeleteItem,
  onOpenImportExport,
  onViewPriceHistory,
  onRefreshData = () => {},
  isDemo,
  groups: propGroups,
  onSaveGroup,
  onDeleteGroup,
  externalSearchTerm,
  onExternalSearchChange,
}) => {
  const [searchTerm, setSearchTerm] = useState(externalSearchTerm ?? '');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'spend-desc' | 'weight-desc' | 'inflation-desc' | 'name-asc'>('spend-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    if (externalSearchTerm !== undefined && externalSearchTerm !== searchTerm) {
      setSearchTerm(externalSearchTerm);
      setCurrentPage(1);
    }
  }, [externalSearchTerm, searchTerm]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
    onExternalSearchChange?.(value);
  };

  const handleClearFilters = () => {
    handleSearchChange('');
    setSelectedGroup('ALL');
    setSelectedClass('ALL');
    setCurrentPage(1);
  };

  // Category Manager Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [groups, setGroups] = useState<ConsumptionGroup[]>(() => propGroups ?? StorageService.getGroups());

  useEffect(() => {
    if (propGroups) {
      setGroups(propGroups);
    } else {
      setGroups(StorageService.getGroups());
    }
  }, [propGroups, isDemo]);

  // Confirm delete modal state
  const [itemToDelete, setItemToDelete] = useState<CalculatedItem | null>(null);

  const {
    totalMonthlySpend,
    totalItemsCount,
    essentialCount,
    superfluousCount,
    ipcaCasa12M,
    ipcaIBGE12M,
    spreadPP,
    calculatedItems,
    sumOfWeights,
    timeframeLabel,
  } = summary;

  // Filtragem e ordenação
  const filteredItems = useMemo(() => {
    return calculatedItems
      .filter((item) => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          item.group.toLowerCase().includes(q);

        const matchesGroup = selectedGroup === 'ALL' || item.group === selectedGroup;
        const matchesClass = selectedClass === 'ALL' || item.classification === selectedClass;

        return matchesSearch && matchesGroup && matchesClass;
      })
      .sort((a, b) => {
        if (sortBy === 'spend-desc') return b.monthlySpend - a.monthlySpend;
        if (sortBy === 'weight-desc') return b.weightPercent - a.weightPercent;
        if (sortBy === 'inflation-desc') {
          const valB = b.priceChangePercent !== null ? b.priceChangePercent : -9999;
          const valA = a.priceChangePercent !== null ? a.priceChangePercent : -9999;
          return valB - valA;
        }
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [calculatedItems, searchTerm, selectedGroup, selectedClass, sortBy]);

  // Paginação segura
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCategoriesUpdated = () => {
    if (!propGroups) {
      setGroups(StorageService.getGroups());
    }
    onRefreshData();
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      const targetId = itemToDelete.id;
      setItemToDelete(null);
      await onDeleteItem(targetId);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div className="px-6 lg:px-12 py-6 flex flex-col gap-6 max-w-[1440px] mx-auto w-full">
        {/* Top Notice Banner */}
        <div className="bg-[#eff4ff] rounded-xl px-4 py-3 flex items-center justify-between shadow-sm border border-[#e5eeff]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006a61] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#006a61]" />
            </span>
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="font-mono uppercase font-bold text-[#0b1c30]">
                {isDemo ? 'Modo demonstração' : 'Cesta Familiar Ativa'}
              </span>
              <span className="text-[#76777d]">—</span>
              <span className="text-[#45464d]">
                {isDemo
                  ? 'Dados de demonstração — valores fictícios, não representam estatísticas oficiais.'
                  : 'Sua cesta familiar está sincronizada com armazenamento seguro.'}
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center font-mono text-xs text-[#76777d]">
            <span>Cesta Atualizada: {formatIsoDateBR(getTodayIsoDate())}</span>
          </div>
        </div>

        {/* Metric Summary Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">Orçamento Total Cesta</span>
              <span className="material-symbols-outlined text-[#006a61] text-[20px]">account_balance_wallet</span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                R$ {totalMonthlySpend.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs">
              <span className="text-[#76777d]">Soma exata das despesas do ciclo</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">Total de Itens Monitorados</span>
              <span className="material-symbols-outlined text-[#497cff] text-[20px]">inventory_2</span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#0b1c30] tracking-tight tabular-nums font-mono">
                {totalItemsCount} <span className="text-sm text-[#76777d] font-normal">itens</span>
              </span>
            </div>
            <div className="mt-2 text-xs text-[#76777d]">
              <span>{essentialCount} Essenciais</span> <span className="text-[#c6c6cd]">•</span>{' '}
              <span>{superfluousCount} Supérfluos</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">IPCA-Casa Acumulado</span>
              <span
                className={`material-symbols-outlined text-[20px] ${
                  ipcaCasa12M > 0 ? 'text-[#ba1a1a]' : ipcaCasa12M < 0 ? 'text-[#006a61]' : 'text-[#45464d]'
                }`}
              >
                {ipcaCasa12M < 0 ? 'trending_down' : 'trending_up'}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold tracking-tight tabular-nums font-mono ${
                  ipcaCasa12M > 0 ? 'text-[#ba1a1a]' : ipcaCasa12M < 0 ? 'text-[#006a61]' : 'text-[#0b1c30]'
                }`}
              >
                {formatSignedPercent(ipcaCasa12M)}
              </span>
              <span className="text-xs font-mono text-[#76777d]">{timeframeLabel}</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs">
              <span
                className={`font-semibold font-mono ${
                  spreadPP > 0 ? 'text-[#ba1a1a]' : 'text-[#006a61]'
                }`}
              >
                {formatSignedPP(spreadPP)}
              </span>
              <span className="text-[#76777d]">
                vs. IBGE ({formatSignedPercent(ipcaIBGE12M)})
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm flex flex-col justify-between border border-[#eff4ff]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#45464d] font-semibold">Equilíbrio da Ponderação</span>
              <span className="material-symbols-outlined text-[#006a61] text-[20px]">donut_large</span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#006a61] tracking-tight tabular-nums font-mono">
                {sumOfWeights.toFixed(1).replace('.', ',')}%
              </span>
            </div>
            <div className="mt-2 text-xs text-[#76777d]">
              <span>{summary.eligibleItemsCount} com preço base válido</span>
            </div>
          </div>
        </div>

        {/* Search, Action Toolbar & Filtering */}
        <div className="bg-[#ffffff] rounded-2xl p-5 shadow-sm flex flex-col gap-4 border border-[#eff4ff]">
          {/* Row 1: Search & Main Buttons */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-0 max-w-xl">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[20px] text-[#45464d]">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar por produto, marca, serviço ou categoria..."
                className="w-full h-10 pl-10 pr-10 rounded-lg bg-[#eff4ff] text-[#0b1c30] placeholder:text-[#76777d] text-sm focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#006a61] transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-2.5 text-[#76777d] hover:text-[#0b1c30] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="h-10 px-3.5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-medium flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                title="Criar ou gerenciar categorias de consumo"
              >
                <span className="material-symbols-outlined text-[18px] text-[#006a61]">category</span>
                <span>Categorias ({groups.length})</span>
              </button>

              <button
                type="button"
                onClick={onOpenImportExport}
                className="h-10 px-3.5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-medium flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                <span>Importar / Exportar</span>
              </button>

              <button
                type="button"
                onClick={onOpenNewItem}
                className="h-10 px-4 rounded-lg bg-[#000000] hover:bg-[#213145] text-[#ffffff] text-xs font-mono font-semibold flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Novo Item</span>
              </button>
            </div>
          </div>

          {/* Row 2: Filtering Controls */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-1 border-t border-[#eff4ff]">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Category Dropdown */}
              <div className="relative flex items-center min-w-[210px] w-full sm:w-auto">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-[#45464d] pointer-events-none">category</span>
                <select
                  value={selectedGroup}
                  onChange={(e) => {
                    setSelectedGroup(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-9 pl-9 pr-8 bg-[#eff4ff] text-[#0b1c30] rounded-lg text-xs appearance-none focus:outline-none focus:bg-[#ffffff] cursor-pointer font-medium"
                >
                  <option value="ALL">Todas as Categorias ({groups.length})</option>
                  {groups.map((grp) => (
                    <option key={grp.id} value={grp.name}>
                      {grp.name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2.5 text-[18px] text-[#45464d] pointer-events-none">arrow_drop_down</span>
              </div>

              {/* Classification Filter Chips */}
              <div className="flex items-center bg-[#eff4ff] p-1 rounded-lg">
                {(['ALL', 'Essencial', 'Supérfluo', 'Não classificado'] as const).map((cls) => {
                  const isSelected = selectedClass === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => {
                        setSelectedClass(cls);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#ffffff] text-[#0b1c30] shadow-sm font-semibold'
                          : 'text-[#45464d] hover:text-[#0b1c30]'
                      }`}
                    >
                      {cls === 'ALL' ? 'Todos' : cls}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-xs text-[#76777d] font-mono">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 bg-[#eff4ff] text-[#0b1c30] rounded-lg text-xs font-mono font-medium focus:outline-none cursor-pointer"
              >
                <option value="spend-desc">Maior Gasto (R$)</option>
                <option value="weight-desc">Maior Peso (%)</option>
                <option value="inflation-desc">Maior Variação de Preço</option>
                <option value="name-asc">Nome (A - Z)</option>
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto rounded-xl border border-[#eff4ff]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#eff4ff] text-[#45464d] font-mono uppercase tracking-wider text-[11px] border-b border-[#e5eeff]">
                  <th className="py-3 px-4 font-semibold">Produto / Serviço</th>
                  <th className="py-3 px-4 font-semibold">Categoria</th>
                  <th className="py-3 px-4 font-semibold text-right">Gasto Mensal</th>
                  <th className="py-3 px-4 font-semibold text-right">Peso na Cesta</th>
                  <th className="py-3 px-4 font-semibold text-right">Preço Base</th>
                  <th className="py-3 px-4 font-semibold text-right">Preço Atual</th>
                  <th className="py-3 px-4 font-semibold text-center">Variação %</th>
                  <th className="py-3 px-4 font-semibold text-center">Classificação</th>
                  <th className="py-3 px-4 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff] text-[#0b1c30]">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 px-6 text-center text-[#76777d]">
                      {calculatedItems.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
                          <span className="material-symbols-outlined text-[32px] text-[#497cff]">
                            shopping_basket
                          </span>
                          <span className="text-sm font-bold text-[#0b1c30]">
                            Sua cesta familiar ainda está vazia
                          </span>
                          <span className="text-xs text-[#45464d]">
                            Adicione os produtos e despesas fixas da sua casa para calcular seu IPCA-Casa pessoal.
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={onOpenNewItem}
                              className="h-9 px-4 rounded-lg bg-[#000000] hover:bg-[#213145] text-[#ffffff] text-xs font-mono font-semibold cursor-pointer"
                            >
                              Cadastrar Primeiro Item
                            </button>
                            <button
                              type="button"
                              onClick={onOpenImportExport}
                              className="h-9 px-4 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-semibold cursor-pointer"
                            >
                              Importar Planilha
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span>Nenhum item encontrado com os filtros selecionados.</span>
                          <button
                            type="button"
                            onClick={handleClearFilters}
                            className="h-8 px-3 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-semibold cursor-pointer"
                          >
                            Limpar Filtros
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#eff4ff]/60 transition-colors">
                      {/* Name & Unit */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-[#0b1c30]">{item.name}</span>
                          <span className="text-[11px] font-mono text-[#76777d]">
                            Unidade: {item.unit || 'un'} {item.description ? `• ${item.description}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Group */}
                      <td className="py-3.5 px-4 text-[#45464d] font-medium truncate max-w-[150px]">
                        {item.group}
                      </td>

                      {/* Gasto Mensal */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-xs">
                        R$ {formatMoneyBR(item.monthlySpend)}
                      </td>

                      {/* Peso na Cesta */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-xs text-[#006a61]">
                        {item.weightPercent.toFixed(2).replace('.', ',')}%
                      </td>

                      {/* Preço Base */}
                      <td
                        className="py-3.5 px-4 text-right font-mono text-xs text-[#76777d] tabular-nums"
                        title={item.oldPriceDate ? `Data base: ${formatIsoDateBR(item.oldPriceDate)}` : undefined}
                      >
                        {item.oldPrice > 0 ? `R$ ${formatMoneyBR(item.oldPrice)}` : '—'}
                      </td>

                      {/* Preço Atual */}
                      <td
                        className="py-3.5 px-4 text-right font-mono text-xs font-semibold tabular-nums text-[#0b1c30]"
                        title={
                          item.currentPriceDate
                            ? `Última coleta: ${formatIsoDateBR(item.currentPriceDate)}`
                            : undefined
                        }
                      >
                        {item.currentPrice > 0 ? `R$ ${formatMoneyBR(item.currentPrice)}` : '—'}
                      </td>

                      {/* Variação */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {item.priceChangePercent !== null ? (
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-mono text-xs font-bold ${
                              item.priceChangePercent > 0
                                ? 'text-[#ba1a1a] bg-[#ffdad6]/60'
                                : item.priceChangePercent < 0
                                ? 'text-[#006a61] bg-[#86f2e4]/40'
                                : 'text-[#45464d] bg-[#eff4ff]'
                            }`}
                          >
                            {item.priceChangePercent > 0 && (
                              <span className="material-symbols-outlined text-[13px]">arrow_upward</span>
                            )}
                            {item.priceChangePercent < 0 && (
                              <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
                            )}
                            {formatSignedPercent(item.priceChangePercent, 1)}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] text-[#76777d] bg-[#eff4ff]"
                            title="Preço anterior não cadastrado"
                          >
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Classificação */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.classification === 'Essencial'
                              ? 'bg-[#dce9ff] text-[#0b1c30]'
                              : item.classification === 'Supérfluo'
                              ? 'bg-[#86f2e4]/30 text-[#005049]'
                              : 'bg-[#eff4ff] text-[#76777d]'
                          }`}
                        >
                          {item.classification}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
                            title="Editar item"
                          >
                            <span className="material-symbols-outlined text-[17px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewPriceHistory(item)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
                            title="Histórico de preços"
                          >
                            <span className="material-symbols-outlined text-[17px]">show_chart</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#ffdad6] hover:text-[#ba1a1a] transition-colors cursor-pointer"
                            title="Excluir item"
                          >
                            <span className="material-symbols-outlined text-[17px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Summary Footer & Pagination */}
          <div className="bg-[#eff4ff] p-4 flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl border border-[#e5eeff]">
            <div className="flex flex-wrap items-center gap-6 font-mono text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#006a61]" />
                <span className="text-[#45464d]">Itens Filtrados:</span>
                <span className="font-bold text-[#0b1c30]">{filteredItems.length} de {calculatedItems.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#45464d]">Gasto Mensal:</span>
                <span className="font-bold text-[#0b1c30]">
                  R$ {filteredItems.reduce((acc, i) => acc + i.monthlySpend, 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg bg-[#ffffff] border border-[#c6c6cd] disabled:opacity-40 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="text-[#45464d]">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg bg-[#ffffff] border border-[#c6c6cd] disabled:opacity-40 cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesUpdated={handleCategoriesUpdated}
        groups={propGroups}
        onSaveGroup={onSaveGroup}
        onDeleteGroup={onDeleteGroup}
      />

      {/* Confirm Item Deletion Modal */}
      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        title="Excluir Item da Cesta"
        message={`Deseja realmente excluir "${itemToDelete?.name}"? O item será arquivado e removido dos cálculos atuais, preservando o histórico para auditoria.`}
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
