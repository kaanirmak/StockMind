export type AlertCurrencyCode = 'TRY' | 'USD' | 'EUR';
export type AlertThresholdMode = 'percent' | 'price';
export type AlertDirection = 'up' | 'down' | 'both';
export type FixedPriceDirection = 'up' | 'down';

const CURRENCY_SYMBOLS: Record<AlertCurrencyCode, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
};

export function normalizeAlertCurrency(value?: string | null): AlertCurrencyCode | null {
  const upper = (value || '').trim().toUpperCase();
  if (upper === 'TRY' || upper === 'TL' || upper === '₺') return 'TRY';
  if (upper === 'USD' || upper === '$') return 'USD';
  if (upper === 'EUR' || upper === '€') return 'EUR';
  return null;
}

export function inferAssetAlertCurrency(input: {
  currency?: string | null;
  exchange?: string | null;
  assetType?: 'stock' | 'fund';
  symbol?: string | null;
}): AlertCurrencyCode {
  const explicit = normalizeAlertCurrency(input.currency);
  if (explicit) return explicit;

  const exchange = (input.exchange || '').trim().toUpperCase();
  const sym = (input.symbol || '').trim().toUpperCase();

  if (input.assetType === 'fund' || exchange === 'TEFAS' || exchange === 'BIST' || sym.endsWith('.IS')) {
    return 'TRY';
  }
  if (
    exchange === 'NASDAQ' ||
    exchange === 'NYSE' ||
    exchange === 'US' ||
    exchange === 'AMEX' ||
    exchange === 'CRYPTO' ||
    exchange === 'COMMODITY'
  ) {
    return 'USD';
  }
  return 'TRY';
}

export function getAlertCurrencySymbol(currency: AlertCurrencyCode): string {
  return CURRENCY_SYMBOLS[currency] ?? '₺';
}

export function formatAlertPrice(
  price: number,
  currency: AlertCurrencyCode,
  assetType?: 'stock' | 'fund',
): string {
  const sym = getAlertCurrencySymbol(currency);
  if (!Number.isFinite(price)) return `${sym}0.00`;
  const decimals = assetType === 'fund' ? 4 : price < 1 ? 4 : 2;
  return `${sym}${price.toFixed(decimals)}`;
}

export interface BuildQuickAlertInput {
  symbol: string;
  name?: string;
  currentPrice: number;
  assetType?: 'stock' | 'fund';
  nativeCurrency: AlertCurrencyCode;
  selectedCurrency: AlertCurrencyCode;
  mode: AlertThresholdMode;
  direction: AlertDirection;
  percentValue: number;
  targetPriceInput: string;
  /** Optional exchange rate such that 1 unit of selectedCurrency equals exchangeRateToNative units of nativeCurrency */
  exchangeRateToNative?: number | null;
}

export type QuickAlertBuildResult =
  | {
      ok: true;
      alertType: 'price' | 'percent_up' | 'percent_down' | 'percent_both';
      targetPrice: number;
      alertPercent?: number;
      alertBasePrice: number;
      alertCurrency: AlertCurrencyCode;
      alertDirection: AlertDirection;
      descriptionText: string;
    }
  | {
      ok: false;
      errorTitle: string;
      errorMessage: string;
    };

export function buildQuickAlertConfig(input: BuildQuickAlertInput): QuickAlertBuildResult {
  if (!Number.isFinite(input.currentPrice) || input.currentPrice <= 0) {
    return {
      ok: false,
      errorTitle: 'Fiyat Alınamadı',
      errorMessage: 'Anlık fiyat doğrulanmadan alarm kurulamaz.',
    };
  }

  const assetType = input.assetType || 'stock';
  const decimals = assetType === 'fund' ? 4 : input.currentPrice < 1 ? 4 : 2;

  if (input.mode === 'percent') {
    if (!Number.isFinite(input.percentValue) || input.percentValue <= 0 || input.percentValue > 1000) {
      return {
        ok: false,
        errorTitle: 'Geçersiz Yüzde',
        errorMessage: 'Lütfen %0 ile %1000 arasında geçerli bir değişim oranı girin.',
      };
    }

    const alertType =
      input.direction === 'up'
        ? 'percent_up'
        : input.direction === 'down'
          ? 'percent_down'
          : 'percent_both';

    const targetPrice = Number(
      (
        input.direction === 'down'
          ? input.currentPrice * (1 - input.percentValue / 100)
          : input.currentPrice * (1 + input.percentValue / 100)
      ).toFixed(decimals),
    );

    const formattedBase = formatAlertPrice(input.currentPrice, input.nativeCurrency, assetType);
    const formattedTarget = formatAlertPrice(targetPrice, input.nativeCurrency, assetType);
    const descriptionText =
      input.direction === 'up'
        ? `${formattedBase} seviyesinden %${input.percentValue} yükseldiğinde (${formattedTarget})`
        : input.direction === 'down'
          ? `${formattedBase} seviyesinden %${input.percentValue} düştüğünde (${formattedTarget})`
          : `${formattedBase} seviyesinden ±%${input.percentValue} saptığında`;

    return {
      ok: true,
      alertType,
      targetPrice,
      alertPercent: input.percentValue,
      alertBasePrice: input.currentPrice,
      alertCurrency: input.nativeCurrency,
      alertDirection: input.direction,
      descriptionText,
    };
  }

  const parsedTarget = Number(input.targetPriceInput.replace(',', '.'));
  if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
    return {
      ok: false,
      errorTitle: 'Geçersiz Hedef Fiyat',
      errorMessage: 'Lütfen 0’dan büyük geçerli bir hedef fiyat girin.',
    };
  }

  const fixedDirection: FixedPriceDirection = input.direction === 'down' ? 'down' : 'up';
  let nativeTargetPrice = parsedTarget;
  let storedCurrency: AlertCurrencyCode = input.nativeCurrency;

  if (input.selectedCurrency !== input.nativeCurrency) {
    const rate = input.exchangeRateToNative;
    if (!Number.isFinite(rate) || !rate || rate <= 0) {
      return {
        ok: false,
        errorTitle: 'Para Birimi Uyuşmazlığı',
        errorMessage: `${input.symbol.toUpperCase()} fiyatı ${input.nativeCurrency} cinsinden izlenir. Çapraz kur olmadan sabit fiyat eşiği için ${input.nativeCurrency} seçin veya yüzdesel eşik kullanın.`,
      };
    }
    nativeTargetPrice = Number((parsedTarget * rate).toFixed(decimals));
    storedCurrency = input.nativeCurrency;
  }

  const formattedDisplayTarget = formatAlertPrice(parsedTarget, input.selectedCurrency, assetType);
  const directionVerb = fixedDirection === 'up' ? 'veya üzerine çıktığında' : 'veya altına indiğinde';

  return {
    ok: true,
    alertType: 'price',
    targetPrice: nativeTargetPrice,
    alertBasePrice: input.currentPrice,
    alertCurrency: storedCurrency,
    alertDirection: fixedDirection,
    descriptionText: `fiyatı ${formattedDisplayTarget} seviyesine ${directionVerb}`,
  };
}
