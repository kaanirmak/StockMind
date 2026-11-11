package com.kaanirmak.stockmind;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * Pure-Java threshold evaluation, quote freshness gating, and notification route builder
 * shared by StockPriceWorker and verification checks.
 */
public final class WatchlistAlertEngine {

    private static final long TWENTY_FOUR_HOURS_MS = 24L * 60L * 60L * 1000L;
    private static final long NINETY_SIX_HOURS_MS = 96L * 60L * 60L * 1000L;
    private static final Set<String> DISALLOWED_SOURCES = new HashSet<>(
            Arrays.asList("fallback", "placeholder", "mock", "seed", "unknown")
    );

    private WatchlistAlertEngine() {}

    public static final class QuoteSnapshot {
        public final String symbol;
        public final String assetType;
        public final double price;
        public final boolean isLastKnown;
        public final String source;
        public final String navDate;
        public final String lastSyncAt;

        public QuoteSnapshot(
                String symbol,
                String assetType,
                double price,
                boolean isLastKnown,
                String source,
                String navDate,
                String lastSyncAt
        ) {
            this.symbol = symbol;
            this.assetType = assetType;
            this.price = price;
            this.isLastKnown = isLastKnown;
            this.source = source;
            this.navDate = navDate;
            this.lastSyncAt = lastSyncAt;
        }
    }

    public static final class QuoteFreshnessResult {
        public final boolean eligible;
        public final String reason;
        public final String description;
        public final String observedAt;

        public QuoteFreshnessResult(
                boolean eligible,
                String reason,
                String description,
                String observedAt
        ) {
            this.eligible = eligible;
            this.reason = reason;
            this.description = description;
            this.observedAt = observedAt;
        }
    }

    public static final class AlertCheckResult {
        public final boolean reached;
        public final String notifTitle;
        public final String notifBody;
        public final String alertConfig;
        public final String assetRoute;

        public AlertCheckResult(
                boolean reached,
                String notifTitle,
                String notifBody,
                String alertConfig,
                String assetRoute
        ) {
            this.reached = reached;
            this.notifTitle = notifTitle;
            this.notifBody = notifBody;
            this.alertConfig = alertConfig;
            this.assetRoute = assetRoute;
        }
    }

