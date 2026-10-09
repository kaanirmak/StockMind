package com.kaanirmak.stockmind;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Background worker that runs periodically even when the app is completely closed.
 * It checks watchlist target price alerts and scheduled market reports.
 */
public class StockPriceWorker extends Worker {

    private static final String TAG = "StockPriceWorker";
    private static final String PREFS_NAME = "StockMindPrefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String DEFAULT_URL = "https://stockmind-finora.vercel.app";

    public StockPriceWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();

        try {
            // Check push preferences
            SharedPreferences pushPrefs = context.getSharedPreferences("StockMindPushPrefs", Context.MODE_PRIVATE);
            String pushSettingsJson = pushPrefs.getString("push_settings", "{}");
            JSONObject settings = new JSONObject(pushSettingsJson);

            boolean enabled = settings.optBoolean("enabled", true);
            if (!enabled) {
                Log.d(TAG, "Push notifications are disabled by user in settings");
                return Result.success();
            }

            boolean priceAlerts = settings.optBoolean("priceAlerts", true);
            boolean dailyReport = settings.optBoolean("dailyReport", true);

            // Get current server URL
            SharedPreferences appPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String serverUrl = appPrefs.getString(KEY_SERVER_URL, DEFAULT_URL);
            if (serverUrl == null || serverUrl.isEmpty()) {
                serverUrl = DEFAULT_URL;
            }
            serverUrl = serverUrl.replaceAll("/$", "");

            // 1. Check daily market close report (between 18:10 and 19:30 on weekdays)
            if (dailyReport) {
                checkDailyReport(context);
            }

            // 2. Check Watchlist target prices
            if (priceAlerts) {
                checkWatchlistAlerts(context, serverUrl);
            }

            // 3. Check for new app version updates (only notifies outdated devices)
            checkAppUpdate(context, serverUrl);

            return Result.success();
        } catch (Throwable t) {
            Log.e(TAG, "StockPriceWorker failed", t);
            return Result.retry();
        }
    }

    private void checkDailyReport(Context context) {
        Calendar cal = Calendar.getInstance();
        int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK);
        // Weekdays: Monday to Friday
        if (dayOfWeek >= Calendar.MONDAY && dayOfWeek <= Calendar.FRIDAY) {
            int hour = cal.get(Calendar.HOUR_OF_DAY);
            int minute = cal.get(Calendar.MINUTE);
            // Between 18:10 and 19:30
            if ((hour == 18 && minute >= 10) || hour == 19) {
                SharedPreferences alertPrefs = context.getSharedPreferences("StockMindAlertsPrefs", Context.MODE_PRIVATE);
                String todayKey = "daily_report_" + cal.get(Calendar.YEAR) + "_" + cal.get(Calendar.DAY_OF_YEAR);
                boolean alreadySent = alertPrefs.getBoolean(todayKey, false);
                if (!alreadySent) {
                    alertPrefs.edit().putBoolean(todayKey, true).apply();
                    NotificationHelper.showNotification(
                            context,
                            "📊 BIST Günlük Kapanış Bülteni",
                            "Borsa İstanbul seansı kapandı. Günlük portföy ve takip listenizdeki hisse değişimlerini inceleyin.",
                            "/dashboard"
                    );
                }
            }
        }
    }

    private void checkWatchlistAlerts(Context context, String serverUrl) {
        SharedPreferences alertPrefs = context.getSharedPreferences("StockMindAlertsPrefs", Context.MODE_PRIVATE);
        String watchlistRaw = alertPrefs.getString("watchlist_items", "[]");
        if (watchlistRaw == null || watchlistRaw.trim().isEmpty() || watchlistRaw.equals("[]")) {
            return;
        }

        try {
            JSONArray items = new JSONArray(watchlistRaw);
            if (items.length() == 0) return;

            // Fetch live stocks from /api/stocks
            String apiUrl = serverUrl + "/api/stocks";
            String jsonResponse = fetchJson(apiUrl);
            if (jsonResponse == null || jsonResponse.isEmpty()) {
                Log.w(TAG, "Empty response from " + apiUrl);
                return;
            }

            JSONObject respObj = new JSONObject(jsonResponse);
            JSONArray dataArr = respObj.optJSONArray("data");
            if (dataArr == null) return;

            // Map symbols to latest prices
            Map<String, Double> livePrices = new HashMap<>();
            for (int i = 0; i < dataArr.length(); i++) {
                JSONObject s = dataArr.getJSONObject(i);
                String sym = s.optString("symbol", "").toUpperCase(Locale.ROOT);
                double price = s.optDouble("price", 0.0);
                if (!sym.isEmpty() && price > 0) {
                    livePrices.put(sym, price);
                }
            }

            // Check alerts against watchlist items
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                String sym = item.optString("symbol", "").toUpperCase(Locale.ROOT);
                double targetPrice = item.optDouble("targetPrice", 0.0);
                double basePrice = item.optDouble("price", 0.0);
                String name = item.optString("name", sym);

                if (targetPrice <= 0 || !livePrices.containsKey(sym)) {
                    continue;
                }

                double livePrice = livePrices.get(sym);
                String alertSentKey = "alert_sent_" + sym + "_" + (long) (targetPrice * 100);
                boolean sent = alertPrefs.getBoolean(alertSentKey, false);

                // Determine whether target price was crossed
                boolean reached = false;
                if (targetPrice >= basePrice) {
                    if (livePrice >= targetPrice) {
                        reached = true;
                    }
                } else {
                    if (livePrice <= targetPrice) {
                        reached = true;
                    }
                }

                if (reached && !sent) {
                    alertPrefs.edit().putBoolean(alertSentKey, true).apply();
                    NotificationHelper.showNotification(
                            context,
                            "🎯 Hedef Fiyat Uyarısı: " + sym,
                            name + " (" + sym + ") hedeflediğiniz " + String.format(Locale.getDefault(), "%.2f ₺", targetPrice) + " seviyesine ulaştı! (Güncel: " + String.format(Locale.getDefault(), "%.2f ₺", livePrice) + ")",
                            "/watchlist"
                    );
                }
            }
        } catch (Throwable t) {
            Log.e(TAG, "Error checking watchlist alerts in background worker", t);
        }
    }

    private String fetchJson(String urlString) {
        HttpURLConnection conn = null;
        BufferedReader reader = null;
        try {
            URL url = new URL(urlString);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("User-Agent", "StockMind-Android-Worker");

            int responseCode = conn.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                Log.w(TAG, "HTTP response error: " + responseCode + " for " + urlString);
                return null;
            }

            reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        } catch (Exception e) {
            Log.e(TAG, "Network exception fetching " + urlString, e);
            return null;
        } finally {
            if (reader != null) {
                try {
                    reader.close();
                } catch (Exception ignored) {}
            }
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void checkAppUpdate(Context context, String serverUrl) {
        try {
            int currentVersionCode = 1;
            try {
                android.content.pm.PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    currentVersionCode = (int) pInfo.getLongVersionCode();
                } else {
                    currentVersionCode = pInfo.versionCode;
                }
            } catch (Exception ignored) {}

            String versionApiUrl = serverUrl + "/api/app/version";
            String jsonResponse = fetchJson(versionApiUrl);
            if (jsonResponse == null || jsonResponse.isEmpty()) return;

            JSONObject vObj = new JSONObject(jsonResponse);
            int remoteVersionCode = vObj.optInt("versionCode", 0);
            String remoteVersionName = vObj.optString("version", "1.0.2");

            // ONLY notify if this device is outdated!
            if (remoteVersionCode > currentVersionCode) {
                SharedPreferences alertPrefs = context.getSharedPreferences("StockMindAlertsPrefs", Context.MODE_PRIVATE);
                String updateNotifiedKey = "update_notif_sent_" + remoteVersionCode;
                boolean alreadyNotified = alertPrefs.getBoolean(updateNotifiedKey, false);

                if (!alreadyNotified) {
                    alertPrefs.edit().putBoolean(updateNotifiedKey, true).apply();
                    NotificationHelper.showNotification(
                            context,
                            "🚀 Yeni StockMind Güncellemesi Mevcut (v" + remoteVersionName + ")",
                            "StockMind'ın yeni sürümü hazır! Performans ve kapalıyken fiyat alarmlarını almak için hemen güncelleyin.",
                            "/settings"
                    );
                }
            }

            // Check for broadcast announcements/test notifications
            if (vObj.has("broadcast") && !vObj.isNull("broadcast")) {
                JSONObject bObj = vObj.optJSONObject("broadcast");
                if (bObj != null) {
                    String bId = bObj.optString("id");
                    String bTitle = bObj.optString("title", "StockMind 📢");
                    String bMsg = bObj.optString("message", "");
                    String bRoute = bObj.optString("route", "/dashboard");

                    if (!bId.isEmpty() && !bMsg.isEmpty()) {
                        SharedPreferences alertPrefs = context.getSharedPreferences("StockMindAlertsPrefs", Context.MODE_PRIVATE);
                        String bcNotifiedKey = "broadcast_sent_" + bId;
                        if (!alertPrefs.getBoolean(bcNotifiedKey, false)) {
                            alertPrefs.edit().putBoolean(bcNotifiedKey, true).apply();
                            NotificationHelper.showNotification(context, bTitle, bMsg, bRoute);
                        }
                    }
                }
            }
        } catch (Throwable t) {
            Log.e(TAG, "Error checking app update in worker", t);
        }
    }
}
