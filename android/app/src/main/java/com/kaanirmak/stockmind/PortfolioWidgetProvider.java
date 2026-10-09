package com.kaanirmak.stockmind;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class PortfolioWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "StockMindWidgetPrefs";
    public static final String KEY_TOTAL_VALUE = "portfolio_total_value";
    public static final String KEY_DAILY_CHANGE = "portfolio_daily_change";
    public static final String KEY_SUB_INFO = "portfolio_sub_info";
    public static final String KEY_PERIOD_LABEL = "portfolio_period_label";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String totalVal = prefs.getString(KEY_TOTAL_VALUE, "₺199.957,69");
            String dailyChange = prefs.getString(KEY_DAILY_CHANGE, "↗ +₺2.793,42 (+%1.40)");
            String subInfo = prefs.getString(KEY_SUB_INFO, "Maliyet: ₺226.433 • $4,053");
            String period = prefs.getString(KEY_PERIOD_LABEL, "● Bugün");

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_portfolio_layout);
            views.setTextViewText(R.id.tv_total_value, totalVal);
            views.setTextViewText(R.id.tv_daily_change, dailyChange);
            views.setTextViewText(R.id.tv_sub_info, subInfo);
            views.setTextViewText(R.id.tv_period_badge, period);

            // Colorize positive / negative
            if (dailyChange.contains("-") || dailyChange.contains("▼")) {
                views.setTextColor(R.id.tv_daily_change, 0xFFF43F5E);
            } else {
                views.setTextColor(R.id.tv_daily_change, 0xFF10B981);
            }

            // Tap opens MainActivity
            Intent intent = new Intent(context, MainActivity.class);
            intent.putExtra("target_route", "/portfolio");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Throwable t) {
            android.util.Log.e("PortfolioWidget", "Error updating widget: " + appWidgetId, t);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, PortfolioWidgetProvider.class);
        int[] allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
        for (int widgetId : allWidgetIds) {
            updateAppWidget(context, appWidgetManager, widgetId);
        }
    }
}
