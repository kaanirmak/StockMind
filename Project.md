# StockMind — Akıllı Borsa, TEFAS Fon & Portföy Takip Platformu (v2.2.0)

## Proje Özeti

StockMind; BIST, ABD borsaları (NASDAQ/NYSE/AMEX), emtialar ve TEFAS yatırım fonlarını tek bir platformda toplayan, **FIFO tabanlı portföy muhasebesi**, **GVK uyumlu yıllık vergi raporlaması**, **kâr bazlı referans karşılaştırma**, **Quant Lab analizleri** ve **AI destekli asistan** sunan çoklu platform (Web + Cloudflare Workers + Android Native WebView) finans uygulamasıdır.

---

## Teknoloji Yığını

| Katman | Teknoloji | Sürüm / Detay |
|---|---|---|
| **Frontend Framework** | Next.js (App Router + Webpack) | `16.4.6` |
| **UI & State** | React / Zustand / Tailwind CSS | `19.3.1` / `^5.0.15` / `v4` |
| **Dil** | TypeScript | `^5` (`tsc --noEmit`: 0 hata) |
| **Backend & DB** | Supabase (PostgreSQL + Auth + RLS) | 22 SQL Migration (`supabase/migrations/`) |
| **Hosting & Cron** | Cloudflare Workers (`@opennextjs/cloudflare`) | `wrangler.jsonc` (Cron Triggers bağlı) |
| **Mobil (Android)** | Native Android WebView + WorkManager + Bridge | `versionCode 22`, `v2.2.0` |
| **Grafik Motoru** | TradingView Lightweight Charts + Monotone Cubic SVG | `src/lib/portfolio/svgChartMath.ts` |
| **Piyasa Verileri** | Yahoo Finance + TEFAS Resmi Servisleri | Kesinti korumalı canlı gözlem metadata'sı |
| **AI Motoru** | OpenRouter (Çoklu Model Katalog + Atomik Kota) | Sunucu fiyat doğrulamalı bağlam |

---

## Desteklenen Piyasalar ve Varlık Sınıfları

- **BIST (Borsa İstanbul):** Hisse senetleri, BIST 100 (`XU100`) ve ETF/BYF enstrümanları
- **ABD Borsaları:** NASDAQ, NYSE, AMEX hisse ve ETF'leri (otomatik USD/TRY kur ayrıştırması)
- **TEFAS Fonları:** Tüm TEFAS yatırım ve emeklilik fonları, karşılaştırma matrisi ve benzer fon önerileri
- **Emtia & Döviz:** Gram Altın (`XAUTRYG`), Ons Altın (`GC=F`), Gümüş, USD/TRY, EUR/TRY ve mevduat faizi (`%48` TL) referansı

---

## Çekirdek Mimari & Öne Çıkan Özellikler (v2.2.0)

### 1. Finansal Doğruluk, FIFO & GVK Vergi Motoru
- **FIFO Lot Eritme (`src/lib/portfolio/calculations.ts`):** Kısmi satışlarda en eski alış lotunu baz alarak gerçekleşen kârı hesaplar; aynı gün içi işlemleri deterministik sırada (`Split -> Buy -> Dividend -> Sell -> Fee`) işler.
- **Kur & Varlık Kârı Ayrıştırması (`FIN-04`):** Yabancı hisse kazancını döviz kuru katkısı (`fxPnL`) ve varlık fiyat katkısı (`assetPnL`) olarak ayırır.
- **Eksik Kur/Fiyat Koruması:** Canlı kur veya fiyat yokken keyfi sayı üretmez; `HoldingsTable` ve `PartialValuationBanner` üzerinde `Kur eksik` / `Fiyat eksik` rozetleriyle şeffaf bilgi verir.
- **GVK Yıllık Vergi Raporu (`src/lib/portfolio/taxReport.ts`, `src/components/portfolio/TaxReportCard.tsx`):** BIST Geçici 67 (%0 stopaj), yabancı hisse değer artış kazancı (zarar mahsuplu net matrah), yabancı temettü stopaj mahsubu ve `/reports` ekranından UTF-8 BOM CSV dışa aktarma.

