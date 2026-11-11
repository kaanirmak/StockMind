import {
  validateReadOnlyBrokerScopes,
  type ReadOnlyScope,
} from '@/lib/portfolio/brokerConnectionPolicy';
import type { Transaction, TransactionFormData } from '@/types/portfolio';

export type PrototypeBrokerId = 'midas';

export interface BrokerStatementEntry {
  externalRef?: string;
  symbol: string;
  transactionType: 'buy' | 'sell' | 'dividend';
  assetType?: 'stock' | 'fund';
  exchange?: 'BIST' | 'NASDAQ' | 'NYSE' | 'TEFAS';
  currency: 'TRY' | 'USD';
  quantity: number;
  price: number;
  commission?: number;
  exchangeRate?: number;
  executedAt: string; // ISO timestamp or YYYY-MM-DD
  description?: string;
}

export interface ReadOnlyBrokerSyncInput {
  brokerId: PrototypeBrokerId;
  portfolioId: string;
  requestedScopes: readonly (ReadOnlyScope | string)[];
  entries: readonly BrokerStatementEntry[];
  existingTransactions: ReadonlyArray<
    Pick<Transaction, 'id' | 'portfolioId' | 'symbol' | 'transactionType' | 'quantity' | 'price' | 'transactionDate' | 'notes'>
  >;
  knownExternalRefs?: ReadonlyArray<string>;
}

export interface ReadOnlyBrokerSyncResult {
  status: 'synced' | 'rejected_scope';
  brokerId: PrototypeBrokerId;
  grantedScopes: string[];
  rejectedScopes: string[];
  error: string | null;
  importedTransactions: TransactionFormData[];
  newExternalRefs: string[];
  skippedDuplicateCount: number;
  duplicateReasons: Array<{
    index: number;
    symbol: string;
    reason: 'external_ref' | 'content_fingerprint';
    key: string;
  }>;
  skippedInvalidCount: number;
  syncedAt: string;
}

const SYNC_TAG_REGEX = /\[broker-sync:([a-z0-9_-]+):([^\]]+)\]/i;

export function buildBrokerSyncTag(brokerId: PrototypeBrokerId, externalRef: string): string {
  return `[broker-sync:${brokerId}:${externalRef.trim()}]`;
}

export function extractBrokerSyncRef(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = SYNC_TAG_REGEX.exec(notes);
  return match ? `${match[1].toLowerCase()}:${match[2].trim()}` : null;
}

export function buildBrokerTransactionFingerprint(input: {
  symbol: string;
  transactionType: string;
  quantity: number;
  price: number;
  transactionDate: string;
}): string {
  const sym = String(input.symbol || '').trim().toUpperCase();
  const type = String(input.transactionType || '').trim().toLowerCase();
  const qty = Number(input.quantity || 0).toFixed(6);
  const price = Number(input.price || 0).toFixed(6);
  const date = String(input.transactionDate || '').slice(0, 10);
  return `${sym}|${type}|${qty}|${price}|${date}`;
}

function inferExchangeFromEntry(entry: BrokerStatementEntry): 'BIST' | 'NASDAQ' | 'NYSE' | 'TEFAS' {
  if (entry.exchange) return entry.exchange;
  if (entry.assetType === 'fund') return 'TEFAS';
  return entry.currency === 'USD' ? 'NASDAQ' : 'BIST';
}

/**
 * Prototype read-only broker statement reconciler for the first supported schema (Midas).
 * Enforces read-only scopes (never trading/transfer permissions) and prevents duplicate transactions
 * across repeated or overlapping statement sync runs.
 */
