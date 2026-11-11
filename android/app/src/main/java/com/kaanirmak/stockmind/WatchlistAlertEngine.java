package com.kaanirmak.stockmind;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.Locale;

/**
 * Pure-Java threshold evaluation and notification route builder shared by
 * StockPriceWorker and JVM unit verification tests.
 */
public final class WatchlistAlertEngine {

    private WatchlistAlertEngine() {}

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
}
