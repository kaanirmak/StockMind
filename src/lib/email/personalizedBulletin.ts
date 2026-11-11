import { matchNewsAssetIdentity } from '@/lib/news/symbolMatch';

export interface PersonalizedBulletinPrefs {
  enabled: boolean;
  includePortfolioEvents: boolean;
  includeTotalValue: boolean;
  includeDailyChange: boolean;
}

export const DEFAULT_PERSONALIZED_BULLETIN_PREFS: PersonalizedBulletinPrefs = {
  enabled: false,
  includePortfolioEvents: true,
  includeTotalValue: false,
  includeDailyChange: true,
};

export interface BulletinPortfolioAsset {
  symbol: string;
  name?: string | null;
  exchange?: string | null;
}

export interface BulletinCandidateEvent {
  title: string;
  summary?: string;
  source: string;
  publishedAt?: string;
}

export interface PersonalizedBulletinEventItem {
  symbol: string;
  title: string;
  source: string;
  publishedAt?: string;
  matchReason: string;
}

export interface PersonalizedBulletinSection {
  enabled: boolean;
  allowedSummary: {
    holdingsCount?: number;
    totalValue?: number;
    dailyChangePct?: number;
  };
  allowedFieldLabels: string[];
  events: PersonalizedBulletinEventItem[];
  omittedEventCount: number;
}

export function resolvePersonalizedBulletinPrefs(
  userMetadata: Record<string, unknown> | null | undefined,
): PersonalizedBulletinPrefs {
  const meta = userMetadata ?? {};
  const enabled = meta.daily_report_personalized === true;
  const rawFields =
    meta.daily_report_portfolio_fields &&
    typeof meta.daily_report_portfolio_fields === 'object' &&
    !Array.isArray(meta.daily_report_portfolio_fields)
      ? (meta.daily_report_portfolio_fields as Record<string, unknown>)
      : {};

  return {
    enabled,
    includePortfolioEvents:
      typeof rawFields.events === 'boolean'
        ? rawFields.events
        : DEFAULT_PERSONALIZED_BULLETIN_PREFS.includePortfolioEvents,
    includeTotalValue:
      typeof rawFields.totalValue === 'boolean'
        ? rawFields.totalValue
        : DEFAULT_PERSONALIZED_BULLETIN_PREFS.includeTotalValue,
    includeDailyChange:
      typeof rawFields.dailyChange === 'boolean'
        ? rawFields.dailyChange
        : DEFAULT_PERSONALIZED_BULLETIN_PREFS.includeDailyChange,
  };
}

export function buildPersonalizedBulletinSection(input: {
  prefs: PersonalizedBulletinPrefs;
  assets: readonly BulletinPortfolioAsset[];
  events: readonly BulletinCandidateEvent[];
  valuation?: {
    totalValue?: number | null;
    dailyChangePct?: number | null;
    isVerified?: boolean;
  } | null;
}): PersonalizedBulletinSection | null {
  if (!input.prefs.enabled) {
    return null;
  }

  const allowedFieldLabels: string[] = [];
  const allowedSummary: PersonalizedBulletinSection['allowedSummary'] = {};

  if (input.assets.length > 0) {
    allowedSummary.holdingsCount = input.assets.length;
  }

  if (
    input.prefs.includeTotalValue &&
    input.valuation?.isVerified !== false &&
    typeof input.valuation?.totalValue === 'number' &&
    Number.isFinite(input.valuation.totalValue) &&
    input.valuation.totalValue > 0
  ) {
    allowedSummary.totalValue = Number(input.valuation.totalValue.toFixed(2));
    allowedFieldLabels.push('Toplam Portföy Değeri');
  }

  if (
    input.prefs.includeDailyChange &&
    input.valuation?.isVerified !== false &&
    typeof input.valuation?.dailyChangePct === 'number' &&
    Number.isFinite(input.valuation.dailyChangePct)
  ) {
    allowedSummary.dailyChangePct = Number(input.valuation.dailyChangePct.toFixed(2));
    allowedFieldLabels.push('Günlük Değişim (%)');
  }

  const matchedEvents: PersonalizedBulletinEventItem[] = [];
  let omittedEventCount = 0;

  if (input.prefs.includePortfolioEvents) {
    allowedFieldLabels.push('Portföyle İlişkili Olaylar');
    for (const ev of input.events) {
      const text = `${ev.title} ${ev.summary || ''}`;
      let matchedAsset: BulletinPortfolioAsset | null = null;
      let matchReason = '';

      for (const asset of input.assets) {
        const res = matchNewsAssetIdentity(text, asset, { source: ev.source });
        if (res.matched) {
          matchedAsset = asset;
          matchReason = res.matchedTerm
            ? `${asset.symbol} (${res.matchedTerm})`
            : asset.symbol;
          break;
        }
      }

      if (!matchedAsset) {
        omittedEventCount += 1;
        continue;
      }

      if (matchedEvents.length < 5) {
        matchedEvents.push({
          symbol: matchedAsset.symbol,
          title: ev.title,
          source: ev.source,
          publishedAt: ev.publishedAt,
          matchReason,
        });
      }
    }
  } else {
    omittedEventCount = input.events.length;
  }

  return {
    enabled: true,
    allowedSummary,
    allowedFieldLabels,
    events: matchedEvents,
    omittedEventCount,
  };
}

