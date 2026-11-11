export type MarketSessionState = 'open' | 'closed' | 'holiday';

export interface MarketSessionInfo {
  state: MarketSessionState;
  isOpen: boolean;
  label: string;
  reason: string;
  holidayName: string | null;
  lastCloseText: string | null;
  dataSessionState: MarketSessionState | null;
  timeZone: string;
}

const BIST_EXACT_HOLIDAYS: Record<string, string> = {
  // 2025 BIST Official Holidays
  '2025-01-01': 'Yılbaşı',
  '2025-03-31': 'Ramazan Bayramı',
  '2025-04-01': 'Ramazan Bayramı',
  '2025-04-02': 'Ramazan Bayramı',
  '2025-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2025-05-01': 'Emek ve Dayanışma Günü',
  '2025-05-19': "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
  '2025-06-06': 'Kurban Bayramı',
  '2025-06-07': 'Kurban Bayramı',
  '2025-06-08': 'Kurban Bayramı',
  '2025-06-09': 'Kurban Bayramı',
  '2025-07-15': 'Demokrasi ve Millî Birlik Günü',
  '2025-08-30': 'Zafer Bayramı',
  '2025-10-29': 'Cumhuriyet Bayramı',
  // 2026 BIST Official Holidays
  '2026-01-01': 'Yılbaşı',
  '2026-03-20': 'Ramazan Bayramı',
  '2026-03-21': 'Ramazan Bayramı',
  '2026-03-22': 'Ramazan Bayramı',
  '2026-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2026-05-01': 'Emek ve Dayanışma Günü',
  '2026-05-19': "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
  '2026-05-27': 'Kurban Bayramı',
  '2026-05-28': 'Kurban Bayramı',
  '2026-05-29': 'Kurban Bayramı',
  '2026-05-30': 'Kurban Bayramı',
  '2026-07-15': 'Demokrasi ve Millî Birlik Günü',
  '2026-08-30': 'Zafer Bayramı',
  '2026-10-29': 'Cumhuriyet Bayramı',
};

const BIST_RECURRING_FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': 'Yılbaşı',
  '04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '05-01': 'Emek ve Dayanışma Günü',
  '05-19': "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
  '07-15': 'Demokrasi ve Millî Birlik Günü',
  '08-30': 'Zafer Bayramı',
  '10-29': 'Cumhuriyet Bayramı',
};

const US_EXACT_HOLIDAYS: Record<string, string> = {
  // 2025 NYSE/NASDAQ Holidays
  '2025-01-01': "New Year's Day",
  '2025-01-09': 'National Day of Mourning',
  '2025-01-20': 'Martin Luther King Jr. Day',
  '2025-02-17': "Presidents' Day",
  '2025-04-18': 'Good Friday',
  '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth National Independence Day',
  '2025-07-04': 'Independence Day',
  '2025-09-01': 'Labor Day',
  '2025-11-27': 'Thanksgiving Day',
  '2025-12-25': 'Christmas Day',
  // 2026 NYSE/NASDAQ Holidays
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Presidents' Day",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth National Independence Day',
  '2026-07-03': 'Independence Day (Observed)',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving Day',
  '2026-12-25': 'Christmas Day',
};

function resolveExchangeTimeZone(exchange?: string | null): string {
  const ex = (exchange || 'BIST').toUpperCase();
  if (ex === 'NASDAQ' || ex === 'NYSE' || ex === 'US' || ex === 'AMEX') {
    return 'America/New_York';
  }
  if (ex === 'CRYPTO') return 'UTC';
  if (ex === 'FOREX' || ex === 'COMMODITY' || ex === 'INDEX') return 'Europe/Istanbul';
  return 'Europe/Istanbul';
}

export function getZonedSessionClock(
  date: Date,
  timeZone: string,
): { dateKey: string; weekday: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  return {
    dateKey: `${year}-${month}-${day}`,
    weekday,
    minutes: hour * 60 + minute,
  };
}

export function getMarketHolidayName(
  exchange: string | null | undefined,
  dateKey: string,
  customHolidays?: Record<string, string>,
): string | null {
  if (customHolidays && customHolidays[dateKey]) {
    return customHolidays[dateKey];
  }
  const ex = (exchange || 'BIST').toUpperCase();
  if (ex === 'CRYPTO') return null;

  if (ex === 'NASDAQ' || ex === 'NYSE' || ex === 'US' || ex === 'AMEX') {
    return US_EXACT_HOLIDAYS[dateKey] ?? null;
  }

  if (BIST_EXACT_HOLIDAYS[dateKey]) {
    return BIST_EXACT_HOLIDAYS[dateKey];
  }
  const mmdd = dateKey.slice(5);
  return BIST_RECURRING_FIXED_HOLIDAYS[mmdd] ?? null;
}

