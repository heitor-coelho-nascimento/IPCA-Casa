import React, { useEffect, useRef, useState } from 'react';
import { BasketItem, ItemClassification } from '../types';
import { trackExportData } from '../services/analytics';
import { extractIsoDatePrefix, getMonthsAgoIsoDate, getTodayIsoDate } from '../utils/dates';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BasketItem[];
  activeProfileId?: string;
  onImportItems: (imported: BasketItem[]) => void | Promise<void>;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeClassification(raw: unknown): ItemClassification {
  if (raw === 'Essencial' || raw === 'Supérfluo' || raw === 'Não classificado') {
    return raw;
  }
  return 'Essencial';
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  items,
  activeProfileId,
  onImportItems,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setImporting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetProfileId = activeProfileId || items[0]?.profileId || 'profile-clean-slate';

  // Exportar CSV formatado para planilhas em Português do Brasil (separador ponto e vírgula)
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Produto ou Serviço',
      'Grupo de Consumo',
      'Classificação',
      'Gasto Mensal (R$)',
      'Preço Antigo (R$)',
      'Data Preço Antigo',
      'Preço Atual (R$)',
      'Data Preço Atual',
      'Unidade',
      'Observações',
    ];

    const rows = items.map((i) => [
      i.id,
      `"${i.name.replace(/"/g, '""')}"`,
      `"${String(i.group || '').replace(/"/g, '""')}"`,
      `"${i.classification}"`,
      i.monthlySpend.toFixed(2).replace('.', ','),
      i.oldPrice.toFixed(2).replace('.', ','),
      i.oldPriceDate,
      i.currentPrice.toFixed(2).replace('.', ','),
      i.currentPriceDate,
      `"${String(i.unit || 'unidade').replace(/"/g, '""')}"`,
      `"${(i.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ipca_casa_cesta_${getTodayIsoDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    trackExportData('csv');
    setFeedback({ type: 'success', message: `${items.length} itens exportados em CSV.` });
  };

  // Exportar Backup JSON
  const handleExportJSON = () => {
    const jsonContent = JSON.stringify(items, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ipca_casa_backup_${getTodayIsoDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    trackExportData('json');
    setFeedback({ type: 'success', message: `Backup JSON gerado com ${items.length} itens.` });
  };

  // Importar arquivo JSON ou CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedback(null);
    const defaultOldDate = getMonthsAgoIsoDate(12);
    const defaultCurrentDate = getTodayIsoDate();

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = String(event.target?.result || '').replace(/^\uFEFF/, '');
        let parsedItems: BasketItem[] = [];

        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            throw new Error('O arquivo JSON deve conter uma lista de itens da cesta.');
          }
          const stamp = Date.now();
          parsedItems = parsed
            .filter((raw) => raw && typeof raw === 'object' && typeof raw.name === 'string' && raw.name.trim())
            .map((raw, idx) => {
              const spend = Number(raw.monthlySpend);
              const oldP = Number(raw.oldPrice);
              const curP = Number(raw.currentPrice);
              return {
                id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `import-${stamp}-${idx}`,
                profileId: targetProfileId,
                name: String(raw.name).trim(),
                description: typeof raw.description === 'string' ? raw.description : undefined,
                group: String(raw.group || 'Alimentação e bebidas'),
                classification: normalizeClassification(raw.classification),
                monthlySpend: Number.isFinite(spend) && spend >= 0 ? spend : 0,
                oldPrice: Number.isFinite(oldP) && oldP >= 0 ? oldP : 0,
                currentPrice: Number.isFinite(curP) && curP >= 0 ? curP : 0,
                oldPriceDate: extractIsoDatePrefix(raw.oldPriceDate) || defaultOldDate,
                currentPriceDate: extractIsoDatePrefix(raw.currentPriceDate) || defaultCurrentDate,
                unit: String(raw.unit || 'unidade'),
                notes: typeof raw.notes === 'string' ? raw.notes : 'Importado via JSON',
                active: raw.active !== false,
                isArchived: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            });
        } else {
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length <= 1) {
            throw new Error('Planilha CSV vazia ou sem linhas de dados.');
          }
          const delimiter = lines[0].includes(';') ? ';' : ',';
          const stamp = Date.now();

          for (let i = 1; i < lines.length; i++) {
            const cols = parseCsvLine(lines[i], delimiter);
            if (cols.length >= 5) {
              const name = (cols[1] || cols[0] || '').trim();
              if (!name) continue;
              const group = (cols[2] || 'Alimentação e bebidas').trim();
              const classification = normalizeClassification(cols[3]);
              const spendRaw = parseFloat((cols[4] || '').replace(/\./g, '').replace(',', '.'));
              const spend = Number.isFinite(spendRaw) && spendRaw >= 0 ? spendRaw : 0;
              const oldRaw = parseFloat((cols[5] || '').replace(/\./g, '').replace(',', '.'));
              const curRaw = parseFloat((cols[7] || '').replace(/\./g, '').replace(',', '.'));
              const oldP = Number.isFinite(oldRaw) && oldRaw >= 0 ? oldRaw : spend;
              const curP = Number.isFinite(curRaw) && curRaw >= 0 ? curRaw : spend;

              parsedItems.push({
                id: `import-${stamp}-${i}`,
                profileId: targetProfileId,
                name,
                group,
                classification,
                monthlySpend: spend,
                oldPrice: oldP,
                currentPrice: curP,
                oldPriceDate: extractIsoDatePrefix(cols[6]) || defaultOldDate,
                currentPriceDate: extractIsoDatePrefix(cols[8]) || defaultCurrentDate,
                unit: cols[9] || 'unidade',
                notes: cols[10] || 'Importado via planilha CSV',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }

        if (parsedItems.length === 0) {
          throw new Error('Nenhum item válido encontrado para importação.');
        }

        setImporting(true);
        await onImportItems(parsedItems);
        const msg = `${parsedItems.length} ${parsedItems.length === 1 ? 'item importado' : 'itens importados'} com sucesso!`;
        onNotify?.('success', msg);
        onClose();
      } catch (err) {
        const errMsg =
          err instanceof Error && err.message
            ? err.message
            : 'Erro ao processar arquivo. Verifique o formato CSV ou JSON.';
        setFeedback({ type: 'error', message: errMsg });
        onNotify?.('error', errMsg);
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-[#213145]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#ffffff] rounded-2xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 bg-[#eff4ff] flex items-center justify-between border-b border-[#e5eeff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#0b1c30]">sync_alt</span>
            <span className="text-xl font-bold text-[#0b1c30]">Importar / Exportar Cesta</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#dce9ff] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-[#45464d] leading-relaxed">
            Exporte a composição completa da cesta familiar com preços, pesos e histórico ou importe planilhas no padrão CSV/JSON.
          </p>

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-mono border ${
                feedback.type === 'error'
                  ? 'bg-[#ffdad6]/50 border-[#ba1a1a]/30 text-[#ba1a1a]'
                  : 'bg-[#86f2e4]/20 border-[#006a61]/30 text-[#005049]'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.json"
            className="hidden"
          />

          <div className="flex flex-col gap-2.5">
            {/* Action 1: Export CSV */}
            <button
              type="button"
              disabled={importing}
              onClick={handleExportCSV}
              className="p-3.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] flex items-center justify-between transition-colors text-left group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[28px] text-[#006a61]">table_view</span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#0b1c30] group-hover:text-[#006a61] transition-colors">
                    Exportar Cesta Completa (CSV)
                  </span>
                  <span className="text-xs text-[#45464d]">
                    Compatível com Excel, Google Planilhas e LibreOffice
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[20px] text-[#76777d]">download</span>
            </button>

            {/* Action 2: Export JSON Backup */}
            <button
              type="button"
              disabled={importing}
              onClick={handleExportJSON}
              className="p-3.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] flex items-center justify-between transition-colors text-left group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[28px] text-[#497cff]">data_object</span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#0b1c30] group-hover:text-[#497cff] transition-colors">
                    Exportar Backup Estruturado (JSON)
                  </span>
                  <span className="text-xs text-[#45464d]">
                    Preserva todos os metadados e histórico de cotações
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[20px] text-[#76777d]">download</span>
            </button>

            {/* Action 3: Import File */}
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] flex items-center justify-between transition-colors text-left group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[28px] text-[#006a61]">upload_file</span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#0b1c30] group-hover:text-[#006a61] transition-colors">
                    {importing ? 'Importando registros...' : 'Importar Planilha (CSV ou JSON)'}
                  </span>
                  <span className="text-xs text-[#45464d]">
                    Carregue planilhas categorizadas ou backups do sistema
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[20px] text-[#76777d]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#eff4ff] flex justify-end border-t border-[#e5eeff]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#ffffff] hover:bg-[#e5eeff] text-[#0b1c30] text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