### 2. Kâr Bazlı Karşılaştırma & Modern SVG Grafikler
- **Alternatif Yatırım & Nakit Akışı Simülasyonu (`src/lib/portfolio/netInvestedTimeline.ts`):** Aynı para giriş ve çıkışlarıyla paranız **BIST 100 (`XU100`)**, **Gram Altın (`XAUTRYG`)**, **Mevduat Faizi (`%48` bileşik TL)** veya **Dolar (`USDTRY`)** tarafında olsaydı oluşacak **Net Kâr (₺ / %)** ve toplam değeri hesaplar (`NetInvestedChartCard`).
- **Kayıtlı Alış/Satış Fiyatı Desteği (`resolvePriceWithTxFallback`):** Piyasa mumu hiç bulunmayan veya halka arz öncesi dönemdeki varlıklarda (`ARFYE`, `Z30KP`, `APLIB` vb.) kayıtlı alış/satış fiyatları ve TEFAS yedek sorgusu ile tarihçe kapsamı **%100** seviyesine taşınır.
- **Kâr Bazlı Referans Endeks Grafiği (`BenchmarkComparisonCard.tsx`):** Anapara eklemelerinden arındırılmış `Net Kâr / Yatırılan Anapara` oranını BIST 100, S&P 500, Nasdaq, Altın, Mevduat Faizi (%48) ve USD/TRY ile `TRY` veya `USD` bazında karşılaştırır.
- **Pürüzsüz Monotone Cubic SVG Motoru (`src/lib/portfolio/svgChartMath.ts`):** Portföy, Referans Endeks, TEFAS Fon Detay (`funds/[code]`) ve Fon Karşılaştırma (`funds/compare`) grafiklerinde esnemeyen `viewBox`, `vectorEffect="non-scaling-stroke"`, gradyan dolgu ve etkileşimli imleç (crosshair) sağlar.

### 3. Aracı Kurum Ekstresi & Midas Senkronizasyonu
- **CSV / XLSX İçe Aktarma (`ExcelImportModal.tsx`, `src/lib/portfolio/excelParser.ts`):** Midas, İş Bankası ve Garanti ekstrelerini otomatik eşler; `[broker-sync:midas:<fingerprint>]` etiketlemesi ile yinelenen satırları idempotent olarak eler.
- **Atomik Değişim:** Tümünü değiştir modunda eski verileri yalnızca yeni kayıtlar doğrulandıktan sonra siler.

### 4. AI Asistan, Quant Lab & Teknik Alarmlar
- **Sunucu Doğrulamalı AI Sohbet (`/api/ai/chat`):** İstemci fiyatlarına güvenmez, canlı sunucu fiyatlarıyla bağlam kurar; PostgreSQL tabanlı atomik kota (`006_api_quotas.sql`) ve hata anında kredi iadesi uygular.
- **Quant Lab (`src/components/quant/`):** Değer/Büyüme/Risk analistlerinden oluşan Yatırım Komitesi, Piotroski F-Score / Altman Z-Score / DuPont Finansal Sağlık analizi ve portföy stres testi.
- **Teknik Gösterge & Fiyat Alarmları (`PriceAlertModal.tsx`):** Hedef fiyat yanında RSI(14) `< 30` / `> 70` ve SMA(20)/SMA(50) Golden & Death Cross alarmları; Cloudflare Cron (`/api/cron/evaluate-alerts`) ve Android arka plan WorkManager değerlendirmesi.
- **İdempotent Günlük Bülten (`/api/cron/daily-report`):** Gmail / SMTP doğrulamalı gönderim, kalıcı e-posta kuyruğu (`runDailyBulletin.ts`) ile yeniden denemelerde çift gönderimi önleme.

