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
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

  // Check if string matches Turkish dot-thousands with trailing comma (e.g. "1.324,") BEFORE stripping trailing commas
  if (/^\d{1,3}(\.\d{3})+,\s*$/.test(str)) {
    str = str.replace(/[.,]/g, '');
  }

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
    // Comma alone: in Turkish and European formats, comma is decimal separator: 85,00 -> 85.00
    const commas = (str.match(/,/g) || []).length;
    if (commas === 1) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    const dots = (str.match(/\./g) || []).length;
    if (dots > 1) {
      // Multiple dots are always thousands separators: 1.000.000 -> 1000000
      str = str.replace(/\./g, '');
    }
    // Single dot alone: in CSV or standard number strings, single dot is DECIMAL:
    // e.g. 28.55, 28.550, 1.25, 0.50, 1250.75
    // Never strip single dot, as that turns 28.550 into 28550!
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalizes date to YYYY-MM-DD format
 */
function parseCleanDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];

  // If Date object (from XLSX cellDates: true)
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // If Excel serial date number
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
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
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Intelligent two-pass header value finder with exact priority matching and negative filtering.
 * Prevents false positives (e.g. 'Hesap Kodu' matching symbol 'kod', or 'Pay Piyasası' matching quantity 'pay').
 */
function findHeaderValue(
  row: Record<string, any>,
  exactMatches: string[],
  partialMatches: string[],
  excludePatterns: string[] = []
): any {
  const keys = Object.keys(row);

  // Pass 1: Exact match against normalized header
  for (const pattern of exactMatches) {
    const normPattern = normalizeHeader(pattern);
    for (const key of keys) {
      const normKey = normalizeHeader(key);
      if (excludePatterns.some((ex) => normKey.includes(normalizeHeader(ex)))) continue;
      if (normKey === normPattern) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }

  // Pass 2: Partial contains match against normalized header
  for (const pattern of partialMatches) {
    const normPattern = normalizeHeader(pattern);
    for (const key of keys) {
      const normKey = normalizeHeader(key);
      if (excludePatterns.some((ex) => normKey.includes(normalizeHeader(ex)))) continue;
      if (normKey.includes(normPattern)) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }

  return undefined;
}

/**
 * Normalizes transaction type (buy / sell)
 */
function parseTransactionType(val: any): TransactionType {
  const str = String(val || '')
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's');

  if (
    str.includes('sat') ||
    str.includes('sell') ||
    str === 's' ||
    str.startsWith('-') ||
    str.includes('cikis') ||
    str.includes('itfa') ||
    str.includes('tasfiye')
  ) {
    return 'sell';
  }
  return 'buy';
}

/**
 * Smart CSV parser supporting auto-delimiter detection (;, \t, ,) and quote handling.
 * Prioritises semicolon for Turkish CSV files where comma is the decimal separator.
 * Includes column-count validation to detect mismatches from ambiguous delimiters.
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

  /**
   * Tries to parse the CSV with the given delimiter.
   * Returns null if column counts are inconsistent, otherwise returns parsed rows.
   */
  const tryParseWith = (delimiter: string): Record<string, any>[] | null => {
    const headers = parseLine(firstLine, delimiter);
    const headerCount = headers.length;
    if (headerCount < 2) return null;

    const rows: Record<string, any>[] = [];
    let mismatchCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i], delimiter);
      if (cols.length === 0 || cols.every((c) => c === '')) continue;

      if (cols.length !== headerCount) {
        mismatchCount++;
      }

      const rowObj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] || '';
      });
      rows.push(rowObj);
    }

    // If more than half the rows have mismatched column counts, this delimiter is wrong
    if (rows.length > 0 && mismatchCount > rows.length * 0.3) {
      return null;
    }

    return rows;
  };

  // Determine delimiter priority: prefer tab > semicolon > comma
  // Semicolon is strongly preferred for Turkish CSVs because comma is the decimal separator.
  const candidates: string[] = [];

  if (tabCount >= 3) {
    candidates.push('\t');
  }
  if (semiCount >= 2) {
    candidates.push(';');
  }
  if (commaCount >= 3) {
    candidates.push(',');
  }
  // Ensure at least one candidate
  if (candidates.length === 0) {
    if (semiCount >= 1) candidates.push(';');
    else if (commaCount >= 1) candidates.push(',');
    else if (tabCount >= 1) candidates.push('\t');
    else candidates.push(',');
  }

  // Try each candidate delimiter; use the first one that produces consistent column counts
  for (const delim of candidates) {
    const result = tryParseWith(delim);
    if (result !== null && result.length > 0) {
      return result;
    }
  }

  // If all candidates fail column-count validation, try them all as fallback
  // (semicolon first since it's safest for Turkish data)
  for (const fallbackDelim of [';', '\t', ',']) {
    if (candidates.includes(fallbackDelim)) continue;
    const result = tryParseWith(fallbackDelim);
    if (result !== null && result.length > 0) {
      return result;
    }
  }

  // All delimiter strategies failed column-count validation.
  // Return empty to fall through to XLSX library fallback which has its own CSV parser.
  return [];
}

