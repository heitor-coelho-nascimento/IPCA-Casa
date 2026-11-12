import React, { useEffect, useRef, useState } from 'react';
import { BasketItem, ProfileMode } from '../types';
import { trackExportData } from '../services/analytics';
import { extractIsoDatePrefix, getMonthsAgoIsoDate, getTodayIsoDate } from '../utils/dates';
import {
  AmbiguityPreference,
  buildDuplicateSignature,
  CsvPreviewResult,
  normalizeClassificationLabel,
  parseCsvForPreview,
} from '../utils/csvImport';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BasketItem[];
  activeProfileId?: string;
  profileMode?: ProfileMode;
  onImportItems: (imported: BasketItem[]) => void | Promise<void>;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface JsonPreviewSummary {
  fileName: string;
  totalRows: number;
  validItems: BasketItem[];
  duplicateCount: number;
  invalidRows: string[];
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  items,
  activeProfileId,
  profileMode = 'pessoal',
  onImportItems,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);

  // Estado de prévia para CSV
  const [pendingCsvText, setPendingCsvText] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [ambiguityPreference, setAmbiguityPreference] = useState<AmbiguityPreference>('ask');
  const [csvPreview, setCsvPreview] = useState<CsvPreviewResult | null>(null);

  // Estado de prévia para JSON
  const [jsonPreview, setJsonPreview] = useState<JsonPreviewSummary | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setImporting(false);
      setPendingCsvText(null);
      setPendingFileName('');
      setAmbiguityPreference('ask');
      setCsvPreview(null);
      setJsonPreview(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetProfileId = activeProfileId || items[0]?.profileId || 'profile-clean-slate';
  const isBiz = profileMode === 'negocio';

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

  const resetPreviews = () => {
    setPendingCsvText(null);
    setPendingFileName('');
    setAmbiguityPreference('ask');
    setCsvPreview(null);
    setJsonPreview(null);
  };

  const handleAmbiguityChange = (pref: AmbiguityPreference) => {
    setAmbiguityPreference(pref);
    if (!pendingCsvText) return;
    try {
      const updated = parseCsvForPreview({
        text: pendingCsvText,
        existingItems: items,
        targetProfileId,
        ambiguityPreference: pref,
      });
      setCsvPreview(updated);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao reprocessar planilha CSV.',
      });
    }
  };

  // Carrega arquivo para PRÉVIA (nunca grava direto sem conferência)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedback(null);
    resetPreviews();
    const defaultOldDate = getMonthsAgoIsoDate(12);
    const defaultCurrentDate = getTodayIsoDate();

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '').replace(/^\uFEFF/, '');

        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            throw new Error('O arquivo JSON deve conter uma lista de itens da cesta.');
          }
          const stamp = Date.now();
          const existingIds = new Set(items.filter((i) => !i.isArchived).map((i) => i.id));
          const existingSigs = new Set(
            items.filter((i) => !i.isArchived).map((i) => buildDuplicateSignature(i))
          );
          const seenInFile = new Set<string>();

          const validItems: BasketItem[] = [];
          const invalidRows: string[] = [];
          let duplicateCount = 0;

          parsed.forEach((raw, idx) => {
            if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.name.trim()) {
              invalidRows.push(`Registro #${idx + 1}: nome ausente.`);
              return;
            }
            const name = raw.name.trim();
            const spend = Number(raw.monthlySpend);
            const oldP = raw.oldPrice === undefined || raw.oldPrice === '' ? 0 : Number(raw.oldPrice);
            const curP = Number(raw.currentPrice);

            if (!Number.isFinite(spend) || spend < 0) {
              invalidRows.push(`"${name}": gasto mensal inválido.`);
              return;
            }
            if (!Number.isFinite(oldP) || oldP < 0) {
              invalidRows.push(`"${name}": preço antigo inválido.`);
              return;
            }
            if (!Number.isFinite(curP) || curP < 0) {
              invalidRows.push(`"${name}": preço atual inválido.`);
              return;
            }

            const group = String(raw.group || 'Alimentação e bebidas').trim() || 'Alimentação e bebidas';
            const unit = String(raw.unit || 'unidade').trim() || 'unidade';
            const id =
              typeof raw.id === 'string' && raw.id.trim()
                ? raw.id.trim()
                : `import-${stamp}-${idx}`;
            const sig = buildDuplicateSignature({ name, group, unit });

            if (existingIds.has(id) || existingSigs.has(sig) || seenInFile.has(sig)) {
              duplicateCount++;
              return;
            }
            seenInFile.add(sig);

            validItems.push({
              id,
              profileId: targetProfileId,
              name,
              description: typeof raw.description === 'string' ? raw.description : undefined,
              group,
              classification: normalizeClassificationLabel(raw.classification),
              monthlySpend: spend,
              oldPrice: oldP,
              currentPrice: curP,
              oldPriceDate: extractIsoDatePrefix(raw.oldPriceDate) || defaultOldDate,
              currentPriceDate: extractIsoDatePrefix(raw.currentPriceDate) || defaultCurrentDate,
              unit,
              notes: typeof raw.notes === 'string' ? raw.notes : 'Importado via JSON',
              dataOrigin: 'usuario',
              active: raw.active !== false,
              isArchived: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          });

          setJsonPreview({
            fileName: file.name,
            totalRows: parsed.length,
            validItems,
            duplicateCount,
            invalidRows,
          });
        } else {
          const preview = parseCsvForPreview({
            text,
            existingItems: items,
            targetProfileId,
            ambiguityPreference: 'ask',
          });
          setPendingCsvText(text);
          setPendingFileName(file.name);
          setAmbiguityPreference('ask');
          setCsvPreview(preview);
        }
      } catch (err) {
        const errMsg =
          err instanceof Error && err.message
            ? err.message
            : 'Erro ao ler o arquivo. Verifique o formato CSV ou JSON.';
        setFeedback({ type: 'error', message: errMsg });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (importing) return;

    let itemsToImport: BasketItem[] = [];
    if (csvPreview) {
      if (csvPreview.hasAmbiguousRows) {
        setFeedback({
          type: 'error',
          message: 'Escolha primeiro como interpretar os números ambíguos (milhar ou decimal).',
        });
        return;
      }
      itemsToImport = csvPreview.rows
        .filter((r) => r.status === 'valid' && r.itemPayload)
        .map((r) => r.itemPayload!);
    } else if (jsonPreview) {
      itemsToImport = jsonPreview.validItems;
    }

    if (itemsToImport.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Nenhum registro válido e inédito disponível para importar.',
      });
      return;
    }

    setImporting(true);
    try {
      await onImportItems(itemsToImport);
      const msg = `${itemsToImport.length} ${itemsToImport.length === 1 ? 'item importado' : 'itens importados'} com sucesso!`;
      onNotify?.('success', msg);
      onClose();
    } catch (err) {
      const errMsg =
        err instanceof Error && err.message
          ? err.message
          : 'Erro ao salvar itens importados.';
      setFeedback({ type: 'error', message: errMsg });
      onNotify?.('error', errMsg);
    } finally {
      setImporting(false);
    }
  };

  const isPreviewOpen = Boolean(csvPreview || jsonPreview);

  return (
    <div className="fixed inset-0 bg-[#213145]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`bg-[#ffffff] rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden max-h-[90vh] ${
          isPreviewOpen ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        {/* Modal Header */}
        <div className="p-6 bg-[#eff4ff] flex items-center justify-between border-b border-[#e5eeff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#0b1c30]">sync_alt</span>
            <span className="text-xl font-bold text-[#0b1c30]">
              {isPreviewOpen
                ? 'Prévia e Validação de Importação'
                : isBiz
                ? 'Importar / Exportar Insumos e Custos'
                : 'Importar / Exportar Cesta'}
            </span>
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
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-mono border ${
                feedback.type === 'error'
                  ? 'bg-[#ffdad6]/50 border-[#ba1a1a]/30 text-[#ba1a1a]'
                  : feedback.type === 'info'
                  ? 'bg-[#eff4ff] border-[#497cff]/30 text-[#0b1c30]'
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

          {/* PRÉVIA DE CSV */}
          {csvPreview && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#eff4ff] p-3 rounded-xl text-xs">
                <div>
                  <span className="font-bold text-[#0b1c30] block">Arquivo: {pendingFileName}</span>
                  <span className="text-[#45464d]">
                    Separador detectado: <strong className="font-mono">{csvPreview.delimiter}</strong> •{' '}
                    {csvPreview.summary.totalRows} linha(s) analisada(s)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetPreviews}
                  className="px-3 py-1.5 rounded-lg bg-[#ffffff] text-[#0b1c30] font-mono text-xs border border-[#dce9ff] cursor-pointer"
                >
                  Escolher outro arquivo
                </button>
              </div>

              {/* Resumo quantitativo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                <div className="p-2.5 rounded-lg bg-[#86f2e4]/25 border border-[#006a61]/20">
                  <span className="text-[#005049] block text-[11px]">Serão importados</span>
                  <strong className="text-base text-[#006a61]">{csvPreview.summary.validCount}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#dce9ff]/50 border border-[#497cff]/20">
                  <span className="text-[#0b1c30] block text-[11px]">Ambíguos</span>
                  <strong className="text-base text-[#497cff]">{csvPreview.summary.ambiguousCount}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dce9ff]">
                  <span className="text-[#45464d] block text-[11px]">Duplicados (ignorados)</span>
                  <strong className="text-base text-[#0b1c30]">{csvPreview.summary.duplicateCount}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#ffdad6]/40 border border-[#ba1a1a]/20">
                  <span className="text-[#ba1a1a] block text-[11px]">Com problemas</span>
                  <strong className="text-base text-[#ba1a1a]">{csvPreview.summary.invalidCount}</strong>
                </div>
              </div>

              {/* Resolução de números ambíguos (ex.: 1.234 ou 1,234) */}
              {(csvPreview.hasAmbiguousRows || ambiguityPreference !== 'ask') && (
                <div className="p-3.5 rounded-xl bg-[#fff8eb] border border-[#f59e0b]/40 flex flex-col gap-2 text-xs">
                  <div className="font-semibold text-[#92400e] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">help</span>
                    <span>
                      Encontramos valores com 3 dígitos após ponto ou vírgula (ex.: 1.234 ou 1,234). Como devemos ler?
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAmbiguityChange('thousand')}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer border ${
                        ambiguityPreference === 'thousand'
                          ? 'bg-[#0b1c30] text-[#ffffff] border-[#0b1c30]'
                          : 'bg-[#ffffff] text-[#0b1c30] border-[#c6c6cd]'
                      }`}
                    >
                      Milhar (ex.: 1.234 → R$ 1.234,00)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAmbiguityChange('decimal')}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer border ${
                        ambiguityPreference === 'decimal'
                          ? 'bg-[#0b1c30] text-[#ffffff] border-[#0b1c30]'
                          : 'bg-[#ffffff] text-[#0b1c30] border-[#c6c6cd]'
                      }`}
                    >
                      Decimal (ex.: 1.234 → R$ 1,23)
                    </button>
                  </div>
                </div>
              )}

              {/* Tabela de Prévia */}
              <div className="border border-[#eff4ff] rounded-xl overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#eff4ff] text-[#45464d] font-mono sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Linha</th>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 text-right">Gasto/Mês</th>
                      <th className="py-2 px-3 text-right">Preço Atual</th>
                      <th className="py-2 px-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eff4ff]">
                    {csvPreview.rows.map((row) => (
                      <tr key={row.rowNumber} className="hover:bg-[#f8f9ff]">
                        <td className="py-2 px-3 font-mono text-[#76777d]">#{row.rowNumber}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-[#0b1c30]">{row.name}</div>
                          <div className="text-[11px] text-[#76777d]">
                            {row.group} · {row.unit}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {row.monthlySpend !== null
                            ? `R$ ${row.monthlySpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : row.rawSpend || '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {row.currentPrice !== null
                            ? `R$ ${row.currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : row.rawCurrentPrice || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded font-semibold ${
                              row.status === 'valid'
                                ? 'bg-[#86f2e4]/30 text-[#006a61]'
                                : row.status === 'ambiguous'
                                ? 'bg-[#dce9ff] text-[#497cff]'
                                : row.status === 'duplicate'
                                ? 'bg-[#eff4ff] text-[#45464d]'
                                : 'bg-[#ffdad6] text-[#ba1a1a]'
                            }`}
                          >
                            {row.status === 'valid'
                              ? 'Pronto'
                              : row.status === 'ambiguous'
                              ? 'Ambíguo'
                              : row.status === 'duplicate'
                              ? 'Duplicado'
                              : 'Inválido'}
                          </span>
                          {(row.issues.length > 0 || row.ambiguousFields.length > 0) && (
                            <p className="text-[10px] text-[#76777d] mt-0.5">
                              {[...row.issues, ...row.ambiguousFields].join(' ')}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PRÉVIA DE JSON */}
          {jsonPreview && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#eff4ff] p-3 rounded-xl text-xs">
                <div>
                  <span className="font-bold text-[#0b1c30] block">Backup JSON: {jsonPreview.fileName}</span>
                  <span className="text-[#45464d]">
                    {jsonPreview.totalRows} registro(s) lido(s) · {jsonPreview.validItems.length} novo(s) ·{' '}
                    {jsonPreview.duplicateCount} duplicado(s) · {jsonPreview.invalidRows.length} inválido(s)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetPreviews}
                  className="px-3 py-1.5 rounded-lg bg-[#ffffff] text-[#0b1c30] font-mono text-xs border border-[#dce9ff] cursor-pointer"
                >
                  Escolher outro arquivo
                </button>
              </div>

              {jsonPreview.invalidRows.length > 0 && (
                <div className="p-3 rounded-xl bg-[#ffdad6]/30 border border-[#ba1a1a]/20 text-xs text-[#ba1a1a] max-h-36 overflow-y-auto">
                  <strong className="block mb-1">Registros ignorados por erro de validação:</strong>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {jsonPreview.invalidRows.map((msg, idx) => (
                      <li key={idx}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* MENU PADRÃO QUANDO NÃO HÁ PRÉVIA ABERTA */}
          {!isPreviewOpen && (
            <>
              <p className="text-xs text-[#45464d] leading-relaxed">
                Exporte sua lista completa com preços e pesos ou importe planilhas CSV/JSON com conferência prévia e proteção contra itens duplicados.
              </p>

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
                        Exportar Lista Completa (CSV)
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
                        Aceita formatos 1.234,56 e 1234.56 com prévia antes de salvar
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[20px] text-[#76777d]">chevron_right</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#eff4ff] flex items-center justify-between gap-2 border-t border-[#e5eeff]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#ffffff] hover:bg-[#e5eeff] text-[#0b1c30] text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            Fechar
          </button>
          {isPreviewOpen && (
            <button
              type="button"
              disabled={
                importing ||
                Boolean(csvPreview && (csvPreview.hasAmbiguousRows || !csvPreview.canImportValidRows)) ||
                Boolean(jsonPreview && jsonPreview.validItems.length === 0)
              }
              onClick={handleConfirmImport}
              className="px-5 py-2 rounded-lg bg-[#006a61] hover:bg-[#004e47] disabled:opacity-50 text-[#ffffff] text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              {importing
                ? 'Importando...'
                : csvPreview
                ? `Confirmar Importação (${csvPreview.summary.validCount})`
                : `Confirmar Importação (${jsonPreview?.validItems.length ?? 0})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

