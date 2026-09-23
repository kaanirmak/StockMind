/**
 * Test script with REAL user CSV file
 * Run with: npx tsx scripts/test_parse.ts
 */
import * as fs from 'fs';
import { parseCleanNumber } from '../src/lib/portfolio/excelParser';

// Read the actual file
const csvPath = './sample_portfolio.csv';
const text = fs.readFileSync(csvPath, 'utf-8');

console.log('=== Real CSV File Analysis ===');
console.log(`File size: ${text.length} bytes`);
console.log(`Lines: ${text.split('\n').length}`);
console.log(`First 200 chars: ${text.substring(0, 200)}`);
console.log('');

// Check BOM
if (text.charCodeAt(0) === 0xFEFF) {
  console.log('⚠️ BOM detected');
}

// Analyze first line for delimiters
const firstLine = text.split(/\r?\n/)[0];
const tabCount = (firstLine.match(/\t/g) || []).length;
const semiCount = (firstLine.match(/;/g) || []).length;
const commaCount = (firstLine.match(/,/g) || []).length;
console.log(`Header delimiters: tab=${tabCount} semi=${semiCount} comma=${commaCount}`);

// ---- Simulate parseCsvSmart ----
function parseCsvSmartTest(text: string): { delimiter: string; rows: Record<string, any>[]; headers: string[] } {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { delimiter: '', rows: [], headers: [] };

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
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (c === delim && !inQuote) { res.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    res.push(cur.trim());
    return res;
  };

  const tryParseWith = (delimiter: string): Record<string, any>[] | null => {
    const headers = parseLine(firstLine, delimiter);
    const headerCount = headers.length;
    if (headerCount < 2) return null;
    const rows: Record<string, any>[] = [];
    let mismatchCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i], delimiter);
      if (cols.length === 0 || cols.every((c) => c === '')) continue;
      if (cols.length !== headerCount) mismatchCount++;
      const rowObj: Record<string, any> = {};
      headers.forEach((h, idx) => { rowObj[h] = cols[idx] || ''; });
      rows.push(rowObj);
    }
    if (rows.length > 0 && mismatchCount > rows.length * 0.3) return null;
    return rows;
  };

  const candidates: string[] = [];
  if (tabCount >= 3) candidates.push('\t');
  if (semiCount >= 2) candidates.push(';');
  if (commaCount >= 3) candidates.push(',');
  if (candidates.length === 0) {
    if (semiCount >= 1) candidates.push(';');
    else if (commaCount >= 1) candidates.push(',');
    else candidates.push(',');
  }

  console.log(`  Delimiter candidates: [${candidates.map(d => d === '\t' ? 'TAB' : d === ';' ? 'SEMI' : 'COMMA').join(', ')}]`);

  for (const delim of candidates) {
    const result = tryParseWith(delim);
    const dName = delim === '\t' ? 'TAB' : delim === ';' ? 'SEMI' : 'COMMA';
    if (result !== null && result.length > 0) {
      console.log(`  ✅ ${dName} delimiter worked: ${result.length} rows parsed`);
      return { delimiter: dName, rows: result, headers: parseLine(firstLine, delim) };
    } else {
      console.log(`  ❌ ${dName} delimiter failed (column mismatch or no rows)`);
    }
  }

  for (const fallbackDelim of [';', '\t', ',']) {
    if (candidates.includes(fallbackDelim)) continue;
    const result = tryParseWith(fallbackDelim);
    const dName = fallbackDelim === '\t' ? 'TAB' : fallbackDelim === ';' ? 'SEMI' : 'COMMA';
    if (result !== null && result.length > 0) {
      console.log(`  ✅ Fallback ${dName} delimiter worked: ${result.length} rows parsed`);
      return { delimiter: dName, rows: result, headers: parseLine(firstLine, fallbackDelim) };
    }
  }

  return { delimiter: 'NONE', rows: [], headers: [] };
}

const result = parseCsvSmartTest(text);
console.log(`\n=== Parse Result ===`);
console.log(`Delimiter: ${result.delimiter}`);
console.log(`Headers (${result.headers.length}): ${result.headers.join(' | ')}`);
console.log(`Total rows: ${result.rows.length}`);

