import {
  buildAlertAssetRoute,
  evaluateAlertPriceFreshness,
  type AlertDeferralReason,
  type AlertPriceQuote,
} from './alertFreshness';
import {
  formatAlertPrice,
  inferAssetAlertCurrency,
  type AlertCurrencyCode,
} from './alertForm';

export interface ServerAlertRule {
  watchlistItemId?: string;
  userId: string;
  symbol: string;
  name: string;
  assetType: 'stock' | 'fund';
  exchange?: string | null;
  targetPrice?: number | null;
  alertType?: 'price' | 'percent_up' | 'percent_down' | 'percent_both' | null;
  alertPercent?: number | null;
  alertBasePrice?: number | null;
  alertCurrency?: AlertCurrencyCode | null;
  alertDirection?: 'up' | 'down' | 'both' | null;
  alertPaused?: boolean | null;
}

export interface RecordedAlertTriggerEvent {
  eventKey: string;
  userId: string;
  watchlistItemId?: string;
  symbol: string;
  assetType: 'stock' | 'fund';
  alertType: string;
  observedPrice: number;
  targetPrice?: number;
  basePrice?: number;
  alertPercent?: number;
  currency: AlertCurrencyCode;
  title: string;
  message: string;
  link: string;
  triggeredAt: string;
}

export interface ServerAlertEvaluationSummary {
  checkedCount: number;
  skippedPausedCount: number;
  deferredCount: number;
  triggeredCount: number;
  deduplicatedCount: number;
  events: RecordedAlertTriggerEvent[];
  deferred: Array<{ symbol: string; assetType: 'stock' | 'fund'; reason: AlertDeferralReason }>;
}

export interface ServerAlertEventStore {
  hasEventKey: (eventKey: string) => Promise<boolean>;
  insertEvent: (event: RecordedAlertTriggerEvent) => Promise<{ inserted: boolean; duplicate?: boolean }>;
  updateRuleEvaluation?: (params: {
    watchlistItemId?: string;
    checkedAt: string;
    observedPrice: number | null;
    triggeredAt?: string;
    triggeredPrice?: number;
    nextBasePrice?: number;
  }) => Promise<void>;
}

export function buildServerAlertEventKey(params: {
  userId: string;
  symbol: string;
  assetType: 'stock' | 'fund';
  alertType: string;
  breachDirection: 'up' | 'down';
  targetPrice?: number | null;
  alertPercent?: number | null;
  basePrice?: number | null;
}): string {
  const sym = params.symbol.trim().toUpperCase();
  const targetStr =
    typeof params.targetPrice === 'number' && Number.isFinite(params.targetPrice)
      ? params.targetPrice.toFixed(4)
      : 'none';
  const pctStr =
    typeof params.alertPercent === 'number' && Number.isFinite(params.alertPercent)
      ? params.alertPercent.toFixed(4)
      : 'none';
  const baseStr =
    typeof params.basePrice === 'number' && Number.isFinite(params.basePrice)
      ? params.basePrice.toFixed(4)
      : 'none';

  return [
    'v1',
    params.userId.trim(),
    params.assetType,
    sym,
    params.alertType,
    params.breachDirection,
    `t=${targetStr}`,
    `p=${pctStr}`,
    `b=${baseStr}`,
  ].join('|');
}

