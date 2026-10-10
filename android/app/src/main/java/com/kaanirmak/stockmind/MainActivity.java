package com.kaanirmak.stockmind;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.core.content.FileProvider;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.os.Environment;
import java.io.File;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "StockMindPrefs";
    private static final String KEY_SERVER_URL = "server_url";
    
    // Production server URL and local emulator fallback
    private static final String PRODUCTION_URL = "https://stockmind-finora.vercel.app";
    private static final String DEFAULT_EMULATOR_URL = "http://10.0.2.2:3000";

    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private View errorView;
    private TextView errorDetailText;
    private TextView currentUrlText;
    private Button btnRetry;
    private Button btnChangeUrl;

    private SharedPreferences prefs;
    private String currentServerUrl;
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private ActivityResultLauncher<String> notificationPermissionLauncher;
    private long backPressedTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        setContentView(R.layout.activity_main);

        // Hide bottom navigation bar (system router) and set window insets
        hideBottomNavigation();

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        currentServerUrl = prefs.getString(KEY_SERVER_URL, getDefaultUrl());

        // Auto-migrate if previously stuck on local development IP, old domain or invalid URL
        if (currentServerUrl == null || currentServerUrl.contains("192.168.1.") || currentServerUrl.contains("stock-mind-bay") || currentServerUrl.isEmpty()) {
            currentServerUrl = getDefaultUrl();
            prefs.edit().putString(KEY_SERVER_URL, currentServerUrl).apply();
        }

        initViews();
        setupFileChooser();
        setupNotificationPermission();
        setupWebView();
        setupBackNavigation();
        schedulePeriodicPriceCheck();

        loadAppUrl();
    }

    private void schedulePeriodicPriceCheck() {
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

            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                    "StockPriceCheckWorker",
                    ExistingPeriodicWorkPolicy.KEEP,
                    workRequest
            );
        } catch (Throwable t) {
            android.util.Log.e("MainActivity", "Failed to schedule StockPriceWorker", t);
        }
    }

    private void setupNotificationPermission() {
        notificationPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                isGranted -> {
                    if (isGranted) {
                        NotificationHelper.createNotificationChannel(this);
                    }
                }
        );
        NotificationHelper.createNotificationChannel(this);
    }

    public void requestNotificationPermissionExplicit() {
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS);
                } else {
                    Toast.makeText(this, "Bildirim izni zaten etkin! 🔔", Toast.LENGTH_SHORT).show();
                }
            } else {
                Toast.makeText(this, "Bildirimler aktif! 🔔", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void hideBottomNavigation() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            // Hide navigation bars (bottom router/gesture bar)
            insetsController.hide(WindowInsetsCompat.Type.navigationBars());
            insetsController.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }

        // Apply status bar top insets to root layout so top header is never covered by the clock or notch
        View root = findViewById(R.id.rootLayout);
        if (root != null) {
            ViewCompat.setOnApplyWindowInsetsListener(root, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.statusBars());
                v.setPadding(0, insets.top, 0, 0);
                return windowInsets;
            });
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideBottomNavigation();
        }
    }

    private String getDefaultUrl() {
        // Detect if running inside standard Android Emulator
        if (Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")) {
            return DEFAULT_EMULATOR_URL;
        }
        return PRODUCTION_URL;
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        progressBar = findViewById(R.id.progressBar);
        errorView = findViewById(R.id.errorView);
        errorDetailText = findViewById(R.id.errorDetailText);
        currentUrlText = findViewById(R.id.currentUrlText);
        btnRetry = findViewById(R.id.btnRetry);
        btnChangeUrl = findViewById(R.id.btnChangeUrl);

        swipeRefreshLayout.setColorSchemeColors(0xFF8B5CF6, 0xFF10B981);
        swipeRefreshLayout.setProgressBackgroundColorSchemeColor(0xFF131B2E);
        swipeRefreshLayout.setOnRefreshListener(() -> {
            if (errorView.getVisibility() == View.VISIBLE) {
                loadAppUrl();
            } else {
                webView.reload();
            }
        });

        btnRetry.setOnClickListener(v -> {
            currentServerUrl = PRODUCTION_URL;
            prefs.edit().putString(KEY_SERVER_URL, currentServerUrl).apply();
            CookieManager.getInstance().removeAllCookies(success -> {
                CookieManager.getInstance().flush();
                loadAppUrl();
            });
        });
        btnChangeUrl.setOnClickListener(v -> showChangeUrlDialog());
    }

    private void setupFileChooser() {
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (filePathCallback != null) {
                        Uri[] results = null;
                        if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                            if (result.getData().getClipData() != null) {
                                int count = result.getData().getClipData().getItemCount();
                                results = new Uri[count];
                                for (int i = 0; i < count; i++) {
                                    results[i] = result.getData().getClipData().getItemAt(i).getUri();
                                }
                            } else if (result.getData().getData() != null) {
                                results = new Uri[]{result.getData().getData()};
                            }
                        }
                        filePathCallback.onReceiveValue(results);
                        filePathCallback = null;
                    }
                });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        // Enable cookies and third-party cookies (essential for Supabase authentication)
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Clean user agent: removes "; wv" and "Version/X.X" so Google Sign-In and OAuth services do NOT block authentication
        String defaultUa = settings.getUserAgentString();
        String cleanUa = defaultUa.replace("; wv", "").replaceAll("Version\\/\\d+\\.\\d+\\s*", "");
        settings.setUserAgentString(cleanUa);

        // Register Android Bridge for Home Screen Widgets synchronization
        webView.addJavascriptInterface(new StockMindBridge(this), "StockMindAndroid");

        // DownloadListener for in-app APK and file downloads
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            startApkDownload(url);
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                    swipeRefreshLayout.setRefreshing(false);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    fileChooserLauncher.launch(intent);
                } catch (ActivityNotFoundException e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Dosya seçici açılamadı", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return super.onConsoleMessage(consoleMessage);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String urlStr = uri.toString();

                // Intercept direct APK downloads and start system download manager with auto-installer
                if (urlStr.endsWith(".apk") || urlStr.contains("/download/apk") || urlStr.contains("StockMind.apk")) {
                    startApkDownload(urlStr);
                    return true;
                }

                if (scheme != null && (scheme.equals("tel") || scheme.equals("mailto") || scheme.equals("whatsapp"))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                errorView.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefreshLayout.setRefreshing(false);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    String failingUrl = request.getUrl() != null ? request.getUrl().toString() : "";
                    if (failingUrl.endsWith(".apk") || failingUrl.contains("download/apk") || failingUrl.contains("StockMind.apk")) {
                        startApkDownload(failingUrl);
                        view.post(() -> view.loadUrl(currentServerUrl));
                        return;
                    }
                    showErrorState(error != null ? error.getDescription().toString() : "Bağlantı hatası");
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                int statusCode = errorResponse != null ? errorResponse.getStatusCode() : 0;
                // Auto-heal HTTP 494 (Request Header Too Large), 431, and 400
                if (statusCode == 494 || statusCode == 431 || statusCode == 400) {
                    CookieManager.getInstance().removeAllCookies(success -> {
                        CookieManager.getInstance().flush();
                        view.post(() -> {
                            Toast.makeText(MainActivity.this, "Oturum çerezleri temizlendi, yeniden bağlanılıyor...", Toast.LENGTH_SHORT).show();
                            view.loadUrl(currentServerUrl);
                        });
                    });
                }
            }
        });
    }

    private void loadAppUrl() {
        errorView.setVisibility(View.GONE);
        progressBar.setVisibility(View.VISIBLE);
        swipeRefreshLayout.setRefreshing(true);

        String targetUrl = currentServerUrl;
        Intent intent = getIntent();
        if (intent != null && intent.hasExtra("target_route")) {
            String route = intent.getStringExtra("target_route");
            if (route != null && !route.isEmpty() && !route.contains(".apk") && !route.contains("download/apk")) {
                targetUrl = currentServerUrl.replaceAll("/$", "") + (route.startsWith("/") ? route : "/" + route);
            }
        }

        try {
            CookieManager cm = CookieManager.getInstance();
            String cookies = cm.getCookie(currentServerUrl);
            // Normal Supabase JWT + refresh tokens are 3-6 KB. Only clear if dangerously bloated (> 12 KB).
            if (cookies != null && cookies.length() > 12288) {
                // Cookies bloated! Clear BEFORE loading URL
                final String finalUrl = targetUrl;
                cm.removeAllCookies(success -> {
                    cm.flush();
                    webView.post(() -> webView.loadUrl(finalUrl));
                });
                return;
            }
        } catch (Exception ignored) {}

        currentUrlText.setText(targetUrl);
        webView.loadUrl(targetUrl);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.hasExtra("target_route") && webView != null) {
            String route = intent.getStringExtra("target_route");
            if (route != null && !route.isEmpty()) {
                if (route.contains(".apk") || route.contains("download/apk")) {
                    startApkDownload(currentServerUrl.replaceAll("/$", "") + (route.startsWith("/") ? route : "/" + route));
                    webView.loadUrl(currentServerUrl);
                } else {
                    String fullUrl = currentServerUrl.replaceAll("/$", "") + (route.startsWith("/") ? route : "/" + route);
                    webView.loadUrl(fullUrl);
                }
            }
        }
    }

    private void showErrorState(String description) {
        swipeRefreshLayout.setRefreshing(false);
        progressBar.setVisibility(View.GONE);
        errorView.setVisibility(View.VISIBLE);
        currentUrlText.setText(currentServerUrl);
        errorDetailText.setText("Hedef sunucuya erişilemedi (" + description + "). Sunucunun çalıştığından emin olun.");
    }

    private void showChangeUrlDialog() {
        final EditText input = new EditText(this);
        input.setText(currentServerUrl);
        input.setSelection(currentServerUrl.length());
        input.setSingleLine(true);
        input.setTextColor(0xFFFFFFFF);
        input.setBackgroundColor(0xFF131B2E);
        input.setPadding(36, 36, 36, 36);

        new AlertDialog.Builder(this, R.style.Theme_StockMind)
                .setTitle("Sunucu URL'sini Girin")
                .setMessage("Yerel geliştirme (örn: http://192.168.1.105:3000) veya canlı yayın adresinizi yazın:")
                .setView(input)
                .setPositiveButton("Kaydet & Aç", (dialog, which) -> {
                    String newUrl = input.getText().toString().trim();
                    if (!newUrl.isEmpty()) {
                        if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
                            newUrl = "http://" + newUrl;
                        }
                        currentServerUrl = newUrl;
                        prefs.edit().putString(KEY_SERVER_URL, currentServerUrl).apply();
                        Toast.makeText(MainActivity.this, "Sunucu güncellendi", Toast.LENGTH_SHORT).show();
                        loadAppUrl();
                    }
                })
                .setNegativeButton("İptal", null)
                .show();
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (errorView.getVisibility() == View.VISIBLE) {
                    finish();
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    if (System.currentTimeMillis() - backPressedTime < 2000) {
                        finish();
                    } else {
                        backPressedTime = System.currentTimeMillis();
                        Toast.makeText(MainActivity.this, "Çıkmak için tekrar basın", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        try {
            CookieManager.getInstance().flush();
        } catch (Exception ignored) {}
        if (webView != null) {
            webView.onPause();
        }
    }

    public void startApkDownload(String downloadUrl) {
        runOnUiThread(() -> {
            try {
                Toast.makeText(this, "StockMind güncellemesi indiriliyor... Tamamlandığında kurulum başlayacak.", Toast.LENGTH_LONG).show();

                String fullUrl = downloadUrl;
                if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
                    fullUrl = currentServerUrl.replaceAll("/$", "") + (fullUrl.startsWith("/") ? fullUrl : "/" + fullUrl);
                }

                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(fullUrl));
                request.setTitle("StockMind v1.0.2 Güncellemesi");
                request.setDescription("Yeni StockMind sürümü indiriliyor...");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                File downloadDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (downloadDir == null) {
                    downloadDir = getFilesDir();
                }
                File destinationFile = new File(downloadDir, "StockMind_update.apk");
                if (destinationFile.exists()) {
                    destinationFile.delete();
                }
                request.setDestinationUri(Uri.fromFile(destinationFile));
                request.setMimeType("application/vnd.android.package-archive");

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    long downloadId = dm.enqueue(request);

                    BroadcastReceiver receiver = new BroadcastReceiver() {
                        @Override
                        public void onReceive(Context context, Intent intent) {
                            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                            if (id == downloadId) {
                                try {
                                    unregisterReceiver(this);
                                } catch (Exception ignored) {}
                                promptInstallApk(destinationFile);
                            }
                        }
                    };

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        registerReceiver(receiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
                    } else {
                        registerReceiver(receiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
                    }
                } else {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(fullUrl));
                    startActivity(browserIntent);
                }
            } catch (Exception e) {
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl));
                    startActivity(browserIntent);
                } catch (Exception ex) {
                    Toast.makeText(this, "İndirme hatası: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private void promptInstallApk(File apkFile) {
        if (!apkFile.exists()) return;
        try {
            Uri contentUri = FileProvider.getUriForFile(
                    this,
                    getApplicationContext().getPackageName() + ".fileprovider",
                    apkFile
            );

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(installIntent);
        } catch (Exception e) {
            Toast.makeText(this, "Yükleyici açılamadı: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onDestroy() {
        try {
            CookieManager.getInstance().flush();
        } catch (Exception ignored) {}
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
