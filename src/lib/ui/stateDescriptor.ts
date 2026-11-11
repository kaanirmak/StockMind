export type UnifiedStateKind = 'loading' | 'empty' | 'error' | 'success';

export interface UnifiedStateMeta {
  role: 'alert' | 'status';
  ariaLive: 'assertive' | 'polite';
  ariaBusy: boolean;
  defaultStatusLabel: string;
}

export const STATE_STATUS_LABELS: Record<UnifiedStateKind, string> = {
  loading: 'Yükleniyor',
  empty: 'Veri Yok',
  error: 'Bağlantı / Veri Hatası',
  success: 'Hazır',
};

export function resolveUnifiedStateMeta(
  kind: UnifiedStateKind = 'empty',
  customLabel?: string
): {
  role: 'alert' | 'status';
  ariaLive: 'assertive' | 'polite';
  ariaBusy: boolean;
  statusLabel: string;
} {
  return {
    role: kind === 'error' ? 'alert' : 'status',
    ariaLive: kind === 'error' ? 'assertive' : 'polite',
    ariaBusy: kind === 'loading',
    statusLabel: (customLabel && customLabel.trim()) || STATE_STATUS_LABELS[kind],
  };
}
