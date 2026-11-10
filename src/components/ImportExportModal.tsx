import React, { useRef } from 'react';
import { BasketItem } from '../types';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BasketItem[];
  onImportItems: (imported: BasketItem[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  items,
  onImportItems,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
      `"${i.group}"`,
      `"${i.classification}"`,
      i.monthlySpend.toFixed(2).replace('.', ','),
      i.oldPrice.toFixed(2).replace('.', ','),
      i.oldPriceDate,
      i.currentPrice.toFixed(2).replace('.', ','),
      i.currentPriceDate,
      `"${i.unit}"`,
      `"${(i.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ipca_casa_cesta_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Exportar Backup JSON
  const handleExportJSON = () => {
    const jsonContent = JSON.stringify(items, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ipca_casa_backup_${new Date().toISOString().substring(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Importar arquivo JSON ou CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            onImportItems(parsed);
            alert(`Sucesso! ${parsed.length} itens importados do backup JSON.`);
            onClose();
          }
        } else {
          // Parse CSV
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length <= 1) throw new Error('Arquivo vazio');
          const delimiter = lines[0].includes(';') ? ';' : ',';
          const newItems: BasketItem[] = [];

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 5) {
              const name = cols[1] || cols[0];
              const group = (cols[2] || 'Alimentação e bebidas') as any;
              const classification = (cols[3] || 'Essencial') as any;
              const spend = parseFloat(cols[4].replace(',', '.')) || 0;
              const oldP = parseFloat(cols[5]?.replace(',', '.')) || spend;
              const curP = parseFloat(cols[7]?.replace(',', '.')) || spend;

              newItems.push({
                id: `import-${Date.now()}-${i}`,
                profileId: items[0]?.profileId || 'profile-silva-sp',
                name,
                group,
                classification,
                monthlySpend: spend,
                oldPrice: oldP,
                currentPrice: curP,
                oldPriceDate: cols[6] || '2023-03-01',
                currentPriceDate: cols[8] || '2024-03-01',
                unit: cols[9] || 'unidade',
                notes: cols[10] || 'Importado via planilha CSV',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }

          if (newItems.length > 0) {
            onImportItems(newItems);
            alert(`Sucesso! ${newItems.length} itens importados da planilha CSV.`);
            onClose();
          }
        }
      } catch (err) {
        alert('Erro ao processar arquivo. Verifique o formato CSV ou JSON.');
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
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#45464d] hover:bg-[#dce9ff]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-[#45464d] leading-relaxed">
            Exporte a composição completa da cesta familiar com preços, pesos e histórico ou importe planilhas no padrão CSV/JSON.
          </p>

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
              onClick={handleExportCSV}
              className="p-3.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] flex items-center justify-between transition-colors text-left group cursor-pointer"
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
              onClick={handleExportJSON}
              className="p-3.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] flex items-center justify-between transition-colors text-left group cursor-pointer"
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
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] flex items-center justify-between transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[28px] text-[#006a61]">upload_file</span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#0b1c30] group-hover:text-[#006a61] transition-colors">
                    Importar Planilha (CSV ou JSON)
                  </span>
                  <span className="text-xs text-[#45464d]">
                    Carregue dados locais ou de extratos categorizados
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
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#ffffff] hover:bg-[#e5eeff] text-[#0b1c30] text-sm font-medium transition-colors shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
