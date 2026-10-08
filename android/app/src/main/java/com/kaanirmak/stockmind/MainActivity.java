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
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "StockMindPrefs";
    private static final String KEY_SERVER_URL = "server_url";
    
    // Production server URL and local emulator fallback
    private static final String PRODUCTION_URL = "https://stock-mind-bay.vercel.app";
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
    private long backPressedTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Hide bottom navigation bar (system router) when entering app
        hideBottomNavigation();

        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        currentServerUrl = prefs.getString(KEY_SERVER_URL, getDefaultUrl());

        // Auto-migrate if previously stuck on local development IP or invalid URL
        if (currentServerUrl == null || currentServerUrl.contains("192.168.1.") || currentServerUrl.isEmpty()) {
            currentServerUrl = getDefaultUrl();
            prefs.edit().putString(KEY_SERVER_URL, currentServerUrl).apply();
        }

        initViews();
        setupFileChooser();
        setupWebView();
        setupBackNavigation();

        loadAppUrl();
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
                if (request.isForMainFrame()) {
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

        try {
            CookieManager cm = CookieManager.getInstance();
            String cookies = cm.getCookie(currentServerUrl);
            if (cookies != null && cookies.length() > 4096) {
                // Cookies bloated! Clear BEFORE loading URL
                cm.removeAllCookies(success -> {
                    cm.flush();
                    webView.post(() -> webView.loadUrl(currentServerUrl));
                });
                return;
            }
        } catch (Exception ignored) {}

        webView.loadUrl(currentServerUrl);
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
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
