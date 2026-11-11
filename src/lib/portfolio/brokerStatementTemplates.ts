export type StatementFieldKey =
  | 'date'
  | 'symbol'
  | 'transactionType'
  | 'currency'
  | 'exchangeRate'
  | 'quantity'
  | 'price'
  | 'totalAmount'
  | 'notes'
  | 'broker';

export const STATEMENT_FIELD_LABELS: Record<StatementFieldKey, string> = {
  date: 'Tarih',
  symbol: 'Sembol / Fon Kodu',
  transactionType: 'İşlem Türü',
  currency: 'Para Birimi',
  exchangeRate: 'Döviz Kuru',
  quantity: 'Miktar / Adet',
  price: 'Birim Fiyat',
  totalAmount: 'Toplam Tutar',
  notes: 'Notlar',
  broker: 'Aracı Kurum',
};

export interface StatementColumnMapping {
  sourceColumn: string;
  targetField: StatementFieldKey;
  targetLabel: string;
}

export interface BrokerStatementTemplate {
  id: 'midas' | 'isbank' | 'garanti' | 'tefas' | 'stockmind';
  name: string;
  brokerName: string;
  description: string;
  signatureHeaders: string[];
  columns: { header: string; field: StatementFieldKey }[];
  sampleRows: string[][];
}

export interface StatementTemplateMatch {
  templateId: string;
  templateName: string;
  brokerName: string;
  confidence: 'exact' | 'partial' | 'custom';
  matchedCount: number;
  mappedColumns: StatementColumnMapping[];
  unmappedColumns: string[];
}

/**
 * Normalizes Turkish & Latin header text for template recognition.
 */
