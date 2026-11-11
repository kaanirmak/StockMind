import type { MarketPriceObservation } from '@/types/stock';

export type PriceStatusKind = 'current' | 'delayed' | 'last-close' | 'stale' | 'missing';

export interface PriceStatusInfo {
  status: PriceStatusKind;
  label: 'Güncel' | 'Gecikmeli' | 'Son kapanış' | 'Eski' | 'Eksik';
  badgeVariant: 'success' | 'accent' | 'info' | 'warning' | 'default';
  source: string | null;
  asOf: string | null;
  fetchedAt: string | null;
  observedAt: string | null;
  description: string;
}

export interface PriceStatusInput {
  price?: number | null;
  observation?: MarketPriceObservation | null;
  exchange?: string | null;
  symbol?: string | null;
  isLastKnown?: boolean;
  now?: Date;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const NINETY_SIX_HOURS_MS = 96 * 60 * 60 * 1000;

function getZonedClockParts(date: Date, timeZone: string): { weekday: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { weekday, minutes: hour * 60 + minute };
}

function getIstanbulDayString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isMarketSessionOpen(exchange?: string | null, now: Date = new Date()): boolean {
  const ex = (exchange || 'BIST').toUpperCase();
  if (ex === 'CRYPTO') return true;

  if (ex === 'NASDAQ' || ex === 'NYSE' || ex === 'US') {
    const { weekday, minutes } = getZonedClockParts(now, 'America/New_York');
    if (weekday === 'Sat' || weekday === 'Sun') return false;
    return minutes >= 9 * 60 + 30 && minutes <= 16 * 60;
  }

  if (ex === 'FOREX' || ex === 'COMMODITY' || ex === 'INDEX') {
    const { weekday } = getZonedClockParts(now, 'UTC');
    return weekday !== 'Sat' && weekday !== 'Sun';
  }

  // BIST equity default
  const { weekday, minutes } = getZonedClockParts(now, 'Europe/Istanbul');
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return minutes >= 10 * 60 && minutes <= 18 * 60 + 10;
}

export function classifyPriceStatus(input: PriceStatusInput): PriceStatusInfo {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const obs = input.observation ?? null;
  const validPrice = typeof input.price === 'number' && Number.isFinite(input.price) && input.price > 0;

  if (!validPrice || !obs) {
    return {
      status: 'missing',
      label: 'Eksik',
      badgeVariant: 'default',
      source: obs?.source ?? null,
      asOf: obs?.asOf ?? null,
      fetchedAt: obs?.fetchedAt ?? null,
      observedAt: obs?.asOf ?? obs?.fetchedAt ?? null,
      description: 'Sağlayıcıdan geçerli fiyat alınamadı.',
    };
  }

  const source = obs.source || null;
  const asOf = obs.asOf ?? null;
  const fetchedAt = obs.fetchedAt ?? null;
  const observedAt = asOf ?? fetchedAt;

  if (input.isLastKnown) {
    return {
      status: 'stale',
      label: 'Eski',
      badgeVariant: 'warning',
      source,
      asOf,
      fetchedAt,
      observedAt,
      description: 'Anlık güncelleme alınamadı; son doğrulanan fiyat gösteriliyor.',
    };
  }

  const ex = (input.exchange || '').toUpperCase();
  const isTefas = ex === 'TEFAS' || source?.toUpperCase() === 'TEFAS';
  const fetchedMs = fetchedAt ? Date.parse(fetchedAt) : NaN;
  const asOfMs = asOf ? Date.parse(asOf) : NaN;

  if (isTefas) {
    const navDayMatch = asOf?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
    if (!navDayMatch) {
      if (!Number.isFinite(fetchedMs) || Math.max(0, nowMs - fetchedMs) > TWENTY_FOUR_HOURS_MS) {
        return {
          status: 'stale',
          label: 'Eski',
          badgeVariant: 'warning',
          source,
          asOf,
          fetchedAt,
          observedAt,
          description: 'TEFAS değerleme tarihi doğrulanamadı veya veri güncel değil.',
        };
      }
      return {
        status: 'last-close',
        label: 'Son kapanış',
        badgeVariant: 'info',
        source,
        asOf,
        fetchedAt,
        observedAt,
        description: 'TEFAS gün sonu takas fiyatı gösteriliyor.',
      };
    }

    const todayTr = getIstanbulDayString(now);
    const diffDays = Math.round(
      (Date.parse(`${todayTr}T00:00:00Z`) - Date.parse(`${navDayMatch}T00:00:00Z`)) / TWENTY_FOUR_HOURS_MS
    );

    if (diffDays <= 0) {
      return {
        status: 'current',
        label: 'Güncel',
        badgeVariant: 'success',
        source,
        asOf,
        fetchedAt,
        observedAt,
        description: 'Bugünkü TEFAS resmi değerleme fiyatı.',
      };
    }
    if (diffDays <= 4) {
      return {
        status: 'last-close',
        label: 'Son kapanış',
        badgeVariant: 'info',
        source,
        asOf,
        fetchedAt,
        observedAt,
        description: 'Son iş günü TEFAS gün sonu takas fiyatı.',
      };
    }
    return {
      status: 'stale',
      label: 'Eski',
      badgeVariant: 'warning',
      source,
      asOf,
      fetchedAt,
      observedAt,
      description: 'TEFAS değerleme tarihi 4 günden daha eski.',
    };
  }

  const refMs = Number.isFinite(asOfMs) ? asOfMs : fetchedMs;
  if (!Number.isFinite(refMs)) {
    return {
      status: 'stale',
      label: 'Eski',
      badgeVariant: 'warning',
      source,
      asOf,
      fetchedAt,
      observedAt,
      description: 'Fiyat gözlem zamanı doğrulanamadı.',
    };
  }

  const ageMs = Math.max(0, nowMs - refMs);
  const fetchAgeMs = Number.isFinite(fetchedMs) ? Math.max(0, nowMs - fetchedMs) : ageMs;
  const sessionOpen = isMarketSessionOpen(ex || 'BIST', now);

  if (!sessionOpen) {
    if (ageMs <= NINETY_SIX_HOURS_MS && fetchAgeMs <= TWENTY_FOUR_HOURS_MS) {
      return {
        status: 'last-close',
        label: 'Son kapanış',
        badgeVariant: 'info',
        source,
        asOf,
        fetchedAt,
        observedAt,
        description: 'Piyasa kapalı; son kapanış fiyatı gösteriliyor.',
      };
    }
    return {
      status: 'stale',
      label: 'Eski',
      badgeVariant: 'warning',
      source,
      asOf,
      fetchedAt,
      observedAt,
      description: 'Son gözlenen fiyat güncel seans penceresinden eski.',
    };
  }

  if (ageMs > SIX_HOURS_MS || fetchAgeMs > SIX_HOURS_MS) {
    return {
      status: 'stale',
      label: 'Eski',
      badgeVariant: 'warning',
      source,
      asOf,
      fetchedAt,
      observedAt,
      description: 'Seans açık olmasına rağmen fiyat verisi eski.',
    };
  }

  if (ageMs > FIVE_MINUTES_MS || fetchAgeMs > FIVE_MINUTES_MS) {
    return {
      status: 'delayed',
      label: 'Gecikmeli',
      badgeVariant: 'accent',
      source,
      asOf,
      fetchedAt,
      observedAt,
      description: 'Sağlayıcıdan gecikmeli piyasa verisi.',
    };
  }

  return {
    status: 'current',
    label: 'Güncel',
    badgeVariant: 'success',
    source,
    asOf,
    fetchedAt,
    observedAt,
    description: 'Sağlayıcıdan taze doğrulanmış fiyat.',
  };
}

export function classifyStockPriceStatus(
  stock: {
    price?: number | null;
    observation?: MarketPriceObservation | null;
    exchange?: string | null;
    isLastKnown?: boolean;
  } | null | undefined,
  now?: Date
): PriceStatusInfo {
  const hasObservedPrice =
    Boolean(stock) &&
    typeof stock?.price === 'number' &&
    Number.isFinite(stock.price) &&
    stock.price > 0 &&
    Boolean(stock.observation);

  return classifyPriceStatus({
    price: hasObservedPrice ? stock!.price : null,
    observation: stock?.observation ?? null,
    exchange: stock?.exchange ?? null,
    isLastKnown: Boolean(stock?.isLastKnown),
    now,
  });
}

export function classifyFundPriceStatus(
  fund: {
    price?: number | null;
    observation?: MarketPriceObservation | null;
    navDate?: string | null;
    lastSyncAt?: string | null;
    dailyReturn?: number | null;
  } | null | undefined,
  now?: Date
): PriceStatusInfo {
  const observation =
    fund?.observation ??
    (fund && typeof fund.price === 'number' && fund.price > 0 && fund.lastSyncAt
      ? {
          source: 'TEFAS',
          asOf: fund.navDate ?? null,
          fetchedAt: fund.lastSyncAt,
          changePercent: typeof fund.dailyReturn === 'number' ? fund.dailyReturn : null,
        }
      : null);

  return classifyPriceStatus({
    price: fund?.price ?? null,
    observation,
    exchange: 'TEFAS',
    now,
  });
}
