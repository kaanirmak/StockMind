import {
  formatAlertPrice,
  inferAssetAlertCurrency,
  type AlertCurrencyCode,
} from './alertForm';

export type AlertRuleStatusFilter = 'all' | 'active' | 'paused';

export interface AlertRuleLike {
  id: string;
  symbol: string;
  name: string;
  assetType: 'stock' | 'fund';
  price: number;
  changePercent?: number;
  exchange?: string;
  targetPrice?: number;
  alertType?: 'price' | 'percent_up' | 'percent_down' | 'percent_both';
  alertPercent?: number;
  alertBasePrice?: number;
  alertCurrency?: AlertCurrencyCode;
  alertDirection?: 'up' | 'down' | 'both';
  alertPaused?: boolean;
}

export interface AlertRuleDescription {
  modeLabel: string;
  directionLabel: string;
  currency: AlertCurrencyCode;
  conditionText: string;
}

export function hasConfiguredAlert(
  item: Pick<AlertRuleLike, 'targetPrice' | 'alertPercent'>,
): boolean {
  return Boolean(
    (typeof item.targetPrice === 'number' && Number.isFinite(item.targetPrice) && item.targetPrice > 0) ||
      (typeof item.alertPercent === 'number' && Number.isFinite(item.alertPercent) && item.alertPercent > 0),
  );
}

export function isAlertPaused(item: Pick<AlertRuleLike, 'alertPaused'>): boolean {
  return Boolean(item.alertPaused);
}

export function partitionAlertRules<T extends AlertRuleLike>(
  items: readonly T[],
  filter: AlertRuleStatusFilter = 'all',
  query = '',
): {
  allRules: T[];
  activeRules: T[];
  pausedRules: T[];
  filteredRules: T[];
} {
  const allRules = items.filter((item) => hasConfiguredAlert(item));
  const activeRules = allRules.filter((item) => !isAlertPaused(item));
  const pausedRules = allRules.filter((item) => isAlertPaused(item));

  const q = query.trim().toLocaleLowerCase('tr-TR');
  const statusScoped =
    filter === 'active'
      ? activeRules
      : filter === 'paused'
        ? pausedRules
        : allRules;

  const filteredRules = q
    ? statusScoped.filter(
        (item) =>
          item.symbol.toLocaleLowerCase('tr-TR').includes(q) ||
          (item.name || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (item.exchange || '').toLocaleLowerCase('tr-TR').includes(q),
      )
    : statusScoped;

  return {
    allRules,
    activeRules,
    pausedRules,
    filteredRules,
  };
}

export function describeAlertRule(item: AlertRuleLike): AlertRuleDescription {
  const currency =
    item.alertCurrency ||
    inferAssetAlertCurrency({
      exchange: item.exchange,
      assetType: item.assetType,
      symbol: item.symbol,
    });
  const basePrice = item.alertBasePrice || item.price || 0;

  if (item.alertType === 'percent_up' && item.alertPercent) {
    const target = item.targetPrice || (basePrice > 0 ? basePrice * (1 + item.alertPercent / 100) : 0);
    return {
      modeLabel: 'Yüzde Eşiği',
      directionLabel: 'Yükseliş (+)',
      currency,
      conditionText:
        target > 0 && basePrice > 0
          ? `+%${item.alertPercent} (${formatAlertPrice(basePrice, currency, item.assetType)} → ${formatAlertPrice(target, currency, item.assetType)})`
          : `+%${item.alertPercent} yükseliş`,
    };
  }

  if (item.alertType === 'percent_down' && item.alertPercent) {
    const target = item.targetPrice || (basePrice > 0 ? basePrice * (1 - item.alertPercent / 100) : 0);
    return {
      modeLabel: 'Yüzde Eşiği',
      directionLabel: 'Düşüş (-)',
      currency,
      conditionText:
        target > 0 && basePrice > 0
          ? `-%${item.alertPercent} (${formatAlertPrice(basePrice, currency, item.assetType)} → ${formatAlertPrice(target, currency, item.assetType)})`
          : `-%${item.alertPercent} düşüş`,
    };
  }

  if (item.alertType === 'percent_both' && item.alertPercent) {
    return {
      modeLabel: 'Yüzde Eşiği',
      directionLabel: 'Çift Yön (±)',
      currency,
      conditionText:
        basePrice > 0
          ? `±%${item.alertPercent} sapma (Baz: ${formatAlertPrice(basePrice, currency, item.assetType)})`
          : `±%${item.alertPercent} çift yönlü sapma`,
    };
  }

  const target = item.targetPrice || 0;
  const fixedUp = item.alertDirection ? item.alertDirection === 'up' : target >= basePrice;
  return {
    modeLabel: 'Sabit Fiyat',
    directionLabel: fixedUp ? 'Yukarı (≥)' : 'Aşağı (≤)',
    currency,
    conditionText:
      target > 0
        ? `Hedef ${formatAlertPrice(target, currency, item.assetType)} (${fixedUp ? 'veya üzeri' : 'veya altı'})`
        : 'Fiyat eşiği',
  };
}
