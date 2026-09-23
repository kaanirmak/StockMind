import * as XLSX from 'xlsx';
import { TransactionFormData, AssetType, TransactionType } from '@/types/portfolio';
import TEFAS_DIRECTORY from '@/lib/data/tefas_funds_directory.json';
import { cleanSymbol } from '@/lib/utils/symbol';

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
 * (e.g. 85,00 -> 85, 5.429,22 -> 5429.22, 49.785,95 -> 49785.95, 9,17 -> 9.17, 2.923361 -> 2.923361)
 * Also handles trailing/leading commas from bad CSV splits (e.g. "2," -> 2)
 */
export function parseCleanNumber(val: any): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  // Remove currency symbols, units and spaces
  str = str.replace(/[₺$€TLUSDTRY\s'"]/gi, '');

  // Strip leading/trailing commas from bad CSV splits (e.g. "2," -> "2", ",5" -> "5")
  str = str.replace(/^,+|,+$/g, '');

  if (str === '') return 0;

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
    // Check if comma is decimal (e.g. 85,00 or 9,17 or 2,923361) vs multiple thousands
    const commas = (str.match(/,/g) || []).length;
    if (commas === 1) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    // Check if multiple dots exist (thousands separators: 1.000.000 -> 1000000)
    const dots = (str.match(/\./g) || []).length;
    if (dots > 1) {
      str = str.replace(/\./g, '');
    }
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
 * Smart CSV parser supporting auto-delimiter detection (;, \t, ,) and quote handling.
 * Prioritises semicolon for Turkish CSV files where comma is the decimal separator.
 */
function parseCsvSmart(text: string): Record<string, any>[] {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  // Detect delimiter: prefer tab > semicolon > comma.
  // Semicolon is strongly preferred for Turkish CSVs because comma is the decimal separator.
  let delimiter = ',';
  if (tabCount >= 3) {
    delimiter = '\t';
  } else if (semiCount >= 2) {
    // Semicolons almost always indicate an intentional delimiter choice (Turkish/European CSVs)
    delimiter = ';';
  } else if (commaCount >= 3) {
    delimiter = ',';
  }

  // Validation: if we chose comma, double-check against data rows.
  // Turkish CSVs with comma delimiter will produce wrong column counts because
  // values like "0,00" and "5.429,22" also contain commas.
  if (delimiter === ',' && lines.length > 1) {
    const headerCols = commaCount + 1;
    // Count semicolons across first data lines — if they consistently produce the same column count,
    // the file is actually semicolon-delimited even if the header had few semicolons.
    const sampleLines = lines.slice(1, Math.min(4, lines.length));
    const dataSemiCounts = sampleLines.map((l) => (l.match(/;/g) || []).length);
    const headerSemiCount = semiCount;
    if (headerSemiCount >= 1 && dataSemiCounts.every((c) => c === headerSemiCount)) {
      delimiter = ';';
    }
  }

  const parseLine = (line: string, delim: string): string[] => {
    const res: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === delim && !inQuote) {
        res.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur.trim());
    return res;
  };

  const headers = parseLine(firstLine, delimiter);
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], delimiter);
    if (cols.length === 0 || cols.every((c) => c === '')) continue;

    const rowObj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = cols[idx] || '';
    });
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Parses Excel or CSV file buffer and converts to validated Transaction items
 */
