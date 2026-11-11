import type { CatalogModel } from './modelCatalog';

export interface AiQuotaSnapshot {
  limit: number;
  remaining: number;
  used: number;
  resetInSeconds?: number;
  resetsAt?: string | null;
  isPro: boolean;
}

export interface AiUsageVisibilitySummary {
  keyMode: 'personal_key' | 'platform_key';
  keyModeLabel: string;
  modelName: string;
  modelId: string;
  modelFree: boolean;
  costTierLabel: string;
  costDescription: string;
  quotaLabel: string;
  resetTimeLabel: string;
}

export function formatQuotaResetWindow(
  resetInSeconds?: number,
  resetsAt?: string | null,
  now: Date = new Date()
): string {
  let targetMs: number | null = null;
  if (resetsAt) {
    const parsed = Date.parse(resetsAt);
    if (Number.isFinite(parsed) && parsed > now.getTime()) {
      targetMs = parsed;
    }
  }
  const seconds =
    typeof resetInSeconds === 'number' && Number.isFinite(resetInSeconds) && resetInSeconds > 0
      ? resetInSeconds
      : targetMs !== null
        ? Math.max(1, Math.ceil((targetMs - now.getTime()) / 1000))
        : 0;

  if (seconds <= 0) {
    return 'İlk sorudan 60 dk sonra yenilenir';
  }

  const resolvedTarget = new Date(targetMs ?? now.getTime() + seconds * 1000);
  const timeStr = resolvedTarget.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });
  const mins = Math.max(1, Math.ceil(seconds / 60));
  return `Yenilenme: ${timeStr} TSİ (~${mins} dk)`;
}

/**
 * Unifies model selection, remaining quota, reset timestamp, cost tier, and API key mode
 * into a single deterministic view so users always see what each request consumes.
 */
export function buildAiUsageVisibilitySummary(input: {
  selectedModel: CatalogModel;
  quota?: AiQuotaSnapshot | null;
  hasCustomKey: boolean;
  usePersonalKey?: boolean;
  isPro: boolean;
  now?: Date;
}): AiUsageVisibilitySummary {
  const usingPersonalKey = input.hasCustomKey && input.usePersonalKey !== false;
  const now = input.now ?? new Date();

  const costTierLabel = input.selectedModel.free
    ? 'Ücretsiz (Ek Maliyet Yok)'
    : usingPersonalKey
      ? 'Ücretli Model (Kişisel Kredi)'
      : 'Pro Plan Dahilinde';

  const costDescription = usingPersonalKey
    ? input.selectedModel.free
      ? 'Kişisel OpenRouter anahtarınızla ücretsiz model kullanılıyor; StockMind saatlik kotasından düşmez.'
      : 'Ücretli model seçili; maliyet kendi OpenRouter bakiyenizden düşer ve StockMind kotası uygulanmaz.'
    : input.isPro
      ? 'StockMind Pro platform kotasından düşer (20 soru/saat).'
      : 'StockMind standart platform kotasından düşer (5 soru/saat).';

  const quotaLabel = usingPersonalKey
    ? 'Sınırsız (Kişisel Anahtar)'
    : input.quota
      ? `${input.quota.remaining} / ${input.quota.limit} kalan`
      : `${input.isPro ? 20 : 5} / ${input.isPro ? 20 : 5} kalan`;

  const resetTimeLabel = usingPersonalKey
    ? 'Kişisel anahtarda saatlik StockMind sınırı yok'
    : input.quota && (input.quota.used > 0 || (input.quota.resetInSeconds ?? 0) > 0)
      ? formatQuotaResetWindow(input.quota.resetInSeconds, input.quota.resetsAt, now)
      : 'Kullanım başlamadı (60 dk pencere)';

  return {
    keyMode: usingPersonalKey ? 'personal_key' : 'platform_key',
    keyModeLabel: usingPersonalKey ? 'Kişisel OpenRouter Anahtarı' : 'Platform Anahtarı (StockMind)',
    modelName: input.selectedModel.name,
    modelId: input.selectedModel.id,
    modelFree: input.selectedModel.free,
    costTierLabel,
    costDescription,
    quotaLabel,
    resetTimeLabel,
  };
}