function formatCloseTimestamp(iso: string | null | undefined, timeZone: string): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

function classifySingleInstant(
  exchange: string | null | undefined,
  date: Date,
  customHolidays?: Record<string, string>,
): { state: MarketSessionState; holidayName: string | null; reason: string; timeZone: string } {
  const ex = (exchange || 'BIST').toUpperCase();
  const timeZone = resolveExchangeTimeZone(ex);

  if (ex === 'CRYPTO') {
    return {
      state: 'open',
      holidayName: null,
      reason: 'Kripto piyasası 7/24 kesintisiz açık.',
      timeZone,
    };
  }

  const clock = getZonedSessionClock(date, timeZone);
  const holidayName = getMarketHolidayName(ex, clock.dateKey, customHolidays);
  if (holidayName) {
    return {
      state: 'holiday',
      holidayName,
      reason: `${ex === 'NASDAQ' || ex === 'NYSE' || ex === 'US' ? 'ABD piyasaları' : 'Piyasa'} tatil nedeniyle kapalı (${holidayName}).`,
      timeZone,
    };
  }

  if (clock.weekday === 'Sat' || clock.weekday === 'Sun') {
    return {
      state: 'closed',
      holidayName: null,
      reason: 'Hafta sonu seans dışı (son kapanış verisi).',
      timeZone,
    };
  }

  if (ex === 'NASDAQ' || ex === 'NYSE' || ex === 'US' || ex === 'AMEX') {
    const isOpen = clock.minutes >= 9 * 60 + 30 && clock.minutes <= 16 * 60;
    return {
      state: isOpen ? 'open' : 'closed',
      holidayName: null,
      reason: isOpen
        ? 'ABD normal işlem seansı açık (09:30–16:00 ET).'
        : 'ABD normal işlem seansı dışında (seans kapalı).',
      timeZone,
    };
  }

  if (ex === 'TEFAS') {
    return {
      state: 'open',
      holidayName: null,
      reason: 'TEFAS iş günü değerleme döngüsü aktif.',
      timeZone,
    };
  }

  if (ex === 'FOREX' || ex === 'COMMODITY') {
    return {
      state: 'open',
      holidayName: null,
      reason: 'Küresel piyasa iş günü kotasyonu aktif.',
      timeZone,
    };
  }

  // BIST equity / Turkish index default
  const isOpen = clock.minutes >= 10 * 60 && clock.minutes <= 18 * 60 + 10;
  return {
    state: isOpen ? 'open' : 'closed',
    holidayName: null,
    reason: isOpen
      ? 'BIST seansı açık (10:00–18:10 TSİ).'
      : 'BIST seans saatleri dışında (seans kapalı).',
    timeZone,
  };
}

export function getMarketSessionStatus(input: {
  exchange?: string | null;
  asOf?: string | null;
  fetchedAt?: string | null;
  now?: Date;
  customHolidays?: Record<string, string>;
}): MarketSessionInfo {
  const ex = (input.exchange || 'BIST').toUpperCase();
  const dataIso = input.asOf ?? input.fetchedAt ?? null;
  const dataMs = dataIso ? Date.parse(dataIso) : NaN;
  const referenceDate =
    input.now ?? (Number.isFinite(dataMs) ? new Date(dataMs) : new Date());

  const currentEval = classifySingleInstant(ex, referenceDate, input.customHolidays);
  const dataEval = Number.isFinite(dataMs)
    ? classifySingleInstant(ex, new Date(dataMs), input.customHolidays)
    : null;

  const formattedClose = formatCloseTimestamp(dataIso, currentEval.timeZone);
  const lastCloseText = formattedClose
    ? currentEval.state === 'open'
      ? `Son veri: ${formattedClose}`
      : `Son kapanış: ${formattedClose}`
    : null;

  const label =
    currentEval.state === 'open'
      ? ex === 'CRYPTO'
        ? '7/24 Açık'
        : 'Piyasa açık'
      : currentEval.state === 'holiday'
        ? currentEval.holidayName
          ? `Tatil (${currentEval.holidayName})`
          : 'Piyasa tatilde'
        : 'Piyasa kapalı';

  return {
    state: currentEval.state,
    isOpen: currentEval.state === 'open',
    label,
    reason: currentEval.reason,
    holidayName: currentEval.holidayName,
    lastCloseText,
    dataSessionState: dataEval?.state ?? null,
    timeZone: currentEval.timeZone,
  };
}