export async function parseExcelTransactions(file: File | ArrayBuffer): Promise<ExcelParseResponse> {
  let rawRows: Record<string, any>[] = [];

  // Check if it's a CSV or text file
  const isCsv = file instanceof File && (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt'));

  if (isCsv) {
    try {
      const text = await (file as File).text();
      rawRows = parseCsvSmart(text);
    } catch (e) {
      console.warn('Smart CSV parser failed, falling back to XLSX reader:', e);
    }
  }

  if (rawRows.length === 0) {
    const buffer = file instanceof File ? await file.arrayBuffer() : file;
    const workbook = XLSX.read(buffer, {
      type: 'array',
      raw: true,
      cellDates: true,
      codepage: 65001,
    });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      return { totalRows: 0, validRows: [], invalidRows: [] };
    }

    rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });
  }

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
    let currency = String(rawCurrency || 'TRY').toUpperCase().trim();

    // 4. Exchange Rate / Döviz Kuru (USD/TRY)
    const rawFxRate = findVal([
      'dovizkuruusdtry',
      'dovizkuru',
      'usdtrykuru',
      'usdkuru',
      'islemkuru',
      'kur',
      'exchangerate',
      'fxrate',
      'rate',
    ]);
    const parsedFxRate = parseCleanNumber(rawFxRate);
    const exchangeRate = parsedFxRate > 0 ? parsedFxRate : undefined;

    // 5. Quantity / Miktar (Adet)
    const rawQty = findVal(['miktaradet', 'miktar', 'adet', 'lot', 'pay', 'quantity', 'qty', 'shares']);
    const quantity = Math.abs(parseCleanNumber(rawQty));
    if (quantity <= 0) {
      errors.push('Geçerli bir miktar/adet bulunamadı');
    }

    // 6. Unit Price / Birim Fiyat
    const rawPrice = findVal(['birimfiyat', 'fiyat', 'maliyet', 'unitprice', 'price', 'cost']);
    let price = Math.abs(parseCleanNumber(rawPrice));

    // 7. Total Amount / Toplam Tutar
    const rawTotal = findVal(['toplamtutar', 'toplam', 'tutar', 'total', 'amount']);
    const totalAmount = Math.abs(parseCleanNumber(rawTotal));

    // If unit price was missing but total amount and quantity exist, auto-calculate unit price
    if (price <= 0 && totalAmount > 0 && quantity > 0) {
      price = Number((totalAmount / quantity).toFixed(6));
    }

    // 8. Date / Tarih
    const rawDate = findVal(['tarih', 'islemtarihi', 'date', 'transactiondate', 'zaman', 'valor']);
    const transactionDate = parseCleanDate(rawDate);

    // 9. Notes & Broker / Notlar & Aracı Kurum / Kanal
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

    // Detect bonus share (bedelsiz pay) transactions — price=0 is valid for these
    const rawNotesStr = String(rawNotes || '').toLowerCase();
    const isBonusShare =
      rawNotesStr.includes('bedelsiz') ||
      rawNotesStr.includes('bonus') ||
      rawNotesStr.includes('hibe') ||
      rawNotesStr.includes('sermaye artırımı');

    if (price <= 0 && !isBonusShare) {
      errors.push('Geçerli bir birim fiyat veya toplam tutar bulunamadı');
    }

    // 10. Auto-detect Asset Type and Exchange
    const cleaned = cleanSymbol(symbol);
    const finalSymbol = cleaned.symbol;
    const isUsdExchange = cleaned.exchange === 'NASDAQ' || cleaned.exchange === 'NYSE';
    if (isUsdExchange && currency !== 'USD') {
      currency = 'USD';
    }

    const assetType: AssetType = cleaned.assetType || (TEFAS_CODES.has(finalSymbol) ? 'fund' : 'stock');
    const exchange: any = cleaned.exchange || (assetType === 'fund' ? 'TEFAS' : currency === 'USD' ? 'NASDAQ' : 'BIST');

    const txData: TransactionFormData = {
      symbol: finalSymbol,
      assetType,
      transactionType,
      quantity,
      price,
      currency: currency as any,
      exchangeRate,
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
 * Downloads a pre-formatted Excel template file (.xlsx) with USD/TRY FX rate column
 */
export function downloadExcelTemplate() {
  if (typeof window === 'undefined') return;

  const sampleData = [
    {
      'Tarih': '2025-10-10',
      'Hisse Kodu (Sembol)': 'GRAM_ALTIN',
      'İşlem Türü': 'Alış',
      'Döviz Türü': 'TRY',
      'Döviz Kuru (USD/TRY)': 1.00,
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
      'Döviz Kuru (USD/TRY)': 1.00,
      'Miktar (Adet)': 100,
      'Birim Fiyat': 285.50,
      'Toplam Tutar': 28550.00,
      'Notlar': 'BIST 100 Havacılık',
      'Aracı Kurum / Kanal': 'MİDAS',
    },
    {
      'Tarih': '2026-02-20',
      'Hisse Kodu (Sembol)': 'THF',
      'İşlem Türü': 'Alış',
      'Döviz Türü': 'TRY',
      'Döviz Kuru (USD/TRY)': 1.00,
      'Miktar (Adet)': 13328,
      'Birim Fiyat': 2.923361,
      'Toplam Tutar': 38962.56,
      'Notlar': 'TEFAS Para Piyasası Fonu',
      'Aracı Kurum / Kanal': 'İŞ BANKASI',
    },
    {
      'Tarih': '2026-01-10',
      'Hisse Kodu (Sembol)': 'AAPL',
      'İşlem Türü': 'Alış',
      'Döviz Türü': 'USD',
      'Döviz Kuru (USD/TRY)': 34.50,
      'Miktar (Adet)': 10,
      'Birim Fiyat': 225.40,
      'Toplam Tutar': 2254.00,
      'Notlar': 'Apple Teknoloji (USD)',
      'Aracı Kurum / Kanal': 'MİDAS',
    },
    {
      'Tarih': '2026-04-05',
      'Hisse Kodu (Sembol)': 'NVDA',
      'İşlem Türü': 'Alış',
      'Döviz Türü': 'USD',
      'Döviz Kuru (USD/TRY)': 36.80,
      'Miktar (Adet)': 5,
      'Birim Fiyat': 128.50,
      'Toplam Tutar': 642.50,
      'Notlar': 'NVIDIA AI (USD)',
      'Aracı Kurum / Kanal': 'MİDAS',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths for clean readability
  worksheet['!cols'] = [
    { wch: 14 }, // Tarih
    { wch: 22 }, // Hisse Kodu (Sembol)
    { wch: 14 }, // İşlem Türü
    { wch: 12 }, // Döviz Türü
    { wch: 22 }, // Döviz Kuru (USD/TRY)
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
 * Generates and downloads a sample CSV template (.csv) with UTF-8 BOM and USD/TRY FX column
 */
export function downloadCsvTemplate() {
  if (typeof window === 'undefined') return;

  const csvContent =
    'Tarih;Hisse Kodu (Sembol);İşlem Türü;Döviz Türü;Döviz Kuru (USD/TRY);Miktar (Adet);Birim Fiyat;Toplam Tutar;Notlar;Aracı Kurum / Kanal\n' +
    '2025-10-10;GRAM_ALTIN;Alış;TRY;1,00;9,17;5.429,22;49.785,95;ALTIN SPOT;GARANTİ BANKASI\n' +
    '2026-03-15;THYAO;Alış;TRY;1,00;100;285,50;28.550,00;BIST 100 Havacılık;MİDAS\n' +
    '2026-02-20;THF;Alış;TRY;1,00;13328;2,923361;38.962,56;TEFAS Para Piyasası Fonu;İŞ BANKASI\n' +
    '2026-01-10;AAPL;Alış;USD;34,50;10;225,40;2.254,00;Apple Teknoloji (USD);MİDAS\n' +
    '2026-04-05;NVDA;Alış;USD;36,80;5;128,50;642,50;NVIDIA Yapay Zeka;MİDAS\n' +
    '2026-04-05;EREGL;Satış;TRY;1,00;50;52,80;2.640,00;Kar realizasyonu;GARANTİ BANKASI\n';

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
    'Döviz Türü': t.currency || (t.exchange === 'NASDAQ' || t.exchange === 'NYSE' ? 'USD' : 'TRY'),
    'Döviz Kuru (USD/TRY)': t.exchangeRate || (t.currency === 'USD' || t.exchange === 'NASDAQ' ? 34.50 : 1.00),
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
    { wch: 22 },
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