export function evaluateSingleServerAlert(
  rule: ServerAlertRule,
  quote: AlertPriceQuote | null | undefined,
  now = new Date(),
):
  | { status: 'paused' }
  | { status: 'deferred'; reason: Exclude<AlertDeferralReason, 'ok'>; description: string }
  | { status: 'ok'; triggered: false; observedPrice: number }
  | { status: 'triggered'; triggered: true; event: RecordedAlertTriggerEvent; breachDirection: 'up' | 'down' } {
  if (rule.alertPaused) {
    return { status: 'paused' };
  }

  const freshness = evaluateAlertPriceFreshness(
    quote ? { ...quote, assetType: quote.assetType ?? rule.assetType } : null,
    now,
  );
  if (!freshness.eligible) {
    return {
      status: 'deferred',
      reason: freshness.reason as Exclude<AlertDeferralReason, 'ok'>,
      description: freshness.description,
    };
  }

  const livePrice = quote!.price!;
  const sym = rule.symbol.trim().toUpperCase();
  const name = (rule.name || sym).trim();
  const alertType = rule.alertType || 'price';
  const targetPrice = typeof rule.targetPrice === 'number' && rule.targetPrice > 0 ? rule.targetPrice : undefined;
  const alertPercent = typeof rule.alertPercent === 'number' && rule.alertPercent > 0 ? rule.alertPercent : undefined;
  const basePrice =
    typeof rule.alertBasePrice === 'number' && rule.alertBasePrice > 0
      ? rule.alertBasePrice
      : livePrice;

  const currency: AlertCurrencyCode =
    rule.alertCurrency ||
    inferAssetAlertCurrency({
      exchange: rule.exchange || quote?.exchange,
      assetType: rule.assetType,
      symbol: sym,
    });
  const liveFormatted = formatAlertPrice(livePrice, currency, rule.assetType);
  const baseFormatted = formatAlertPrice(basePrice, currency, rule.assetType);
  const link = buildAlertAssetRoute(rule.assetType, sym);
  const triggeredAt = now.toISOString();

  let triggeredTitle: string | null = null;
  let triggeredMessage: string | null = null;
  let breachDirection: 'up' | 'down' = 'up';

  if (alertType === 'percent_up' && alertPercent && rule.alertBasePrice && rule.alertBasePrice > 0) {
    const threshold = rule.alertBasePrice * (1 + alertPercent / 100);
    if (livePrice >= threshold) {
      breachDirection = 'up';
      triggeredTitle = `📈 %${alertPercent} Yükseliş Alarmı: ${sym}`;
      triggeredMessage = `${name} %${alertPercent} artış hedefine ulaştı (${liveFormatted} / Baz: ${baseFormatted})`;
    }
  } else if (alertType === 'percent_down' && alertPercent && rule.alertBasePrice && rule.alertBasePrice > 0) {
    const threshold = rule.alertBasePrice * (1 - alertPercent / 100);
    if (livePrice <= threshold) {
      breachDirection = 'down';
      triggeredTitle = `📉 %${alertPercent} Düşüş Alarmı: ${sym}`;
      triggeredMessage = `${name} %${alertPercent} düşüş eşiğine geriledi (${liveFormatted} / Baz: ${baseFormatted})`;
    }
  } else if (alertType === 'percent_both' && alertPercent && rule.alertBasePrice && rule.alertBasePrice > 0) {
    const upper = rule.alertBasePrice * (1 + alertPercent / 100);
    const lower = rule.alertBasePrice * (1 - alertPercent / 100);
    if (livePrice >= upper) {
      breachDirection = 'up';
      triggeredTitle = `📈 %${alertPercent} Yükseliş Sapması: ${sym}`;
      triggeredMessage = `${name} baz fiyattan %${alertPercent} yükselerek ${liveFormatted} oldu!`;
    } else if (livePrice <= lower) {
      breachDirection = 'down';
      triggeredTitle = `📉 %${alertPercent} Düşüş Sapması: ${sym}`;
      triggeredMessage = `${name} baz fiyattan %${alertPercent} gerileyerek ${liveFormatted} oldu!`;
    }
  } else if (targetPrice) {
    const fixedUp = rule.alertDirection ? rule.alertDirection === 'up' : targetPrice >= basePrice;
    const targetFormatted = formatAlertPrice(targetPrice, currency, rule.assetType);
    if (fixedUp && livePrice >= targetPrice) {
      breachDirection = 'up';
      triggeredTitle = `🎯 Hedef Fiyat Ulaştı: ${sym}`;
      triggeredMessage = `${name} belirlediğiniz ${targetFormatted} hedefine ulaştı! (Güncel: ${liveFormatted})`;
    } else if (!fixedUp && livePrice <= targetPrice) {
      breachDirection = 'down';
      triggeredTitle = `🎯 Alt Fiyat Eşiği: ${sym}`;
      triggeredMessage = `${name} belirlediğiniz ${targetFormatted} alt seviyesine geriledi! (Güncel: ${liveFormatted})`;
    }
  }

  if (!triggeredTitle || !triggeredMessage) {
    return { status: 'ok', triggered: false, observedPrice: livePrice };
  }

  const eventKey = buildServerAlertEventKey({
    userId: rule.userId,
    symbol: sym,
    assetType: rule.assetType,
    alertType,
    breachDirection,
    targetPrice: targetPrice ?? null,
    alertPercent: alertPercent ?? null,
    basePrice: rule.alertBasePrice ?? null,
  });

  return {
    status: 'triggered',
    triggered: true,
    breachDirection,
    event: {
      eventKey,
      userId: rule.userId,
      ...(rule.watchlistItemId ? { watchlistItemId: rule.watchlistItemId } : {}),
      symbol: sym,
      assetType: rule.assetType,
      alertType,
      observedPrice: livePrice,
      ...(targetPrice ? { targetPrice } : {}),
      ...(rule.alertBasePrice ? { basePrice: rule.alertBasePrice } : {}),
      ...(alertPercent ? { alertPercent } : {}),
      currency,
      title: triggeredTitle,
      message: triggeredMessage,
      link,
      triggeredAt,
    },
  };
}

