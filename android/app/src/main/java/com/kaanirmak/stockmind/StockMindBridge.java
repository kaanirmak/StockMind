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
    public void playNotificationSound() {
        if (context == null) return;
        try {
            android.media.MediaPlayer mediaPlayer = android.media.MediaPlayer.create(context, R.raw.notification);
            if (mediaPlayer != null) {
                mediaPlayer.setOnCompletionListener(android.media.MediaPlayer::release);
                mediaPlayer.start();
            }
        } catch (Throwable t) {
            android.util.Log.e("StockMindBridge", "Failed to play notification sound", t);
        }
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

    @JavascriptInterface
    public void syncWatchlistAlerts(String alertsJson) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences("StockMindAlertsPrefs", Context.MODE_PRIVATE);
        prefs.edit().putString("watchlist_items", alertsJson).apply();
    }

    @JavascriptInterface
    public String getAppVersion() {
        if (context == null) return "1.0.2";
        try {
            android.content.pm.PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return pInfo.versionName != null ? pInfo.versionName : "1.0.2";
        } catch (Exception e) {
            return "1.0.2";
        }
    }

    @JavascriptInterface
    public int getAppVersionCode() {
        if (context == null) return 3;
        try {
            android.content.pm.PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return (int) pInfo.getLongVersionCode();
            } else {
                return pInfo.versionCode;
            }
        } catch (Exception e) {
            return 3;
        }
    }

    @JavascriptInterface
    public void downloadAndInstallUpdate(String downloadUrl) {
        if (context instanceof MainActivity) {
            ((MainActivity) context).startApkDownload(downloadUrl);
        }
    }
}