export function syncReadOnlyBrokerStatement(input: ReadOnlyBrokerSyncInput): ReadOnlyBrokerSyncResult {
  const syncedAt = new Date().toISOString();
  const scopeCheck = validateReadOnlyBrokerScopes(input.requestedScopes);
  if (!scopeCheck.accepted) {
    return {
      status: 'rejected_scope',
      brokerId: input.brokerId,
      grantedScopes: [],
      rejectedScopes: scopeCheck.rejectedScopes,
      error: scopeCheck.reason,
      importedTransactions: [],
      newExternalRefs: [],
      skippedDuplicateCount: 0,
      duplicateReasons: [],
      skippedInvalidCount: 0,
      syncedAt,
    };
  }

  const seenExternalRefs = new Set<string>(
    (input.knownExternalRefs || []).map((ref) => `${input.brokerId}:${String(ref).trim()}`),
  );
  const seenLegacyFingerprints = new Set<string>();

  for (const tx of input.existingTransactions) {
    if (tx.portfolioId && tx.portfolioId !== input.portfolioId) continue;
    const embeddedRef = extractBrokerSyncRef(tx.notes);
    if (embeddedRef) {
      seenExternalRefs.add(embeddedRef);
    }
    seenLegacyFingerprints.add(
      buildBrokerTransactionFingerprint({
        symbol: tx.symbol,
        transactionType: tx.transactionType,
        quantity: tx.quantity,
        price: tx.price,
        transactionDate: tx.transactionDate,
      }),
    );
  }

  const importedTransactions: TransactionFormData[] = [];
  const newExternalRefs: string[] = [];
  const duplicateReasons: ReadOnlyBrokerSyncResult['duplicateReasons'] = [];
  let skippedInvalidCount = 0;

  input.entries.forEach((entry, index) => {
    const symbol = String(entry.symbol || '').trim().toUpperCase();
    const txDate = String(entry.executedAt || '').slice(0, 10);
    if (!symbol || !txDate || !Number.isFinite(entry.quantity) || entry.quantity <= 0 || !Number.isFinite(entry.price) || entry.price < 0) {
      skippedInvalidCount += 1;
      return;
    }

    const cleanRef = entry.externalRef?.trim() || '';
    const scopedRef = cleanRef ? `${input.brokerId}:${cleanRef}` : null;
    const fp = buildBrokerTransactionFingerprint({
      symbol,
      transactionType: entry.transactionType,
      quantity: entry.quantity,
      price: entry.price,
      transactionDate: txDate,
    });

    if (scopedRef && seenExternalRefs.has(scopedRef)) {
      duplicateReasons.push({
        index,
        symbol,
        reason: 'external_ref',
        key: scopedRef,
      });
      return;
    }

    if (!scopedRef && seenLegacyFingerprints.has(fp)) {
      duplicateReasons.push({
        index,
        symbol,
        reason: 'content_fingerprint',
        key: fp,
      });
      return;
    }

    if (scopedRef) {
      seenExternalRefs.add(scopedRef);
      newExternalRefs.push(cleanRef);
    } else {
      seenLegacyFingerprints.add(fp);
    }

    const tag = cleanRef ? buildBrokerSyncTag(input.brokerId, cleanRef) : `[broker-sync:${input.brokerId}]`;
    const combinedNotes = entry.description?.trim() ? `${entry.description.trim()} ${tag}` : `Midas salt-okunur eşitleme ${tag}`;

    importedTransactions.push({
      symbol,
      assetType: entry.assetType || 'stock',
      transactionType: entry.transactionType,
      quantity: entry.quantity,
      price: entry.price,
      currency: entry.currency,
      exchangeRate: entry.exchangeRate,
      commission: Number.isFinite(entry.commission) ? Number(entry.commission) : 0,
      transactionDate: txDate,
      exchange: inferExchangeFromEntry(entry),
      notes: combinedNotes,
    });
  });

  return {
    status: 'synced',
    brokerId: input.brokerId,
    grantedScopes: scopeCheck.allowedScopes,
    rejectedScopes: [],
    error: null,
    importedTransactions,
    newExternalRefs,
    skippedDuplicateCount: duplicateReasons.length,
    duplicateReasons,
    skippedInvalidCount,
    syncedAt,
  };
}

export function detachReadOnlyBrokerSync(params: {
  brokerId: PrototypeBrokerId;
  transactions: ReadonlyArray<Pick<Transaction, 'id' | 'notes'>>;
  mode: 'delete_imported' | 'keep_manual';
}): {
  remainingTransactionIds: string[];
  deletedTransactionIds: string[];
  purgedSyncRefCount: number;
  detachedAt: string;
} {
  const prefix = `${params.brokerId}:`;
  const remainingTransactionIds: string[] = [];
  const deletedTransactionIds: string[] = [];
  let purgedSyncRefCount = 0;

  for (const tx of params.transactions) {
    const syncRef = extractBrokerSyncRef(tx.notes);
    if (syncRef && syncRef.startsWith(prefix)) {
      purgedSyncRefCount += 1;
      if (params.mode === 'delete_imported') {
        deletedTransactionIds.push(tx.id);
      } else {
        remainingTransactionIds.push(tx.id);
      }
    } else {
      remainingTransactionIds.push(tx.id);
    }
  }

  return {
    remainingTransactionIds,
    deletedTransactionIds,
    purgedSyncRefCount,
    detachedAt: new Date().toISOString(),
  };
}
