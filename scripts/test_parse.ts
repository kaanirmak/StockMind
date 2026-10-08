/**
 * Test: Simulate full portfolio calculation with the real CSV data
 * Specifically trace PHE and THF transactions
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseCleanNumber } from '../src/lib/portfolio/excelParser';
import { cleanSymbol } from '../src/lib/utils/symbol';

const csvPath = process.argv[2] || path.join(process.cwd(), 'sample_portfolio.csv');
if (!fs.existsSync(csvPath)) {
  console.log(`[test_parse] CSV file not found at: ${csvPath}\nUsage: npx tsx scripts/test_parse.ts <path-to-csv>`);
  process.exit(0);
}
const text = fs.readFileSync(csvPath, 'utf-8');

// Parse with the same logic as parseCsvSmart
function parseCSV(text: string) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const parseLine = (line: string, delim: string): string[] => {
    const res: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (c === delim && !inQuote) { res.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    res.push(cur.trim());
    return res;
  };
  const headers = parseLine(lines[0], ',');
  return lines.slice(1).map(line => {
    const cols = parseLine(line, ',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
}

const rows = parseCSV(text);

// Parse transaction type
function parseTransactionType(val: string): 'buy' | 'sell' {
  const str = val.trim().toLowerCase();
  if (str.includes('sat') || str.includes('sell') || str === 's' || str.startsWith('-') || str.includes('cikis')) return 'sell';
  return 'buy';
}

console.log('=== PHE (MUTF:PHE) Transaction Trace ===\n');

let pheShares = 0;
let pheCost = 0;
const pheRows = rows.filter(r => r['Hisse Kodu (Sembol)']?.includes('PHE'));

for (const r of pheRows) {
  const raw = cleanSymbol(r['Hisse Kodu (Sembol)']);
  const type = parseTransactionType(r['İşlem Türü']);
  const qty = parseCleanNumber(r['Miktar (Adet)']);
  const price = parseCleanNumber(r['Birim Fiyat']);
  const total = parseCleanNumber(r['Toplam Tutar']);

  if (type === 'buy') {
    pheShares += qty;
    pheCost += qty * price;
  } else {
    const avgCost = pheShares > 0 ? pheCost / pheShares : 0;
    pheShares = Math.max(0, pheShares - qty);
    pheCost = pheShares * avgCost;
  }

  console.log(`  ${r['Tarih']} | ${type.toUpperCase().padEnd(4)} | Qty: ${qty.toString().padStart(6)} | Price: ${price.toFixed(2).padStart(8)} | Total: ${total.toFixed(2).padStart(10)} | Remaining: ${pheShares.toFixed(2).padStart(8)} | Symbol: ${raw.symbol} (${raw.assetType})`);
}
console.log(`\n  PHE Final: ${pheShares} shares, ₺${pheCost.toFixed(2)} cost`);
console.log(`  ${pheShares === 0 ? '✅ Fully sold (should NOT appear in holdings)' : '❌ Still has shares (WILL appear in holdings)'}`);

console.log('\n\n=== THF (FON:THF) Transaction Trace ===\n');

let thfShares = 0;
let thfCost = 0;
const thfRows = rows.filter(r => r['Hisse Kodu (Sembol)']?.includes('THF'));

for (const r of thfRows) {
  const raw = cleanSymbol(r['Hisse Kodu (Sembol)']);
  const type = parseTransactionType(r['İşlem Türü']);
  const qty = parseCleanNumber(r['Miktar (Adet)']);
  const price = parseCleanNumber(r['Birim Fiyat']);
  const total = parseCleanNumber(r['Toplam Tutar']);

  if (type === 'buy') {
    thfShares += qty;
    thfCost += qty * price;
  } else {
    const avgCost = thfShares > 0 ? thfCost / thfShares : 0;
    thfShares = Math.max(0, thfShares - qty);
    thfCost = thfShares * avgCost;
  }

  console.log(`  ${r['Tarih']} | ${type.toUpperCase().padEnd(4)} | Qty: ${qty.toString().padStart(6)} | Price: ${price.toFixed(2).padStart(8)} | Total: ${total.toFixed(2).padStart(10)} | Remaining: ${thfShares.toFixed(2).padStart(8)} | Symbol: ${raw.symbol} (${raw.assetType})`);
}
console.log(`\n  THF Final: ${thfShares} shares, ₺${thfCost.toFixed(2)} cost`);
console.log(`  ${thfShares > 0 ? '✅ Has shares (SHOULD appear in holdings)' : '❌ Zero shares (will NOT appear)'}`);

// Now simulate full portfolio calculation
console.log('\n\n=== Full Portfolio Holdings Simulation ===\n');

type HoldingAccum = {
  symbol: string;
  assetType: string;
  exchange: string;
  totalShares: number;
  totalBuyCost: number;
  lastPrice: number;
};

const map = new Map<string, HoldingAccum>();

// Sort by date
const sortedRows = [...rows].sort((a, b) =>
  new Date(a['Tarih']).getTime() - new Date(b['Tarih']).getTime()
);

for (const r of sortedRows) {
  const { symbol: sym, assetType, exchange } = cleanSymbol(r['Hisse Kodu (Sembol)']);
  const effectiveType = assetType || 'stock';
  const key = `${effectiveType}_${sym}`;
  const type = parseTransactionType(r['İşlem Türü']);
  const qty = parseCleanNumber(r['Miktar (Adet)']);
  const price = parseCleanNumber(r['Birim Fiyat']);

  const existing = map.get(key) || {
    symbol: sym,
    assetType: effectiveType,
    exchange,
    totalShares: 0,
    totalBuyCost: 0,
    lastPrice: price,
  };

  existing.lastPrice = price;

  if (type === 'buy') {
    existing.totalShares += qty;
    existing.totalBuyCost += qty * price;
  } else {
    const avgCost = existing.totalShares > 0 ? existing.totalBuyCost / existing.totalShares : 0;
    existing.totalShares = Math.max(0, existing.totalShares - qty);
    existing.totalBuyCost = existing.totalShares * avgCost;
  }

  map.set(key, existing);
}

// Print all non-zero holdings
const holdings = Array.from(map.values())
  .filter(h => h.totalShares > 0.001)
  .sort((a, b) => b.totalBuyCost - a.totalBuyCost);

console.log(`  ${holdings.length} active holdings:\n`);
console.log('  Symbol'.padEnd(16) + 'Type'.padEnd(8) + 'Shares'.padStart(12) + 'Avg Cost'.padStart(12) + 'Total Cost'.padStart(14));
console.log('  ' + '-'.repeat(60));

let totalCost = 0;
for (const h of holdings) {
  const avgCost = h.totalShares > 0 ? h.totalBuyCost / h.totalShares : 0;
  totalCost += h.totalBuyCost;
  console.log(
    `  ${h.symbol.padEnd(14)} ${h.assetType.padEnd(8)} ${h.totalShares.toFixed(2).padStart(12)} ${avgCost.toFixed(2).padStart(12)} ${('₺' + h.totalBuyCost.toFixed(2)).padStart(14)}`
  );
}
console.log('  ' + '-'.repeat(60));
console.log(`  ${'TOPLAM'.padEnd(46)} ${('₺' + totalCost.toFixed(2)).padStart(14)}`);

// Check if PHE and THF are in holdings
console.log('\n=== Key Checks ===');
const hasPHE = holdings.some(h => h.symbol === 'PHE');
const hasTHF = holdings.some(h => h.symbol === 'THF');
console.log(`  PHE in holdings: ${hasPHE ? '❌ YES (should be fully sold)' : '✅ NO (correctly sold out)'}`);
console.log(`  THF in holdings: ${hasTHF ? '✅ YES (correct)' : '❌ NO (MISSING - BUG!)'}`);

// Check all zero holdings too
console.log('\n=== Zero-Holdings (fully sold) ===');
const zeroHoldings = Array.from(map.values()).filter(h => h.totalShares <= 0.001);
for (const h of zeroHoldings) {
  console.log(`  ${h.symbol} (${h.assetType}): ${h.totalShares.toFixed(4)} shares`);
}
