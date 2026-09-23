'use client';

import React, { useState, useRef } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Modal, Button, Badge, useToast } from '@/components/ui';
import {
  parseExcelTransactions,
  downloadExcelTemplate,
  downloadCsvTemplate,
  ParsedRowResult,
} from '@/lib/portfolio/excelParser';

export interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose }) => {
  const { addBatchTransactions, clearPortfolioTransactions, activePortfolioId, portfolios } = usePortfolioStore();
  const { showToast } = useToast();

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [validRows, setValidRows] = useState<ParsedRowResult[]>([]);
  const [invalidRows, setInvalidRows] = useState<ParsedRowResult[]>([]);
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('valid');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePort = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];

  const resetState = () => {
    setFile(null);
    setValidRows([]);
    setInvalidRows([]);
    setIsParsing(false);
    setIsSubmitting(false);
    setActiveTab('valid');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some((ext) => selectedFile.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      showToast({
        type: 'danger',
        title: 'Geçersiz Dosya Formatı',
        message: 'Lütfen .xlsx, .xls veya .csv uzantılı bir Excel/CSV dosyası yükleyin.',
      });
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);

    try {
      const result = await parseExcelTransactions(selectedFile);
      setValidRows(result.validRows);
      setInvalidRows(result.invalidRows);

      if (result.validRows.length > 0) {
        showToast({
          type: 'success',
          title: 'Dosya Ayrıştırıldı',
          message: `${result.validRows.length} geçerli işlem başarıyla algılandı.${
            result.invalidRows.length > 0 ? ` (${result.invalidRows.length} satırda hata var)` : ''
          }`,
        });
      } else {
        showToast({
          type: 'warning',
          title: 'Geçerli İşlem Bulunamadı',
          message: 'Yüklenen dosyada içe aktarılacak uygun sütun veya satır tespit edilemedi.',
        });
      }
    } catch (err: any) {
      console.error('Excel parse error:', err);
      showToast({
        type: 'danger',
        title: 'Ayrıştırma Hatası',
        message: 'Dosya okunurken bir hata oluştu. Lütfen şablon formatına uygun olduğundan emin olun.',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemoveRow = (index: number) => {
    setValidRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;

    setIsSubmitting(true);
    try {
      if (overwriteExisting && activePortfolioId) {
        await clearPortfolioTransactions(activePortfolioId);
      }

      const txPayload = validRows.map((r) => ({
        portfolioId: activePortfolioId,
        symbol: r.data.symbol,
        assetType: r.data.assetType,
        transactionType: r.data.transactionType,
        quantity: r.data.quantity,
        price: r.data.price,
        currency: r.data.currency || 'TRY',
        exchangeRate: r.data.exchangeRate,
        commission: r.data.commission,
        transactionDate: r.data.transactionDate,
        exchange: r.data.exchange,
        notes: r.data.notes || `Excel İçe Aktarım (${file?.name || 'Excel'})`,
      }));

      const inserted = await addBatchTransactions(txPayload);

      if (inserted && inserted.length > 0) {
        showToast({
          type: 'success',
          title: 'İçe Aktarma Başarılı',
          message: `${inserted.length} işlem "${activePort?.name || 'Portföy'}" hesabınıza başarıyla eklendi.`,
        });
        handleClose();
      } else {
        showToast({
          type: 'danger',
          title: 'Hata',
          message: 'İşlemler kaydedilirken bir hata oluştu.',
        });
      }
    } catch (err: any) {
      console.error('Batch import error:', err);
      showToast({
        type: 'danger',
        title: 'Hata',
        message: err.message || 'İçe aktarma sırasında bir sorun oluştu.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalValidCost = validRows.reduce((acc, r) => {
    const isUsd = (r.data.currency || '').toUpperCase() === 'USD' || r.data.exchange === 'NASDAQ' || r.data.exchange === 'NYSE';
    const rate = isUsd ? (r.data.exchangeRate && r.data.exchangeRate > 0 ? r.data.exchangeRate : 38.5) : 1.0;
    const txCost = (r.data.quantity * r.data.price * rate) + ((r.data.commission || 0) * (isUsd ? rate : 1.0));
    // Buy adds to cost, sell reduces it
    return r.data.transactionType === 'sell' ? acc - txCost : acc + txCost;
  }, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Excel / CSV ile İşlem Yükle"
      size="xl"
    >
      <div className="space-y-5">
        {/* Step 1: Upload Zone */}
        {!file && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-accent bg-accent/10 scale-[1.01]'
                  : 'border-border hover:border-accent/60 hover:bg-bg-secondary/60 bg-bg-secondary/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>

              <h4 className="text-base font-semibold text-text-primary mb-1">
                Excel veya CSV Dosyanızı Sürükleyin veya Seçin
              </h4>
              <p className="text-xs text-text-secondary max-w-md mx-auto mb-4">
                Banka ve aracı kurum ekstrelerinizi (Midas, İş Bankası, Garanti, Yapı Kredi, TEFAS vb.) doğrudan yükleyebilirsiniz.
              </p>

              <div className="flex items-center justify-center gap-2 text-xs font-medium text-text-muted">
                <span className="px-2.5 py-1 rounded-md bg-bg-card border border-border">.XLSX</span>
                <span className="px-2.5 py-1 rounded-md bg-bg-card border border-border">.XLS</span>
                <span className="px-2.5 py-1 rounded-md bg-bg-card border border-border">.CSV</span>
              </div>
            </div>

            {/* Template Info & Download */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-bg-secondary border border-border/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-text-primary">Örnek Excel Formatı</h5>
                  <p className="text-[11px] text-text-secondary">
                    Sembol, İşlem Tipi (Alış/Satış), Adet, Birim Fiyat, Tarih sütunlarını içerir.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadCsvTemplate();
                  }}
                  className="text-xs"
                >
                  <svg className="w-3.5 h-3.5 mr-1 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV Şablon
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadExcelTemplate();
                  }}
                  className="text-xs"
                >
                  <svg className="w-3.5 h-3.5 mr-1 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Excel Şablon (.xlsx)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Parsing State */}
        {isParsing && (
          <div className="py-12 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-text-primary">Excel dosyası ayrıştırılıyor...</p>
          </div>
        )}

        {/* Step 3: File Loaded & Preview Table */}
        {!isParsing && file && (
          <div className="space-y-4">
            {/* File Header & Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-bg-secondary border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-text-primary truncate max-w-xs">{file.name}</h4>
                  <p className="text-[11px] text-text-secondary">
                    Hedef Portföy: <span className="font-semibold text-text-primary">{activePort?.name}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ✓ {validRows.length} Geçerli
                </span>
                {invalidRows.length > 0 && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    ⚠ {invalidRows.length} Hatalı
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  Değiştir
                </Button>
              </div>
            </div>

            {/* Tabs for Valid vs Invalid */}
            {invalidRows.length > 0 && (
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('valid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'valid'
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Aktarılacak İşlemler ({validRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('invalid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'invalid'
                      ? 'bg-rose-500 text-white'
                      : 'text-rose-400 hover:text-rose-300'
                  }`}
                >
                  Hatalı Satırlar ({invalidRows.length})
                </button>
              </div>
            )}

            {/* Valid Rows Table */}
            {activeTab === 'valid' && (
              <>
                {validRows.length > 0 ? (
                  <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-bg-secondary sticky top-0 z-10 border-b border-border text-text-secondary">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Tarih</th>
                          <th className="py-2.5 px-3 font-semibold">Sembol</th>
                          <th className="py-2.5 px-3 font-semibold">Tür</th>
                          <th className="py-2.5 px-3 font-semibold">Döviz / Kur</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Adet</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Birim Fiyat</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Toplam Tutar</th>
                          <th className="py-2.5 px-3 font-semibold text-center">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {validRows.map((row, idx) => {
                          const isUsd = (row.data.currency || '').toUpperCase() === 'USD' || row.data.exchange === 'NASDAQ' || row.data.exchange === 'NYSE';
                          const fxRate = isUsd ? (row.data.exchangeRate && row.data.exchangeRate > 0 ? row.data.exchangeRate : 38.5) : 1.0;
                          const rawTotal = row.data.quantity * row.data.price;
                          const totalInTry = isUsd ? rawTotal * fxRate : rawTotal;

                          return (
                            <tr key={idx} className="hover:bg-bg-secondary/40 transition-colors">
                              <td className="py-2 px-3 text-text-secondary whitespace-nowrap">
                                {row.data.transactionDate}
                              </td>
                              <td className="py-2 px-3 font-bold text-text-primary">
                                {row.data.symbol}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    row.data.transactionType === 'buy'
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-rose-500/15 text-rose-400'
                                  }`}
                                >
                                  {row.data.transactionType === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${isUsd ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-bg-card border border-border text-text-muted'}`}>
                                  {isUsd ? `USD (@ ${fxRate.toFixed(2)})` : 'TRY (₺)'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-text-primary font-medium">
                                {row.data.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                              </td>
                              <td className="py-2 px-3 text-right text-text-primary font-medium">
                                {isUsd ? `$${row.data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : `₺${row.data.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="flex flex-col items-end">
                                  <span className="font-bold text-text-primary">
                                    ₺{totalInTry.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                  </span>
                                  {isUsd && (
                                    <span className="text-[10px] text-text-muted">
                                      ${rawTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(idx)}
                                  className="text-text-muted hover:text-rose-400 transition-colors p-1"
                                  title="Bu satırı çıkarma"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-text-muted">
                    Aktarılacak geçerli satır kalmadı.
                  </div>
                )}

                {/* Summary bar & Overwrite checkbox */}
                {validRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-secondary text-xs text-text-secondary">
                      <span>Toplam {validRows.length} İşlem</span>
                      <span className="font-bold text-text-primary">
                        Toplam Portföy Maliyet Karşılığı: ₺{totalValidCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-bg-card hover:bg-bg-secondary/40 cursor-pointer transition-colors text-xs select-none">
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                        className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <span className="font-semibold text-text-primary">Mevcut portföy işlemlerini temizle ve sıfırdan yükle</span>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Eski CSV veya hatalı yüklenmiş geçmiş işlemleri silip sadece bu dosyadaki güncel kayıtları yükler.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </>
            )}

            {/* Invalid Rows Table */}
            {activeTab === 'invalid' && (
              <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-secondary sticky top-0 z-10 border-b border-border text-text-secondary">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Satır #</th>
                      <th className="py-2.5 px-3 font-semibold">Hata Nedeni</th>
                      <th className="py-2.5 px-3 font-semibold">Ham Veri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invalidRows.map((row, idx) => (
                      <tr key={idx} className="bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                        <td className="py-2 px-3 font-bold text-rose-400">Satır {row.rowNumber}</td>
                        <td className="py-2 px-3 text-rose-300 font-medium">
                          {row.errors.join(', ')}
                        </td>
                        <td className="py-2 px-3 text-text-muted truncate max-w-xs text-[11px] font-mono">
                          {JSON.stringify(row.raw)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            İptal
          </Button>

          {file && validRows.length > 0 && (
            <Button
              variant="primary"
              size="md"
              disabled={isSubmitting || validRows.length === 0}
              onClick={handleImport}
              className="px-6"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  İçe Aktarılıyor...
                </div>
              ) : overwriteExisting ? (
                `✓ Portföyü Sıfırla ve ${validRows.length} İşlemi Yükle`
              ) : (
                `✓ ${validRows.length} İşlemi Portföye Ekle`
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