/**
 * Parses Excel or CSV file buffer and converts to validated Transaction items
 */
export async function parseExcelTransactions(file: File | ArrayBuffer): Promise<ExcelParseResponse> {
  let rawRows: Record<string, any>[] = [];

  const buffer = file instanceof File ? await file.arrayBuffer() : file;

  // Check if it's a CSV or text file
  let isCsv = false;
  if (file instanceof File) {
    const ext = file.name.toLowerCase();
    isCsv = ext.endsWith('.csv') || ext.endsWith('.txt') || ext.endsWith('.tsv') || ext.endsWith('.cvs');
  }

  // If not identified by extension, check magic bytes:
  // XLSX is a ZIP archive starting with PK (0x50, 0x4B)
  // Legacy XLS is BIFF starting with 0xD0, 0xCF
  if (!isCsv && buffer.byteLength >= 4) {
    const bytes = new Uint8Array(buffer.slice(0, 4));
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B;
    const isBiff = bytes[0] === 0xD0 && bytes[1] === 0xCF;
    if (!isZip && !isBiff) {
      isCsv = true;
    }
  }

  if (isCsv) {
    try {
      const text = file instanceof File ? await file.text() : new TextDecoder('utf-8').decode(buffer);
      rawRows = parseCsvSmart(text);
    } catch (e) {
      console.warn('Smart CSV parser failed, falling back to XLSX reader:', e);
    }
  }

  if (rawRows.length === 0) {
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

    // 1. Symbol / Hisse Kodu (Sembol)
    // Priority: Explicit stock/fund ticker columns first
    let rawSymbol = findHeaderValue(
      row,
      ['hissekodusembol', 'hissekodu', 'sembol', 'symbol', 'ticker', 'menkulkiymetkodu', 'paykodu', 'fonkodu', 'varlikkodu', 'kiymetkodu', 'hissekodd'],
      ['hissekod', 'fonkod', 'sembol', 'symbol', 'ticker', 'menkulkiymetkod', 'paykod'],
      ['hesap', 'musteri', 'sube', 'takas', 'emir', 'islem', 'kurum', 'banka', 'referans', 'dekont', 'isin', 'adi', 'tanimi', 'unvan', 'doviz', 'fiyat', 'tutar']
    );

    // If no ticker column, fallback to ISIN code
    if (!rawSymbol) {
      rawSymbol = findHeaderValue(
        row,
        ['isinkodu', 'isin', 'isincode'],
        ['isin'],
        ['hesap', 'musteri', 'sube', 'kurum']
      );
    }

    // If still no ticker column, fallback to Asset / Company Name column (e.g. 'Hisse Adı', 'Menkul Kıymet Tanımı')
    if (!rawSymbol) {
      rawSymbol = findHeaderValue(
        row,
        ['hisseadi', 'menkulkiymetadi', 'menkulkiymettanimi', 'fonadi', 'varlikadi', 'kiymetadi', 'sirketunvani', 'unvan'],
        ['hissead', 'fonad', 'kiymetad', 'varlikad'],
        ['hesap', 'musteri', 'sube', 'kurum', 'banka', 'turu', 'tipi']
      );
    }

    let symbol = String(rawSymbol || '').trim().toUpperCase();

    if (!symbol) {
      errors.push('Hisse Kodu (Sembol) eksik');
    }

    // 2. Transaction Type / İşlem Türü
    const rawType = findHeaderValue(
      row,
      ['islemturu', 'islemtipi', 'islemcesidi', 'hareketturu', 'harekettipi', 'alissatis', 'alimsatim', 'islem', 'action', 'side', 'type'],
      ['islemtur', 'islemtip', 'harekettur', 'harekettip', 'alissat', 'alimsat'],
      ['doviz', 'hesap', 'varlik', 'emir', 'piyasa', 'fiyat', 'miktar', 'tutar', 'komisyon']
    );
    const transactionType = parseTransactionType(rawType);

    // 3. Currency / Döviz Türü
    const rawCurrency = findHeaderValue(
      row,
      ['dovizturu', 'dovizkodu', 'dovizcinsi', 'parabirimi', 'doviz', 'currency', 'ccy'],
      ['doviztur', 'dovizkod', 'parabirim', 'currency'],
      ['kur', 'rate', 'fiyat', 'tutar']
    );
    let currency = String(rawCurrency || 'TRY').toUpperCase().trim();

    // 4. Exchange Rate / Döviz Kuru (USD/TRY)
    const rawFxRate = findHeaderValue(
      row,
      ['dovizkuruusdtry', 'dovizkuru', 'usdtrykuru', 'usdkuru', 'islemkuru', 'kur', 'fxrate', 'exchangerate', 'rate'],
      ['dovizkur', 'usdtry', 'islemkur', 'fxrate', 'exchangerate'],
      ['turu', 'cinsi', 'para']
    );
    const parsedFxRate = parseCleanNumber(rawFxRate);
    const exchangeRate = parsedFxRate > 0 ? parsedFxRate : undefined;

    // 5. Quantity / Miktar (Adet)
    // Exclude 'piyasa' (Pay Piyasası), 'fiyat', 'tutar', 'kur'
    const rawQty = findHeaderValue(
      row,
      ['miktaradet', 'miktar', 'adet', 'lot', 'payadedi', 'islemadedi', 'hisseadedi', 'shares', 'quantity', 'qty'],
      ['miktar', 'adet', 'lot', 'payaded', 'shares'],
      ['piyasa', 'fiyat', 'tutar', 'kur', 'oran', 'kar', 'zarar', 'bakiye', 'toplamtutar']
    );
    let quantity = Math.abs(parseCleanNumber(rawQty));

    // 6. Unit Price / Birim Fiyat
    // Exclude 'toplam', 'tutar', 'hacim', 'adet', 'miktar'
    const rawPrice = findHeaderValue(
      row,
      ['birimfiyat', 'fiyat', 'maliyet', 'ortalamamaliyet', 'alisfiyati', 'satisfiyati', 'islemfiyati', 'unitprice', 'price', 'cost'],
      ['birimfiyat', 'alisfiyat', 'satisfiyat', 'islemfiyat', 'fiyat', 'maliyet', 'unitprice', 'cost'],
      ['toplam', 'tutar', 'hacim', 'adet', 'miktar', 'lot', 'payadedi', 'komisyon', 'bakiye']
    );
    let price = Math.abs(parseCleanNumber(rawPrice));

    // 7. Total Amount / Toplam Tutar
    // Exclude 'adet', 'lot', 'pay', 'miktar', 'fiyat'
    const rawTotal = findHeaderValue(
      row,
      ['toplamtutar', 'islemtutari', 'tutar', 'nettutar', 'toplam', 'total', 'amount', 'hacim'],
      ['toplamtutar', 'islemtutar', 'nettutar', 'tutar', 'totalamount', 'total'],
      ['adet', 'lot', 'pay', 'miktar', 'fiyat', 'komisyon', 'bakiye']
    );
    const totalAmount = Math.abs(parseCleanNumber(rawTotal));

    // If unit price was missing but total amount and quantity exist, auto-calculate unit price
    if (price <= 0 && totalAmount > 0 && quantity > 0) {
      price = Number((totalAmount / quantity).toFixed(6));
    }

    // If quantity was missing but total amount and price exist, auto-calculate quantity
    if (quantity <= 0 && totalAmount > 0 && price > 0) {
      quantity = Math.round((totalAmount / price) * 1000000) / 1000000;
    }

    // Sanity check: if quantity, price, and totalAmount all exist, verify consistency
    if (quantity > 0 && price > 0 && totalAmount > 0) {
      const impliedQty = totalAmount / price;
      const ratio = impliedQty / quantity;
      // If parsed quantity is ~1000x smaller or larger due to thousands/decimal delimiter issue
      if (Math.abs(ratio - 1000) < 0.05 || Math.abs(ratio - 0.001) < 0.00005) {
        quantity = Math.round(impliedQty * 1000000) / 1000000;
      }
    }

    if (quantity <= 0) {
      errors.push('Geçerli bir miktar/adet bulunamadı');
    }

    // 8. Date / Tarih
    const rawDate = findHeaderValue(
      row,
      ['islemtarihi', 'harekettarihi', 'tarih', 'date', 'transactiondate', 'zaman', 'valortarihi', 'valor'],
      ['islemtarih', 'harekettarih', 'tarih', 'date', 'valortarih'],
      ['saat', 'vade']
    );
    const transactionDate = parseCleanDate(rawDate);

    // 9. Notes & Broker / Notlar & Aracı Kurum / Kanal
    const rawNotes = findHeaderValue(
      row,
      ['notlar', 'not', 'aciklama', 'notes', 'description'],
      ['not', 'aciklama', 'desc'],
      []
    );
    const rawBroker = findHeaderValue(
      row,
      ['aracikurumkanal', 'aracikurum', 'kanal', 'kurum', 'broker', 'banka', 'platform'],
      ['aracikurum', 'broker', 'banka', 'platform'],
      []
    );

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