export function normalizeStatementHeader(header: string): string {
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

export const BROKER_STATEMENT_TEMPLATES: readonly BrokerStatementTemplate[] = [
  {
    id: 'midas',
    name: 'Midas Ekstresi',
    brokerName: 'Midas',
    description: 'Midas Hisse ve ABD Piyasası işlem geçmişi CSV/XLSX biçimi',
    signatureHeaders: ['İşlem Tarihi', 'Hisse Sembolü', 'Emir Tipi', 'Döviz', 'Adet', 'Fiyat'],
    columns: [
      { header: 'İşlem Tarihi', field: 'date' },
      { header: 'Hisse Sembolü', field: 'symbol' },
      { header: 'Emir Tipi', field: 'transactionType' },
      { header: 'Döviz', field: 'currency' },
      { header: 'Adet', field: 'quantity' },
      { header: 'Fiyat', field: 'price' },
      { header: 'Toplam Tutar', field: 'totalAmount' },
      { header: 'Aracı Kurum', field: 'broker' },
    ],
    sampleRows: [
      ['2026-04-02', 'THYAO', 'Alış', 'TRY', '100', '295,40', '29.540,00', 'Midas'],
      ['2026-04-05', 'AAPL', 'Alış', 'USD', '5', '224,10', '1.120,50', 'Midas'],
    ],
  },
  {
    id: 'isbank',
    name: 'İş Bankası Yatırım',
    brokerName: 'Türkiye İş Bankası',
    description: 'İş Yatırım / İşCep menkul kıymet hesap hareketi çıktısı',
    signatureHeaders: ['Tarih', 'Menkul Kıymet Kodu', 'İşlem', 'Miktar', 'Birim Fiyat', 'Tutar'],
    columns: [
      { header: 'Tarih', field: 'date' },
      { header: 'Menkul Kıymet Kodu', field: 'symbol' },
      { header: 'İşlem', field: 'transactionType' },
      { header: 'Miktar', field: 'quantity' },
      { header: 'Birim Fiyat', field: 'price' },
      { header: 'Tutar', field: 'totalAmount' },
      { header: 'Para Birimi', field: 'currency' },
      { header: 'Banka', field: 'broker' },
    ],
    sampleRows: [
      ['10.04.2026', 'SISE', 'Alış', '250', '44,80', '11.200,00', 'TRY', 'İş Bankası'],
      ['12.04.2026', 'AKBNK', 'Satış', '100', '61,25', '6.125,00', 'TRY', 'İş Bankası'],
    ],
  },
  {
    id: 'garanti',
    name: 'Garanti BBVA Yatırım',
    brokerName: 'Garanti BBVA',
    description: 'Garanti e-Trader / Borsa ekstresi CSV/Excel biçimi',
    signatureHeaders: ['İşlem Tarihi', 'Hisse Kodu', 'Alış/Satış', 'Adet', 'Fiyat', 'Döviz Türü'],
    columns: [
      { header: 'İşlem Tarihi', field: 'date' },
      { header: 'Hisse Kodu', field: 'symbol' },
      { header: 'Alış/Satış', field: 'transactionType' },
      { header: 'Adet', field: 'quantity' },
      { header: 'Fiyat', field: 'price' },
      { header: 'Döviz Türü', field: 'currency' },
      { header: 'Toplam Tutar', field: 'totalAmount' },
      { header: 'Kurum', field: 'broker' },
    ],
    sampleRows: [
      ['14.04.2026', 'GARAN', 'Alış', '150', '118,40', 'TRY', '17.760,00', 'Garanti BBVA'],
      ['15.04.2026', 'TUPRS', 'Alış', '40', '162,90', 'TRY', '6.516,00', 'Garanti BBVA'],
    ],
  },
  {
    id: 'tefas',
    name: 'TEFAS Fon Ekstresi',
    brokerName: 'TEFAS / Fon Platformu',
    description: 'TEFAS yatırım fonu alım/satım emri ve pay adedi ekstresi',
    signatureHeaders: ['İşlem Tarihi', 'Fon Kodu', 'İşlem Türü', 'Pay Adedi', 'Birim Pay Fiyatı', 'Tutar'],
    columns: [
      { header: 'İşlem Tarihi', field: 'date' },
      { header: 'Fon Kodu', field: 'symbol' },
      { header: 'İşlem Türü', field: 'transactionType' },
      { header: 'Pay Adedi', field: 'quantity' },
      { header: 'Birim Pay Fiyatı', field: 'price' },
      { header: 'Tutar', field: 'totalAmount' },
      { header: 'Açıklama', field: 'notes' },
    ],
    sampleRows: [
      ['16.04.2026', 'AFT', 'Alış', '5000', '0,582400', '2.912,00', 'TEFAS Yabancı Teknoloji Fonu'],
      ['17.04.2026', 'MAC', 'Alış', '3200', '0,415200', '1.328,64', 'Marmara Capital Hisse Fonu'],
    ],
  },
  {
    id: 'stockmind',
    name: 'StockMind Standart Şablon',
    brokerName: 'StockMind',
    description: 'Tüm hisse, fon, altın ve USD/TRY kur alanlarını destekleyen tam şablon',
    signatureHeaders: ['Tarih', 'Hisse Kodu (Sembol)', 'İşlem Türü', 'Döviz Türü', 'Döviz Kuru (USD/TRY)', 'Miktar (Adet)', 'Birim Fiyat'],
    columns: [
      { header: 'Tarih', field: 'date' },
      { header: 'Hisse Kodu (Sembol)', field: 'symbol' },
      { header: 'İşlem Türü', field: 'transactionType' },
      { header: 'Döviz Türü', field: 'currency' },
      { header: 'Döviz Kuru (USD/TRY)', field: 'exchangeRate' },
      { header: 'Miktar (Adet)', field: 'quantity' },
      { header: 'Birim Fiyat', field: 'price' },
      { header: 'Toplam Tutar', field: 'totalAmount' },
      { header: 'Notlar', field: 'notes' },
      { header: 'Aracı Kurum / Kanal', field: 'broker' },
    ],
    sampleRows: [
      ['2026-04-15', 'THYAO', 'Alış', 'TRY', '1,00', '100', '285,50', '28.550,00', 'BIST Havacılık', 'MİDAS'],
    ],
  },
] as const;

const FIELD_HEADER_ALIASES: Record<StatementFieldKey, string[]> = {
  symbol: [
    'hissekodusembol', 'hissekodu', 'hissesembolu', 'sembol', 'symbol', 'ticker',
    'menkulkiymetkodu', 'paykodu', 'fonkodu', 'varlikkodu', 'kiymetkodu',
    'isinkodu', 'isin', 'hisseadi', 'menkulkiymetadi',
  ],
  transactionType: [
    'islemturu', 'islemtipi', 'islemcesidi', 'emirtipi', 'emirturu', 'hareketturu',
    'harekettipi', 'alissatis', 'alimsatim', 'islem', 'action', 'side', 'type',
  ],
  currency: ['dovizturu', 'dovizkodu', 'dovizcinsi', 'parabirimi', 'doviz', 'currency', 'ccy'],
  exchangeRate: ['dovizkuruusdtry', 'dovizkuru', 'usdtrykuru', 'usdkuru', 'islemkuru', 'fxrate', 'exchangerate'],
  quantity: ['miktaradet', 'miktar', 'adet', 'lot', 'payadedi', 'islemadedi', 'hisseadedi', 'shares', 'quantity', 'qty'],
  price: ['birimfiyat', 'birimpayfiyati', 'payfiyati', 'fiyat', 'maliyet', 'ortalamamaliyet', 'alisfiyati', 'satisfiyati', 'islemfiyati', 'unitprice', 'price', 'cost'],
  totalAmount: ['toplamtutar', 'islemtutari', 'tutar', 'nettutar', 'toplam', 'total', 'amount', 'hacim'],
  date: ['islemtarihi', 'harekettarihi', 'tarih', 'date', 'transactiondate', 'valortarihi', 'valor'],
  notes: ['notlar', 'not', 'aciklama', 'notes', 'description'],
  broker: ['aracikurumkanal', 'aracikurum', 'kanal', 'kurum', 'broker', 'banka', 'platform'],
};

function mapHeaderToField(header: string): StatementFieldKey | null {
  const norm = normalizeStatementHeader(header);
  if (!norm) return null;

  for (const [field, aliases] of Object.entries(FIELD_HEADER_ALIASES) as [StatementFieldKey, string[]][]) {
    if (aliases.includes(norm)) return field;
  }

  for (const [field, aliases] of Object.entries(FIELD_HEADER_ALIASES) as [StatementFieldKey, string[]][]) {
    if (aliases.some((alias) => alias.length >= 4 && norm.includes(alias))) return field;
  }

  return null;
}

/**
 * Recognizes the closest built-in broker statement format from parsed column headers
 * and builds explicit column-to-field mappings for the preview UI.
 */
export function detectStatementTemplate(headers: string[]): StatementTemplateMatch {
  const cleanHeaders = headers.map((h) => String(h || '').trim()).filter(Boolean);
  const normalizedSet = new Set(cleanHeaders.map(normalizeStatementHeader));

  let bestTemplate: BrokerStatementTemplate | null = null;
  let bestScore = -1;
  let bestMatchedCount = 0;

  for (const template of BROKER_STATEMENT_TEMPLATES) {
    const sigNorms = template.signatureHeaders.map(normalizeStatementHeader);
    const hits = sigNorms.filter((sig) => normalizedSet.has(sig)).length;
    const score = hits / Math.max(sigNorms.length, 1);

    if (hits > bestMatchedCount || (hits === bestMatchedCount && score > bestScore)) {
      bestMatchedCount = hits;
      bestScore = score;
      bestTemplate = template;
    }
  }

  const mappedColumns: StatementColumnMapping[] = [];
  const unmappedColumns: string[] = [];

  for (const header of cleanHeaders) {
    const field = mapHeaderToField(header);
    if (field) {
      mappedColumns.push({
        sourceColumn: header,
        targetField: field,
        targetLabel: STATEMENT_FIELD_LABELS[field],
      });
    } else {
      unmappedColumns.push(header);
    }
  }

  if (!bestTemplate || bestMatchedCount < 3) {
    return {
      templateId: 'custom',
      templateName: 'Özel / Karma Ekstre Formatı',
      brokerName: 'Genel',
      confidence: 'custom',
      matchedCount: mappedColumns.length,
      mappedColumns,
      unmappedColumns,
    };
  }

  const confidence: 'exact' | 'partial' =
    bestMatchedCount >= bestTemplate.signatureHeaders.length ? 'exact' : 'partial';

  return {
    templateId: bestTemplate.id,
    templateName: bestTemplate.name,
    brokerName: bestTemplate.brokerName,
    confidence,
    matchedCount: bestMatchedCount,
    mappedColumns,
    unmappedColumns,
  };
}

/**
 * Generates semicolon-delimited sample CSV text for any built-in broker statement template.
 */
export function buildBrokerTemplateCsv(
  templateId: string
): { fileName: string; content: string } | null {
  const template = BROKER_STATEMENT_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return null;

  const headerLine = template.columns.map((c) => c.header).join(';');
  const rowLines = template.sampleRows.map((row) => row.join(';'));
  const content = [headerLine, ...rowLines].join('\n') + '\n';
  return {
    fileName: `StockMind_${template.id}_Sablon.csv`,
    content,
  };
}

export function downloadBrokerTemplateCsv(templateId: string) {
  if (typeof window === 'undefined') return;
  const generated = buildBrokerTemplateCsv(templateId);
  if (!generated) return;

  const blob = new Blob(['\uFEFF' + generated.content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', generated.fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
