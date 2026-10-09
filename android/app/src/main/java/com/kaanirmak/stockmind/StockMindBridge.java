package com.kaanirmak.stockmind;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

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
}
