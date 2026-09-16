import * as XLSX from 'xlsx';
import { TransactionFormData, AssetType, TransactionType } from '@/types/portfolio';
import TEFAS_DIRECTORY from '@/lib/data/tefas_funds_directory.json';

export interface ParsedRowResult {
  rowNumber: number;
  data: TransactionFormData;
  isValid: boolean;
  errors: string[];
  raw: Record<string, any>;
}

export interface ExcelParseResponse {
  totalRows: number;
  validRows: ParsedRowResult[];
  invalidRows: ParsedRowResult[];
}

const TEFAS_CODES = new Set(
  (TEFAS_DIRECTORY as { code: string }[]).map((f) => f.code.toUpperCase())
);

/**
 * Normalizes column header names for robust matching
 */
function normalizeHeader(header: string): string {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s\-()\/.]+/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

/**
 * Parses numeric price or quantity handling Turkish comma vs dot decimals
 * (e.g. 5.429,22 -> 5429.22, 49.785,95 -> 49785.95, 9,17 -> 9.17, 285.50 -> 285.5)
 */
function parseCleanNumber(val: any): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  // Remove currency symbols, units and spaces
  str = str.replace(/[₺$€TLUSDTRY\s'"]/gi, '');

  if (str.includes('.') && str.includes(',')) {
    const dotIdx = str.lastIndexOf('.');
    const commaIdx = str.lastIndexOf(',');
    if (commaIdx > dotIdx) {
      // Turkish format: 5.429,22 -> 5429.22
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 5,429.22 -> 5429.22
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Single comma: 9,17 -> 9.17
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalizes date to YYYY-MM-DD format
 */
function parseCleanDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];

  // If Excel serial date number
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();

  // Try parsing YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try parsing DD.MM.YYYY or DD/MM/YYYY
  const trMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (trMatch) {
    const day = trMatch[1].padStart(2, '0');
    const month = trMatch[2].padStart(2, '0');
    const year = trMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback to JS Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Normalizes transaction type (buy / sell)
 */
function parseTransactionType(val: any): TransactionType {
  const str = String(val || '')
    .trim()
    .toLowerCase();

  if (
    str.includes('sat') ||
    str.includes('sell') ||
    str === 's' ||
    str.startsWith('-') ||
    str.includes('cikis')
  ) {
    return 'sell';
  }
  return 'buy';
}

/**
 * Parses Excel or CSV file buffer and converts to validated Transaction items
 */
export async function parseExcelTransactions(file: File | ArrayBuffer): Promise<ExcelParseResponse> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    return { totalRows: 0, validRows: [], invalidRows: [] };
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const validRows: ParsedRowResult[] = [];
  const invalidRows: ParsedRowResult[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 considering 1-based index and header row
    const errors: string[] = [];

    // Find keys by fuzzy header matching
    const keys = Object.keys(row);

    const findVal = (patterns: string[]): any => {
      for (const key of keys) {
        const normKey = normalizeHeader(key);
        if (patterns.some((p) => normKey.includes(normalizeHeader(p)))) {
          return row[key];
        }
      }
      return undefined;
    };

    // 1. Symbol / Hisse Kodu (Sembol)
    const rawSymbol =
      findVal(['hissekodusembol', 'hissekodu', 'sembol', 'kod', 'symbol', 'hisse', 'fon', 'ticker', 'varlik']) || '';
    let symbol = String(rawSymbol).trim().toUpperCase();

    if (!symbol) {
      errors.push('Hisse Kodu (Sembol) eksik');
    }

    // 2. Transaction Type / İşlem Türü
    const rawType = findVal(['islemturu', 'islemtipi', 'islem', 'tur', 'tip', 'action', 'type', 'alissatis']);
    const transactionType = parseTransactionType(rawType);

    // 3. Currency / Döviz Türü
    const rawCurrency = findVal(['dovizturu', 'doviz', 'parabirimi', 'currency']);
    const currency = String(rawCurrency || 'TRY').toUpperCase().trim();

    // 4. Quantity / Miktar (Adet)
    const rawQty = findVal(['miktaradet', 'miktar', 'adet', 'lot', 'pay', 'quantity', 'qty', 'shares']);
    const quantity = Math.abs(parseCleanNumber(rawQty));
    if (quantity <= 0) {
      errors.push('Geçerli bir miktar/adet bulunamadı');
    }

    // 5. Unit Price / Birim Fiyat
    const rawPrice = findVal(['birimfiyat', 'fiyat', 'maliyet', 'unitprice', 'price', 'cost']);
    let price = Math.abs(parseCleanNumber(rawPrice));

    // 6. Total Amount / Toplam Tutar
    const rawTotal = findVal(['toplamtutar', 'toplam', 'tutar', 'total', 'amount']);
    const totalAmount = Math.abs(parseCleanNumber(rawTotal));

    // If unit price was missing but total amount and quantity exist, auto-calculate unit price
    if (price <= 0 && totalAmount > 0 && quantity > 0) {
      price = Number((totalAmount / quantity).toFixed(4));
    }

    if (price <= 0) {
      errors.push('Geçerli bir birim fiyat veya toplam tutar bulunamadı');
    }

    // 7. Date / Tarih
    const rawDate = findVal(['tarih', 'islemtarihi', 'date', 'transactiondate', 'zaman', 'valor']);
    const transactionDate = parseCleanDate(rawDate);

    // 8. Notes & Broker / Notlar & Aracı Kurum / Kanal
    const rawNotes = findVal(['notlar', 'not', 'aciklama', 'notes', 'description']);
    const rawBroker = findVal(['aracikurumkanal', 'aracikurum', 'kanal', 'kurum', 'broker', 'banka', 'platform']);

    const notesParts: string[] = [];
    if (rawNotes && String(rawNotes).trim().length > 0) {
      notesParts.push(String(rawNotes).trim());
    }
    if (rawBroker && String(rawBroker).trim().length > 0) {
      notesParts.push(`[${String(rawBroker).trim()}]`);
    }
    const notes = notesParts.join(' ');

    // 9. Auto-detect Asset Type and Exchange
    let assetType: AssetType = 'stock';
    let exchange: any = 'BIST';

    if (
      symbol === 'GRAM_ALTIN' ||
      symbol === 'GRAM ALTIN' ||
      symbol === 'ALTIN' ||
      symbol === 'XAUTRYG' ||
      symbol === 'XAUTRY' ||
      symbol === 'GRAM_GUMUS' ||
      symbol === 'XAGTRYG'
    ) {
      assetType = 'stock';
      exchange = 'BIST';
      if (symbol === 'GRAM_ALTIN' || symbol === 'GRAM ALTIN' || symbol === 'ALTIN') {
        symbol = 'GRAM_ALTIN';
      }
    } else if (TEFAS_CODES.has(symbol)) {
      assetType = 'fund';
      exchange = 'TEFAS';
    } else if (currency === 'USD' || ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META'].includes(symbol)) {
      assetType = 'stock';
      exchange = 'NASDAQ';
    } else {
      assetType = 'stock';
      exchange = 'BIST';
    }

    const txData: TransactionFormData = {
      symbol,
      assetType,
      transactionType,
      quantity,
      price,
      commission: 0,
      transactionDate,
      exchange,
      notes,
    };

    const result: ParsedRowResult = {
      rowNumber,
      data: txData,
      isValid: errors.length === 0,
      errors,
      raw: row,
    };

    if (result.isValid) {
      validRows.push(result);
    } else {
      invalidRows.push(result);
    }
  });

  return {
    totalRows: rawRows.length,
    validRows,
    invalidRows,
  };
}

/**
 * Helper to download Blob safely in cross-browser Next.js / React client
 */
function downloadBlob(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Generates and downloads a sample Excel template (.xlsx) with the exact user requested columns
 */
export function downloadExcelTemplate() {
  if (typeof window === 'undefined') return;

  const sampleData = [
    {
      'Tarih': '2025-10-10',
      'Hisse Kodu (Sembol)': 'GRAM_ALTIN',
      'İşlem Türü': 'Alış',
      'Döviz Türü': 'TRY',
      'Miktar (Adet)': 9.17,
      'Birim Fiyat': 5429.22,
      'Toplam Tutar': 49785.95,
      'Notlar': 'ALTIN SPOT',
      'Aracı Kurum / Kanal': 'GARANTİ BANKASI',
    },
    {
      'Tarih': '2026-03-15',
      'Hisse Kodu (Sembol)': 'THYAO',
      'İşlem Türü': 'Alış',
      'Döviz Türü': 'TRY',
      'Miktar (Adet)': 100,
      'Birim Fiyat': 285.50,
      'Toplam Tutar': 28550.00,
      'Notlar': 'BIST 100 Havacılık',
      'Aracı Kurum / Kanal': 'MİDAS',
    },
    {
      'Tarih': '2026-02-20',
      'Hisse Kodu (Sembol)': 'TI2',
      'İşlem Türü': 'Alış',
      'Döviz Türü': 'TRY',
      'Miktar (Adet)': 25000,
      'Birim Fiyat': 0.1287,
      'Toplam Tutar': 3217.50,
      'Notlar': 'İş Portföy Hisse Fonu',
      'Aracı Kurum / Kanal': 'İŞ BANKASI',
    },
    {
      'Tarih': '2026-01-10',
      'Hisse Kodu (Sembol)': 'AAPL',
      'İşlem Türü': 'Alış',
      'Döviz Türü': 'USD',
      'Miktar (Adet)': 10,
      'Birim Fiyat': 225.40,
      'Toplam Tutar': 2254.00,
      'Notlar': 'Apple Teknoloji',
      'Aracı Kurum / Kanal': 'MİDAS',
    },
    {
      'Tarih': '2026-04-05',
      'Hisse Kodu (Sembol)': 'EREGL',
      'İşlem Türü': 'Satış',
      'Döviz Türü': 'TRY',
      'Miktar (Adet)': 50,
      'Birim Fiyat': 52.80,
      'Toplam Tutar': 2640.00,
      'Notlar': 'Kar realizasyonu',
      'Aracı Kurum / Kanal': 'GARANTİ BANKASI',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths for clean readability
  worksheet['!cols'] = [
    { wch: 14 }, // Tarih
    { wch: 22 }, // Hisse Kodu (Sembol)
    { wch: 14 }, // İşlem Türü
    { wch: 12 }, // Döviz Türü
    { wch: 15 }, // Miktar (Adet)
    { wch: 15 }, // Birim Fiyat
    { wch: 16 }, // Toplam Tutar
    { wch: 25 }, // Notlar
    { wch: 24 }, // Aracı Kurum / Kanal
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'İşlemler');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  downloadBlob(blob, 'StockMind_Portfoy_Sablonu.xlsx');
}

/**
 * Generates and downloads a sample CSV template (.csv) with UTF-8 BOM
 */
export function downloadCsvTemplate() {
  if (typeof window === 'undefined') return;

  const csvContent =
    'Tarih,Hisse Kodu (Sembol),İşlem Türü,Döviz Türü,Miktar (Adet),Birim Fiyat,Toplam Tutar,Notlar,Aracı Kurum / Kanal\n' +
    '2025-10-10,GRAM_ALTIN,Alış,TRY,9.17,5429.22,49785.95,ALTIN SPOT,GARANTİ BANKASI\n' +
    '2026-03-15,THYAO,Alış,TRY,100,285.50,28550.00,BIST 100 Havacılık,MİDAS\n' +
    '2026-02-20,TI2,Alış,TRY,25000,0.1287,3217.50,İş Portföy Hisse Fonu,İŞ BANKASI\n' +
    '2026-01-10,AAPL,Alış,USD,10,225.40,2254.00,Apple Teknoloji,MİDAS\n' +
    '2026-04-05,EREGL,Satış,TRY,50,52.80,2640.00,Kar realizasyonu,GARANTİ BANKASI\n';

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, 'StockMind_Portfoy_Sablonu.csv');
}

/**
 * Exports transaction history to formatted Excel file (.xlsx)
 */
export function exportTransactionsToExcel(transactions: any[], portfolioName: string = 'Portfoy') {
  if (typeof window === 'undefined') return;

  const exportData = transactions.map((t) => ({
    'Tarih': t.transactionDate,
    'Hisse Kodu (Sembol)': t.symbol,
    'İşlem Türü': t.transactionType === 'buy' ? 'Alış' : 'Satış',
    'Döviz Türü': t.exchange === 'NASDAQ' || t.exchange === 'NYSE' ? 'USD' : 'TRY',
    'Miktar (Adet)': t.quantity,
    'Birim Fiyat': t.price,
    'Toplam Tutar': Number((t.quantity * t.price).toFixed(2)),
    'Notlar': t.notes || '',
    'Aracı Kurum / Kanal': t.exchange || 'BIST',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 16 },
    { wch: 25 },
    { wch: 24 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'İşlem Geçmişi');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  downloadBlob(blob, `${portfolioName}_Islem_Gecmisi_${new Date().toISOString().split('T')[0]}.xlsx`);
}
