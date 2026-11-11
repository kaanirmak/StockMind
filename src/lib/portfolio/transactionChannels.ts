export type TransactionChannel = 'record' | 'virtual_cash' | 'external_broker';

export type TransactionInitialMode = 'broker' | 'stock' | 'fund' | 'cash';

export interface TransactionChannelOption {
  id: TransactionChannel;
  label: string;
  shortLabel: string;
  description: string;
  external: boolean;
}

export const TRANSACTION_CHANNEL_OPTIONS: readonly TransactionChannelOption[] = [
  {
    id: 'record',
    label: 'İşlem Kaydet',
    shortLabel: 'İşlem Kaydı',
    description: 'Alış veya satış işlemini portföy defterine doğrudan ekler.',
    external: false,
  },
  {
    id: 'virtual_cash',
    label: 'Sanal Bakiye',
    shortLabel: 'Sanal Bakiye',
    description: 'Portföy içi sanal nakit bakiyesini yatır veya çek.',
    external: false,
  },
  {
    id: 'external_broker',
    label: 'Dış Aracı Kuruma Git',
    shortLabel: 'Dış Aracı Kurum',
    description: 'Gerçek emir vermek için harici kurum sitesini yeni sekmede açar.',
    external: true,
  },
] as const;

/**
 * Resolves the initial three-way transaction channel from a caller hint.
 */
export function getInitialTransactionChannel(
  initialMode?: TransactionInitialMode
): TransactionChannel {
  if (initialMode === 'broker') return 'external_broker';
  if (initialMode === 'cash') return 'virtual_cash';
  return 'record';
}

/**
 * Resolves a channel selection into legacy sub-state fields for modal compatibility.
 */
export function resolveChannelSubState(channel: TransactionChannel): {
  executionMode: 'broker' | 'virtual';
  assetSubTab: 'instrument' | 'cash';
  cashMode: boolean;
} {
  if (channel === 'external_broker') {
    return { executionMode: 'broker', assetSubTab: 'instrument', cashMode: false };
  }
  if (channel === 'virtual_cash') {
    return { executionMode: 'virtual', assetSubTab: 'cash', cashMode: true };
  }
  return { executionMode: 'virtual', assetSubTab: 'instrument', cashMode: false };
}
