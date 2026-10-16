// Explicit company aliases avoid treating generic economic words as portfolio matches.
const companyAliases: Record<string, string[]> = {
  ASELS: ['aselsan'], THYAO: ['türk hava yolları', 'turkish airlines'],
  MGROS: ['migros'], FROTO: ['ford otosan'], CCOLA: ['coca cola içecek', 'coca-cola içecek'],
  SISE: ['şişecam', 'şişe cam'], BIMAS: ['bim birleşik mağazalar'],
  TUPRS: ['tüpraş'], GARAN: ['garanti bbva', 'garanti bankası'],
  KCHOL: ['koç holding'], ARCLK: ['arçelik'],
  QQQ: ['invesco qqq'],
};
function normalizeNewsText(text: string): string {
  return text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
}
// Month names and ordinary words must never become ticker matches by uppercasing prose.
const ambiguousSymbols = new Set(['EKIM', 'OCAK', 'MART', 'MAYIS', 'ARALIK', 'ON', 'IT', 'ALL', 'ARE', 'FOR']);
export function mentionsNewsSymbol(text: string, symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9_.:=^/-]{1,40}$/.test(normalized)) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`[$#]${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(text)) return true;
  if (ambiguousSymbols.has(normalized)) return false;
  if (new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(text)) return true;
  const normalizedText = normalizeNewsText(text);
  return (companyAliases[normalized] || []).some(alias => {
    const pattern = normalizeNewsText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, 'u').test(normalizedText);
  });
}
