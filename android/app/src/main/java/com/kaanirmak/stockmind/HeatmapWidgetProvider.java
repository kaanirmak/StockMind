package com.kaanirmak.stockmind;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class HeatmapWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "StockMindWidgetPrefs";
    public static final String KEY_HEATMAP_JSON = "heatmap_items_json";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawJson = prefs.getString(KEY_HEATMAP_JSON, null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_heatmap_layout);

        // Default holdings if not yet synchronized from webapp
        String[][] holdings = new String[][]{
                {"GRAM_ALTIN", "+%1.55", "%67 Pay", "true"},
                {"QQQ", "+%0.44", "%12 Pay", "true"},
                {"THYAO", "+%1.14", "%6.5 Pay", "true"},
                {"CCOLA", "+%4.20", "%5.0 Pay", "true"}
        };

        if (rawJson != null) {
            try {
                JSONArray arr = new JSONArray(rawJson);
                for (int i = 0; i < Math.min(4, arr.length()); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    String sym = obj.optString("symbol", holdings[i][0]);
                    double pct = obj.optDouble("percent", 0.0);
                    double pay = obj.optDouble("pay", 0.0);

                    String sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
                    String changeStr = sign + "%" + String.format(java.util.Locale.US, "%.2f", Math.abs(pct));
                    String payStr = "%" + String.format(java.util.Locale.US, "%.1f", pay) + " Pay";
                    boolean isPositive = pct >= 0;

                    holdings[i] = new String[]{sym, changeStr, payStr, String.valueOf(isPositive)};
                }
            } catch (Exception ignored) {}
        }

        // Tile 1
        views.setTextViewText(R.id.tv_h1_symbol, holdings[0][0]);
        views.setTextViewText(R.id.tv_h1_change, holdings[0][1]);
        views.setTextViewText(R.id.tv_h1_pay, holdings[0][2]);
        views.setInt(R.id.ll_tile1, "setBackgroundResource", Boolean.parseBoolean(holdings[0][3]) ? R.drawable.widget_tile_green : R.drawable.widget_tile_red);

        // Tile 2
        views.setTextViewText(R.id.tv_h2_symbol, holdings[1][0]);
        views.setTextViewText(R.id.tv_h2_change, holdings[1][1]);
        views.setTextViewText(R.id.tv_h2_pay, holdings[1][2]);
        views.setInt(R.id.ll_tile2, "setBackgroundResource", Boolean.parseBoolean(holdings[1][3]) ? R.drawable.widget_tile_green : R.drawable.widget_tile_red);

        // Tile 3
        views.setTextViewText(R.id.tv_h3_symbol, holdings[2][0]);
        views.setTextViewText(R.id.tv_h3_change, holdings[2][1]);
        views.setTextViewText(R.id.tv_h3_pay, holdings[2][2]);
        views.setInt(R.id.ll_tile3, "setBackgroundResource", Boolean.parseBoolean(holdings[2][3]) ? R.drawable.widget_tile_green : R.drawable.widget_tile_red);

        // Tile 4
        views.setTextViewText(R.id.tv_h4_symbol, holdings[3][0]);
        views.setTextViewText(R.id.tv_h4_change, holdings[3][1]);
        views.setTextViewText(R.id.tv_h4_pay, holdings[3][2]);
        views.setInt(R.id.ll_tile4, "setBackgroundResource", Boolean.parseBoolean(holdings[3][3]) ? R.drawable.widget_tile_green : R.drawable.widget_tile_red);

        // Tap opens MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("target_route", "/dashboard");
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_heatmap_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, HeatmapWidgetProvider.class);
        int[] allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
        for (int widgetId : allWidgetIds) {
            updateAppWidget(context, appWidgetManager, widgetId);
        }
    }
}