if (result.rows.length > 0) {
  console.log('\n=== Sample Row Parsing ===');
  
  // Row 1: GRAM_ALTIN with Turkish numbers
  const r1 = result.rows[0];
  console.log(`\nRow 1: ${JSON.stringify(r1)}`);
  console.log(`  Miktar raw: "${r1['Miktar (Adet)']}" → parsed: ${parseCleanNumber(r1['Miktar (Adet)'])}`);
  console.log(`  Fiyat raw: "${r1['Birim Fiyat']}" → parsed: ${parseCleanNumber(r1['Birim Fiyat'])}`);
  console.log(`  Toplam raw: "${r1['Toplam Tutar']}" → parsed: ${parseCleanNumber(r1['Toplam Tutar'])}`);
  console.log(`  Kur raw: "${r1['Döviz Kuru (USD/TRY)']}" → parsed: ${parseCleanNumber(r1['Döviz Kuru (USD/TRY)'])}`);

  // Row 2: IST:BIMAS with trailing comma quantity "6,"
  const r2 = result.rows[1];
  console.log(`\nRow 2: ${JSON.stringify(r2)}`);
  console.log(`  Miktar raw: "${r2['Miktar (Adet)']}" → parsed: ${parseCleanNumber(r2['Miktar (Adet)'])}`);
  console.log(`  Fiyat raw: "${r2['Birim Fiyat']}" → parsed: ${parseCleanNumber(r2['Birim Fiyat'])}`);
  console.log(`  Toplam raw: "${r2['Toplam Tutar']}" → parsed: ${parseCleanNumber(r2['Toplam Tutar'])}`);

  // Row for bedelsiz pay (line 113)
  const bedelsizRow = result.rows.find(r => 
    String(r['Notlar'] || '').toLowerCase().includes('bedelsiz')
  );
  if (bedelsizRow) {
    console.log(`\nBedelsiz Pay Row: ${JSON.stringify(bedelsizRow)}`);
    console.log(`  Sembol: "${bedelsizRow['Hisse Kodu (Sembol)']}"`);
    console.log(`  Miktar raw: "${bedelsizRow['Miktar (Adet)']}" → parsed: ${parseCleanNumber(bedelsizRow['Miktar (Adet)'])}`);
    console.log(`  Fiyat raw: "${bedelsizRow['Birim Fiyat']}" → parsed: ${parseCleanNumber(bedelsizRow['Birim Fiyat'])}`);
    console.log(`  Notlar: "${bedelsizRow['Notlar']}"`);
  }

  // Row for fund with large quantity "1.324,"
  const fundRow = result.rows.find(r => 
    String(r['Miktar (Adet)'] || '').includes('1.324') || String(r['Miktar (Adet)'] || '').includes('1324')
  );
  if (fundRow) {
    console.log(`\nFund Row (Miktar=1.324): ${JSON.stringify(fundRow)}`);
    console.log(`  Miktar raw: "${fundRow['Miktar (Adet)']}" → parsed: ${parseCleanNumber(fundRow['Miktar (Adet)'])}`);
    console.log(`  Fiyat raw: "${fundRow['Birim Fiyat']}" → parsed: ${parseCleanNumber(fundRow['Birim Fiyat'])}`);
  }

  // Row for QQQ (USD)
  const qqqRow = result.rows.find(r => 
    String(r['Hisse Kodu (Sembol)'] || '').includes('QQQ')
  );
  if (qqqRow) {
    console.log(`\nQQQ (USD) Row: ${JSON.stringify(qqqRow)}`);
    console.log(`  Miktar raw: "${qqqRow['Miktar (Adet)']}" → parsed: ${parseCleanNumber(qqqRow['Miktar (Adet)'])}`);
    console.log(`  Fiyat raw: "${qqqRow['Birim Fiyat']}" → parsed: ${parseCleanNumber(qqqRow['Birim Fiyat'])}`);
    console.log(`  Kur raw: "${qqqRow['Döviz Kuru (USD/TRY)']}" → parsed: ${parseCleanNumber(qqqRow['Döviz Kuru (USD/TRY)'])}`);
  }

  // Row for "18.000," (large fund quantity)
  const bigFundRow = result.rows.find(r => 
    String(r['Miktar (Adet)'] || '').includes('18.000') || String(r['Miktar (Adet)'] || '').includes('18000')
  );
  if (bigFundRow) {
    console.log(`\nBig Fund Row (Miktar=18.000): ${JSON.stringify(bigFundRow)}`);
    console.log(`  Miktar raw: "${bigFundRow['Miktar (Adet)']}" → parsed: ${parseCleanNumber(bigFundRow['Miktar (Adet)'])}`);
    console.log(`  Fiyat raw: "${bigFundRow['Birim Fiyat']}" → parsed: ${parseCleanNumber(bigFundRow['Birim Fiyat'])}`);
    console.log(`  Toplam raw: "${bigFundRow['Toplam Tutar']}" → parsed: ${parseCleanNumber(bigFundRow['Toplam Tutar'])}`);
  }

  // Verify all rows parse correctly
  console.log('\n=== Full Validation ===');
  let errors = 0;
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    const miktar = parseCleanNumber(row['Miktar (Adet)']);
    const fiyat = parseCleanNumber(row['Birim Fiyat']);
    const toplam = parseCleanNumber(row['Toplam Tutar']);
    const sembol = String(row['Hisse Kodu (Sembol)'] || '').trim();
    const notlar = String(row['Notlar'] || '');
    const isBedelsiz = notlar.toLowerCase().includes('bedelsiz');
    
    if (miktar <= 0) {
      console.log(`  ❌ Row ${i+2}: ${sembol} - Miktar=0 (raw: "${row['Miktar (Adet)']}")`);
      errors++;
    }
    if (fiyat <= 0 && !isBedelsiz) {
      console.log(`  ❌ Row ${i+2}: ${sembol} - Fiyat=0 (raw: "${row['Birim Fiyat']}")`);
      errors++;
    }
    if (!sembol) {
      console.log(`  ❌ Row ${i+2}: Empty symbol`);
      errors++;
    }
    
    // Cross-check: quantity * price should approximately equal total
    if (fiyat > 0 && miktar > 0 && toplam > 0) {
      const calc = miktar * fiyat;
      const diff = Math.abs(calc - toplam) / toplam;
      if (diff > 0.02) { // >2% difference
        console.log(`  ⚠️ Row ${i+2}: ${sembol} - Calculated ${calc.toFixed(2)} ≠ Reported ${toplam.toFixed(2)} (${(diff*100).toFixed(1)}% diff)`);
        errors++;
      }
    }
  }
  
  if (errors === 0) {
    console.log(`  ✅ All ${result.rows.length} rows parsed correctly!`);
  } else {
    console.log(`  ❌ ${errors} issues found in ${result.rows.length} rows`);
  }
}