    /**
     * Resolves the in-app deep-link route opened when a user taps a price alert notification.
     */
    public static String buildAssetRoute(String assetType, String symbol) {
        String normalized = symbol == null ? "" : symbol.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return "/watchlist";
        }
        String encoded;
        try {
            encoded = URLEncoder.encode(normalized, "UTF-8").replace("+", "%20");
        } catch (UnsupportedEncodingException ignored) {
            encoded = normalized;
        }
        if ("fund".equalsIgnoreCase(assetType)) {
            return "/funds/" + encoded;
        }
        return "/stocks/" + encoded;
    }

    /**
     * Validates whether a quote has a verified source, positive price, and fresh timestamp
     * before triggering a stock or TEFAS fund background alert.
     */
    public static QuoteFreshnessResult evaluateQuoteFreshness(
            QuoteSnapshot quote,
            String assetType,
            long nowMillis
    ) {
        if (quote == null) {
            return new QuoteFreshnessResult(
                    false,
                    "missing-quote",
                    "Sağlayıcıdan aktif fiyat verisi alınamadı; alarm ertelendi.",
                    null
            );
        }

        String navDate = trimToNull(quote.navDate);
        String lastSyncAt = trimToNull(quote.lastSyncAt);
        String observedAt = navDate != null ? navDate : lastSyncAt;
        boolean isFund = "fund".equalsIgnoreCase(assetType) || "fund".equalsIgnoreCase(quote.assetType);

        if (!Double.isFinite(quote.price) || quote.price <= 0) {
            return new QuoteFreshnessResult(
                    false,
                    "invalid-price",
                    "Geçerli pozitif fiyat bulunamadı; alarm ertelendi.",
                    observedAt
            );
        }

        if (quote.isLastKnown) {
            return new QuoteFreshnessResult(
                    false,
                    "last-known-fallback",
                    "Yalnızca son doğrulanan önbellek fiyatı bulunduğu için alarm ertelendi.",
                    observedAt
            );
        }

        String source = trimToNull(quote.source);
        if (source == null && isFund && (navDate != null || lastSyncAt != null)) {
            source = "TEFAS";
        }
        if (source == null || DISALLOWED_SOURCES.contains(source.toLowerCase(Locale.ROOT))) {
            return new QuoteFreshnessResult(
                    false,
                    "missing-source",
                    "Fiyat kaynağı doğrulanamadığı için alarm ertelendi.",
                    observedAt
            );
        }

        if (navDate == null && lastSyncAt == null) {
            return new QuoteFreshnessResult(
                    false,
                    "missing-timestamp",
                    "Fiyat gözlem zamanı eksik olduğu için alarm ertelendi.",
                    null
            );
        }

        if (isFund || "TEFAS".equalsIgnoreCase(source)) {
            if (navDate != null && navDate.matches("^\\d{4}-\\d{2}-\\d{2}.*")) {
                String navDay = navDate.substring(0, 10);
                String todayTr = formatIstanbulDate(nowMillis);
                long diffDays = diffUtcDays(todayTr, navDay);
                if (diffDays > 4) {
                    return new QuoteFreshnessResult(
                            false,
                            "stale-price",
                            "TEFAS değerleme tarihi eski (" + navDay + "); alarm taze veri gelene kadar ertelendi.",
                            observedAt
                    );
                }
                return new QuoteFreshnessResult(true, "ok", "Geçerli TEFAS değerlemesi.", observedAt);
            }

            long fetchedMs = parseIsoMillis(lastSyncAt);
            if (fetchedMs < 0 || Math.max(0L, nowMillis - fetchedMs) > TWENTY_FOUR_HOURS_MS) {
                return new QuoteFreshnessResult(
                        false,
                        "stale-price",
                        "TEFAS senkronizasyon verisi güncel değil; alarm ertelendi.",
                        observedAt
                );
            }
            return new QuoteFreshnessResult(true, "ok", "Geçerli TEFAS değerlemesi.", observedAt);
        }

        long fetchedMs = parseIsoMillis(lastSyncAt != null ? lastSyncAt : navDate);
        if (fetchedMs >= 0 && Math.max(0L, nowMillis - fetchedMs) > NINETY_SIX_HOURS_MS) {
            return new QuoteFreshnessResult(
                    false,
                    "stale-price",
                    "Hisse fiyat gözlemi eski; alarm taze veri gelene kadar ertelendi.",
                    observedAt
            );
        }

        return new QuoteFreshnessResult(true, "ok", "Geçerli piyasa gözlemi.", observedAt);
    }

    /**
     * Evaluates whether a live price satisfies the configured stock/fund watchlist alert threshold.
     */
    public static AlertCheckResult evaluateThreshold(
            String symbol,
            String displayName,
            String assetType,
            String alertTypeRaw,
            double targetPrice,
            double alertPercent,
            double alertBase,
            double livePrice
    ) {
        String sym = symbol == null ? "" : symbol.trim().toUpperCase(Locale.ROOT);
        String name = (displayName == null || displayName.trim().isEmpty()) ? sym : displayName.trim();
        String alertType = (alertTypeRaw == null || alertTypeRaw.trim().isEmpty()) ? "price" : alertTypeRaw.trim();
        String assetRoute = buildAssetRoute(assetType, sym);
        String alertConfig = targetPrice + ":" + alertPercent + ":" + alertBase;

        if (sym.isEmpty() || !Double.isFinite(livePrice) || livePrice <= 0) {
            return new AlertCheckResult(false, "", "", alertConfig, assetRoute);
        }

        boolean reached = false;
        String notifTitle = "🎯 Hedef Fiyat Uyarısı: " + sym;
        String notifBody = "";

        if ("percent_up".equals(alertType) && alertPercent > 0 && alertBase > 0) {
            double threshold = alertBase * (1.0 + alertPercent / 100.0);
            if (livePrice >= threshold) {
                reached = true;
                notifTitle = "📈 %" + String.format(Locale.getDefault(), "%.1f", alertPercent) + " Yükseliş Alarmı: " + sym;
                notifBody = name + " (" + sym + ") %" + alertPercent + " yükseliş hedefine ulaştı! (Güncel: " + String.format(Locale.getDefault(), "%.2f ₺", livePrice) + ")";
            }
        } else if ("percent_down".equals(alertType) && alertPercent > 0 && alertBase > 0) {
            double threshold = alertBase * (1.0 - alertPercent / 100.0);
            if (livePrice <= threshold) {
                reached = true;
                notifTitle = "📉 %" + String.format(Locale.getDefault(), "%.1f", alertPercent) + " Düşüş Alarmı: " + sym;
                notifBody = name + " (" + sym + ") %" + alertPercent + " düşüş eşiğine geriledi! (Güncel: " + String.format(Locale.getDefault(), "%.2f ₺", livePrice) + ")";
            }
        } else if ("percent_both".equals(alertType) && alertPercent > 0 && alertBase > 0) {
            double upper = alertBase * (1.0 + alertPercent / 100.0);
            double lower = alertBase * (1.0 - alertPercent / 100.0);
            if (livePrice >= upper) {
                reached = true;
                notifTitle = "📈 %" + String.format(Locale.getDefault(), "%.1f", alertPercent) + " Yükseliş Alarmı: " + sym;
                notifBody = name + " (" + sym + ") %" + alertPercent + " yükselerek " + String.format(Locale.getDefault(), "%.2f ₺", livePrice) + " oldu!";
            } else if (livePrice <= lower) {
                reached = true;
                notifTitle = "📉 %" + String.format(Locale.getDefault(), "%.1f", alertPercent) + " Düşüş Alarmı: " + sym;
                notifBody = name + " (" + sym + ") %" + alertPercent + " gerileyerek " + String.format(Locale.getDefault(), "%.2f ₺", livePrice) + " oldu!";
            }
        } else if (targetPrice > 0) {
            if (targetPrice >= alertBase) {
                if (livePrice >= targetPrice) reached = true;
            } else {
                if (livePrice <= targetPrice) reached = true;
            }
            notifTitle = "🎯 Hedef Fiyat Uyarısı: " + sym;
            notifBody = name + " (" + sym + ") hedeflediğiniz " + String.format(Locale.getDefault(), "%.2f ₺", targetPrice) + " seviyesine ulaştı! (Güncel: " + String.format(Locale.getDefault(), "%.2f ₺", livePrice) + ")";
        }

        return new AlertCheckResult(reached, notifTitle, notifBody, alertConfig, assetRoute);
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() || "null".equalsIgnoreCase(trimmed) ? null : trimmed;
    }

    private static String formatIstanbulDate(long nowMillis) {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("Europe/Istanbul"));
        return fmt.format(new Date(nowMillis));
    }

    private static long diffUtcDays(String todayYmd, String targetYmd) {
        try {
            SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date a = fmt.parse(todayYmd);
            Date b = fmt.parse(targetYmd);
            if (a == null || b == null) return 0L;
            return Math.round((double) (a.getTime() - b.getTime()) / (double) TWENTY_FOUR_HOURS_MS);
        } catch (ParseException e) {
            return Long.MAX_VALUE;
        }
    }

    private static long parseIsoMillis(String iso) {
        if (iso == null) return -1L;
        String normalized = iso.trim()
                .replaceFirst("([+-]\\d{2}):(\\d{2})$", "$1$2")
                .replaceAll("Z$", "+0000");
        String[] patterns = new String[]{
                "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
                "yyyy-MM-dd'T'HH:mm:ssZ",
                "yyyy-MM-dd'T'HH:mm:ss.SSS",
                "yyyy-MM-dd'T'HH:mm:ss",
                "yyyy-MM-dd"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat fmt = new SimpleDateFormat(pattern, Locale.US);
                fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date parsed = fmt.parse(normalized);
                if (parsed != null) return parsed.getTime();
            } catch (ParseException ignored) {}
        }
        return -1L;
    }
}