### 5. Güvenlik, UX Yenilikleri & Mobil Yayın (Android APK)
- **Proxy / Middleware Koruması (`src/proxy.ts`, `src/lib/supabase/proxy.ts`):** 8 KB üzeri Auth cookie şişmesini temizler; yetkisiz `/admin` isteklerini 404 ile maskeler; `CRON_SECRET` için yalnızca `Authorization: Bearer` başlığını kabul eder.
- **Dashboard, Piyasalar & Portföy UX (v2.2.0):** Ana sayfada varsayılan açık portföy ısı haritası, otomatik kaydırmalı *Piyasa Nabzı* karuseli (`MarketOverview`), borsa bazlı *En Çok Değişenler* (`TopMovers`), Piyasalar ekranında `ALL` varsayılan kompakt seçici ve `IntersectionObserver` tabanlı otomatik infinite scroll, Portföy ekranında tek satır seçici + işlem modalı içi Excel içe aktarma ve bağımsız `/activity` takvim rotası (mobil *Diğer* çekmecesi + yan menü bağlantılı).
- **Android Uygulama (`android/`, `src/lib/app/releaseMetadata.ts`):** HTTPS-only TrustedUrls politikası, güncelleme erteleme destekli `AppUpdateNotifier`, `StockMind.apk` (`v2.2.0`, `versionCode 22`) SHA-256 doğrulamalı `/api/download/apk` dağıtımı ve premium `<progress>` yüklenme ekranı (`BrainLogoLoader.tsx`).

---

## Temel Klasör Yapısı

```text
StockMind/
├── android/                        # Native Android WebView + WorkManager + Widget projesi
├── docs/                           # Son teslim ve Go-Live master dokümanları
├── public/StockMind.apk            # Derlenen Android kurulum paketi
├── scripts/                        # Linter bütçesi, TEFAS sync ve yük testi scriptleri
├── supabase/migrations/            # 22 adet PostgreSQL şema, RLS ve kota migration'ı
├── tests/                          # 303 birim, güvenlik, kesinti, AI eval ve portföy testi
└── src/
    ├── app/
    │   ├── (dashboard)/            # dashboard, portfolio, activity, piyasalar, funds, reports, quant-lab, alerts, settings
    │   ├── admin/                  # AAL2 doğrulamalı yönetim konsolu
    │   └── api/                    # stocks, funds, ai, quant, cron, admin, notifications, app/version
    ├── components/
    │   ├── portfolio/              # NetInvestedChartCard, BenchmarkComparisonCard, TaxReportCard, HoldingsTable
    │   ├── quant/                  # InvestmentCommitteeTab, FinancialHealthTab, StressTestTab
    │   └── ui/                     # BrainLogoLoader, AppUpdateNotifier, Modal, Badge
    └── lib/
        ├── portfolio/              # calculations.ts, taxReport.ts, netInvestedTimeline.ts, benchmarkComparison.ts, svgChartMath.ts
        ├── market/                 # priceObservation.ts, alertRules.ts, fundComparison.ts
        ├── email/                  # runDailyBulletin.ts, service.ts
        └── supabase/               # proxy.ts, admin.ts, server.ts, client.ts
```

---

## Doğrulama & Kalite Kapıları

- **Tip Denetimi:** `npm run typecheck` (`tsc --noEmit` — 0 hata)
- **Bağımlılık Güvenliği:** `npm audit --omit=dev` (0 zafiyet — Next.js `16.4.6`)
- **Linter Bütçesi:** `npm run lint:budget` (`0` hata, `443/455` uyarı limiti içinde)
- **Test Paketi:** `npm test` (6 test paketi: `security`, `portfolio`, `interaction`, `outage`, `criticalFlows`, `aiEval` — **303 / 303** başarılı)
- **Yük Testi:** `npm run perf:api-load` (`%0.00` hata oranı)
- **Üretim Derlemesi:** `npm run build:next` (42/42 sayfa) ve `npm run build:apk` (`v2.2.0`)
