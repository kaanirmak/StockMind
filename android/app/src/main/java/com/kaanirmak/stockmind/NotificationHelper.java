package com.kaanirmak.stockmind;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class NotificationHelper {

    public static final String CHANNEL_ID = "stockmind_alerts_v3";
    public static final String CHANNEL_NAME = "Fiyat & Portföy Bildirimleri";
    public static final String CHANNEL_DESC = "StockMind anlık hedef fiyat uyarıları, kapanış bülteni ve portföy bildirimleri";

    public static Uri getNotificationSoundUri(Context context) {
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/" + R.raw.notification);
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // Delete legacy channels so Android immediately applies custom sound
            try {
                notificationManager.deleteNotificationChannel("stockmind_alerts");
                notificationManager.deleteNotificationChannel("stockmind_alerts_v2");
            } catch (Throwable ignored) {}

            Uri soundUri = getNotificationSoundUri(context);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();

            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESC);
            channel.setSound(soundUri, audioAttributes);
            channel.enableLights(true);
            channel.setLightColor(Color.MAGENTA);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 250, 150, 250});

            notificationManager.createNotificationChannel(channel);
        }
    }

    public static void showNotification(Context context, String title, String message, String route) {
        if (context == null) return;
        try {
            createNotificationChannel(context);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    android.util.Log.w("NotificationHelper", "POST_NOTIFICATIONS permission not granted");
                    return;
                }
            }

            Intent intent = new Intent(context, MainActivity.class);
            if (route != null && !route.isEmpty()) {
                intent.putExtra("target_route", route);
            }
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            int requestCode = (int) System.currentTimeMillis();
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Uri soundUri = getNotificationSoundUri(context);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setSound(soundUri)
                    .setVibrate(new long[]{0, 250, 150, 250})
                    .setLights(Color.MAGENTA, 1000, 1000)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            NotificationManagerCompat manager = NotificationManagerCompat.from(context);
            int notificationId = (int) (System.currentTimeMillis() % 100000);
            manager.notify(notificationId, builder.build());
        } catch (Throwable t) {
            android.util.Log.e("NotificationHelper", "Failed to show notification", t);
        }
    }
}
