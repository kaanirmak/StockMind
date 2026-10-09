package com.kaanirmak.stockmind;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;

import androidx.core.app.NotificationManagerCompat;

public class StockMindBridge {

    private final Context context;

    public StockMindBridge(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public void updatePortfolio(String totalValue, String dailyPnL, String dailyPercent, String subInfo, String period) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PortfolioWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(PortfolioWidgetProvider.KEY_TOTAL_VALUE, totalValue)
                .putString(PortfolioWidgetProvider.KEY_DAILY_CHANGE, dailyPnL + " (" + dailyPercent + ")")
                .putString(PortfolioWidgetProvider.KEY_SUB_INFO, subInfo)
                .putString(PortfolioWidgetProvider.KEY_PERIOD_LABEL, period)
                .apply();

        PortfolioWidgetProvider.updateAllWidgets(context);
    }

    @JavascriptInterface
    public void updateHeatmap(String holdingsJson) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(HeatmapWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(HeatmapWidgetProvider.KEY_HEATMAP_JSON, holdingsJson)
                .apply();

        HeatmapWidgetProvider.updateAllWidgets(context);
    }

    @JavascriptInterface
    public void sendNativeNotification(String title, String message, String route) {
        if (context == null) return;
        NotificationHelper.showNotification(context, title, message, route);
    }

    @JavascriptInterface
    public boolean hasNotificationPermission() {
        if (context == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        if (context instanceof MainActivity) {
            ((MainActivity) context).requestNotificationPermissionExplicit();
        }
    }

    @JavascriptInterface
    public void savePushSettings(String settingsJson) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences("StockMindPushPrefs", Context.MODE_PRIVATE);
        prefs.edit().putString("push_settings", settingsJson).apply();
    }

    @JavascriptInterface
    public String getPushSettings() {
        if (context == null) return "{}";
        SharedPreferences prefs = context.getSharedPreferences("StockMindPushPrefs", Context.MODE_PRIVATE);
        return prefs.getString("push_settings", "{}");
    }
}