export async function evaluateServerPriceAlerts(params: {
  rules: readonly ServerAlertRule[];
  quotes: ReadonlyMap<string, AlertPriceQuote>;
  store: ServerAlertEventStore;
  now?: Date;
}): Promise<ServerAlertEvaluationSummary> {
  const now = params.now ?? new Date();
  const checkedAtIso = now.toISOString();
  const summary: ServerAlertEvaluationSummary = {
    checkedCount: 0,
    skippedPausedCount: 0,
    deferredCount: 0,
    triggeredCount: 0,
    deduplicatedCount: 0,
    events: [],
    deferred: [],
  };

  for (const rule of params.rules) {
    const sym = rule.symbol.trim().toUpperCase();
    const quote = params.quotes.get(`${rule.assetType}:${sym}`);
    const outcome = evaluateSingleServerAlert(rule, quote, now);

    if (outcome.status === 'paused') {
      summary.skippedPausedCount += 1;
      continue;
    }

    summary.checkedCount += 1;

    if (outcome.status === 'deferred') {
      summary.deferredCount += 1;
      summary.deferred.push({ symbol: sym, assetType: rule.assetType, reason: outcome.reason });
      await params.store.updateRuleEvaluation?.({
        watchlistItemId: rule.watchlistItemId,
        checkedAt: checkedAtIso,
        observedPrice: typeof quote?.price === 'number' ? quote.price : null,
      });
      continue;
    }

    if (!outcome.triggered) {
      await params.store.updateRuleEvaluation?.({
        watchlistItemId: rule.watchlistItemId,
        checkedAt: checkedAtIso,
        observedPrice: outcome.observedPrice,
      });
      continue;
    }

    const alreadyRecorded = await params.store.hasEventKey(outcome.event.eventKey);
    if (alreadyRecorded) {
      summary.deduplicatedCount += 1;
      await params.store.updateRuleEvaluation?.({
        watchlistItemId: rule.watchlistItemId,
        checkedAt: checkedAtIso,
        observedPrice: outcome.event.observedPrice,
      });
      continue;
    }

    const insertRes = await params.store.insertEvent(outcome.event);
    if (insertRes.duplicate || !insertRes.inserted) {
      summary.deduplicatedCount += 1;
      continue;
    }

    summary.triggeredCount += 1;
    summary.events.push(outcome.event);

    const isPercentRule = rule.alertType && rule.alertType !== 'price';
    await params.store.updateRuleEvaluation?.({
      watchlistItemId: rule.watchlistItemId,
      checkedAt: checkedAtIso,
      observedPrice: outcome.event.observedPrice,
      triggeredAt: outcome.event.triggeredAt,
      triggeredPrice: outcome.event.observedPrice,
      ...(isPercentRule ? { nextBasePrice: outcome.event.observedPrice } : {}),
    });
  }

  return summary;
}
