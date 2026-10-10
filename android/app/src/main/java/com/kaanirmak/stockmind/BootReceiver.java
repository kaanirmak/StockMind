package com.kaanirmak.stockmind;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/**
 * Ensures background stock checks are immediately re-scheduled
 * when phone restarts or the app is updated.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.d(TAG, "Device booted or app updated: scheduling background worker");
            try {
                Constraints constraints = new Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build();

                PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
                        StockPriceWorker.class,
                        15, TimeUnit.MINUTES
                )
                        .setConstraints(constraints)
                        .build();

                WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                        "StockPriceCheckWorker",
                        ExistingPeriodicWorkPolicy.UPDATE,
                        workRequest
                );
            } catch (Throwable t) {
                Log.e(TAG, "Failed to schedule worker on boot", t);
            }
        }
    }
}
