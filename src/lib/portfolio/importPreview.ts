import type { Transaction, TransactionFormData } from '@/types/portfolio';
import type { ParsedRowResult } from '@/lib/portfolio/excelParser';

export type DuplicateSource = 'portfolio' | 'in_file';

export interface ImportRowErrorSummary {
  rowNumber: number;
  reasons: string[];
  reasonText: string;
}

export interface ImportPreviewSummary {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  netNewCount: number;
  duplicateIndices: Set<number>;
  duplicateReasons: Map<number, DuplicateSource>;
  errorSummaries: ImportRowErrorSummary[];
}

function makeTxFingerprint(
  tx: Pick<TransactionFormData, 'symbol' | 'transactionType' | 'quantity' | 'price' | 'transactionDate'>
): string {
  const sym = String(tx.symbol || '').trim().toUpperCase();
  const type = String(tx.transactionType || '').trim().toLowerCase();
  const qty = Number(tx.quantity || 0).toFixed(6);
  const price = Number(tx.price || 0).toFixed(6);
  const date = String(tx.transactionDate || '').slice(0, 10);
  return `${sym}|${type}|${qty}|${price}|${date}`;
}

/**
 * Summarizes valid, invalid, and duplicate row counts (including both existing portfolio
 * records and repeated rows within the same uploaded file) plus human-readable error reasons.
 */
export function summarizeImportPreview(input: {
  validRows: ReadonlyArray<ParsedRowResult>;
  invalidRows: ReadonlyArray<ParsedRowResult>;
  existingTransactions: ReadonlyArray<
    Pick<Transaction, 'symbol' | 'transactionType' | 'quantity' | 'price' | 'transactionDate'>
  >;
}): ImportPreviewSummary {
  const existingFingerprints = new Set(
    input.existingTransactions.map((tx) => makeTxFingerprint(tx))
  );
  const seenInFile = new Set<string>();
  const duplicateIndices = new Set<number>();
  const duplicateReasons = new Map<number, DuplicateSource>();

  input.validRows.forEach((row, idx) => {
    const fp = makeTxFingerprint(row.data);
    if (existingFingerprints.has(fp)) {
      duplicateIndices.add(idx);
      duplicateReasons.set(idx, 'portfolio');
      return;
    }
    if (seenInFile.has(fp)) {
      duplicateIndices.add(idx);
      duplicateReasons.set(idx, 'in_file');
      return;
    }
    seenInFile.add(fp);
  });

  const errorSummaries: ImportRowErrorSummary[] = input.invalidRows.map((row) => {
    const reasons = row.errors.length > 0 ? [...row.errors] : ['Bilinmeyen satır doğrulama hatası'];
    return {
      rowNumber: row.rowNumber,
      reasons,
      reasonText: `Satır ${row.rowNumber}: ${reasons.join(', ')}`,
    };
  });

  const validCount = input.validRows.length;
  const invalidCount = input.invalidRows.length;
  const duplicateCount = duplicateIndices.size;

  return {
    totalRows: validCount + invalidCount,
    validCount,
    invalidCount,
    duplicateCount,
    netNewCount: Math.max(0, validCount - duplicateCount),
    duplicateIndices,
    duplicateReasons,
    errorSummaries,
  };
}
