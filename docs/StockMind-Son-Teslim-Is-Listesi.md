# StockMind — Büyük Son Teslim İş Listesi & Üretime Geçiş (Go-Live) Master Planı

Bu belge; StockMind’ın kod tabanı, güvenlik mimarisi, finansal hesaplama motoru, veri sağlayıcıları, yapay zekâ asistanı, Android mobil uygulaması ve Cloudflare Workers dağıtım mimarisi baştan aşağı taranarak hazırlanmış **nihai teslim ve canlıya geçiş kontrol listesidir**.

Tarih: 12 Kasım 2026  
Sürüm: v2.0.0 (Release Candidate)  
Yazar: Antigravity AI & StockMind Engineering Team  

---

## 1. Yönetici Özeti & Kalite Metrikleri

* **Birim / Entegrasyon Testleri:** `303 / 303 Başarılı` (`npm test`) — Sıfır hata, sıfır atlanan test.
* **TypeScript Tip Denetimi:** `0 Hata` (`npm run typecheck` / `tsc --noEmit`).
* **Linter Bütçesi:** `447 / 455 Uyarı` (`npm run lint:budget`) — Sıfır hata, belirlenen sıkı uyarı bütçesi dahilinde.
* **Mobil Uygulama (Android):** `versionCode 20`, `versionName "2.0.0"`. İmzalı Release APK/AAB derleme zinciri hazır; `public/StockMind.apk` güncel.
* **Güvenlik Mimarisi:** Oturum cookie bloat koruması, yetkisiz `/admin` rotasını 404 ile maskeleme, header-based `CRON_SECRET` zorunluluğu, SQL RLS testleri ve HTML sanitization aktif.
* **Finansal Motor:** FIFO lot eritme, FIN-04 kur/varlık kârı ayrıştırması, GVK uyumlu yıllık vergi raporu, CSV dışa aktarımı ve eksik kur/fiyat koruması aktif.

---

## 2. On Temel Sütunda Master İş Listesi

| Durum İşaretleri | Anlamı |
| :---: | :--- |
| ✅ | **Tamamlandı & Yerelde Doğrulandı** (Kod yazıldı, testleri geçti, commitleşip pushlandı) |
| ⏳ | **Canlı Ortam Doğrulaması Bekleniyor** (Canlı domain, DNS veya canlı API anahtarı gerektirir) |
| 📋 | **İsteğe Bağlı / Gelecek Sürüm Geliştirmesi** (v2.1+ yol haritası) |

---

### SÜTUN 1: Güvenlik, Kimlik Doğrulama & Yetkilendirme (Security & Access)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **SEC-01** | **P0** | `src/proxy.ts`, `src/lib/supabase/proxy.ts` | **Cookie Bloat Koruması:** Supabase JWT cookie'leri 8 KB'ı aştığında 494/431 reverse proxy hatalarını önlemek için auth cookie'leri kontrollü temizlenmeli. | ✅ |
| **SEC-02** | **P0** | `src/lib/supabase/proxy.ts` | **Admin Rotası Maskeleme:** Yetkisiz veya oturum açmamış ziyaretçilere `/admin` rotası giriş sayfasına yönlendirilmek yerine 404 Not Found ile tamamen maskelenmeli. | ✅ |
| **SEC-03** | **P0** | `src/app/api/cron/**`, `src/app/api/admin/**` | **Header-Based CRON_SECRET:** URL query parametresiyle secret aktarımı engellenmeli; cron görevleri yalnızca `Authorization: Bearer <CRON_SECRET>` başlığıyla tetiklenmeli. | ✅ |
| **SEC-04** | **P0** | `src/lib/supabase/admin.ts` | **Admin Client Fail-Closed:** Sunucu tarafında `SUPABASE_SERVICE_ROLE_KEY` veya `SUPABASE_SECRET_KEY` tanımlı değilse yetkisiz işlem engellenmeli; anon anahtara asla düşmemeli. | ✅ |
| **SEC-05** | **P0** | `tests/database-security.sql`, Supabase RLS | **Çoklu Kullanıcı RLS İzolasyonu:** `transactions`, `portfolios`, `cash_movements` tablolarında kullanıcıların birbirinin verisini okuma/değiştirme yetkisi SQL düzeyinde sıfır olmalı. | ✅ |
| **SEC-06** | **P1** | `src/lib/utils/htmlSanitizer.ts` | **XSS & HTML Injection Koruması:** E-posta şablonları, portföy açıklamaları ve kullanıcı notları `escapeHtml` süzgecinden geçirilmeli. | ✅ |
| **SEC-07** | **P1** | `.env.production`, Cloudflare Secrets | **Ortam Değişkenleri Güvenliği:** Canlı ortamda hiçbir test/placeholder anahtarı kalmamalı; gizli anahtarlar Cloudflare Workers secrets paneline girilmeli. | ⏳ |

---

### SÜTUN 2: Finansal Doğruluk, FIFO & Vergi Motoru (Financial Engine)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **FIN-01** | **P0** | `src/lib/portfolio/calculations.ts` | **FIFO Lot Eritme & Gerçekleşen Kâr:** Kısmi satışlarda en eski alım lotu baz alınarak gerçekleşen kâr hesaplanmalı; kalan lotların özgün maliyet bazı ve kuru korunmalı. | ✅ |
| **FIN-02** | **P0** | `src/lib/portfolio/calculations.ts` | **Kur ve Varlık Kârı Ayrıştırması (FIN-04):** Yabancı hisselerde kazanç; döviz kurundaki artış (`fxPnL`) ve hisse fiyatındaki artış (`assetPnL`) olarak kuruşu kuruşuna ayrıştırılmalı. | ✅ |
| **FIN-03** | **P0** | `src/lib/portfolio/calculations.ts` | **Deterministik İşlem Sıralaması:** Aynı gün içinde girilen işlemler `Split (1) -> Buy (2) -> Dividend (3) -> Sell (4) -> Fee (5)` sırasıyla işlenmeli. | ✅ |
| **FIN-04** | **P0** | `src/lib/portfolio/taxReport.ts`, `src/components/portfolio/TaxReportCard.tsx` | **GVK Uyumlu Yıllık Vergi Raporu:** BIST için Geçici 67 (%0 stopaj, beyan dışı), ABD hisseleri için Değer Artış Kazancı (yıllık yabancı zarar mahsubu ile net matrah) ve yabancı temettü stopaj mahsubu hesaplanıp `/reports` ekranında sunulmalı. | ✅ |
| **FIN-05** | **P1** | `src/lib/portfolio/taxReport.ts`, `src/app/(dashboard)/reports/page.tsx` | **Vergi Raporu CSV Dışa Aktarımı:** Muhasebe ve mali müşavir incelemesine uygun noktalı virgüllü UTF-8 BOM CSV formatında matrah ve işlem dökümü `/reports` üzerinden indirilebilmeli. | ✅ |
| **FIN-06** | **P1** | `src/components/portfolio/PartialValuationBanner.tsx` | **Kısmi Değerleme & Eksik Kur Koruması:** Canlı USD/TRY kuru bulunamazsa asla keyfi kur (38.5 / 1.0) uydurulmamalı; `missingFx` rozeti ve banner'ı gösterilmeli. | ✅ |
| **FIN-07** | **P1** | `src/components/portfolio/HoldingsTable.tsx` | **Pozisyon Bazında Kur/Fiyat Uyarısı:** Portföy tablosunda fiyatı eksik veya canlı kuru bulunamayan yabancı varlıklar için `Fiyat eksik` ve `Kur eksik` rozetleri gösterilmeli. | ✅ |
| **FIN-08** | **P1** | `src/lib/portfolio/dailyAttribution.ts` | **Günlük Varlık Katkısı (Attribution):** Gün içi nakit girişleri kâr sayılmamalı; portföyün günlük toplam getirisine her hissenin net TL ve % katkısı ayrıştırılmalı. | ✅ |

---

### SÜTUN 3: Piyasa Verisi, Canlı Akışlar & Kesinti Dayanıklılığı (Market Data)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **DAT-01** | **P0** | `src/lib/data/stocks.ts`, `src/lib/api/tefas.ts` | **Harici Sağlayıcı Kesinti Koruması:** Veri sağlayıcı kapandığında sistem çökmeyip `503 Service Unavailable` dönmeli; sentetik uydurma veri üretilmemeli. | ✅ |
| **DAT-02** | **P0** | `src/lib/market/priceObservation.ts` | **Fiyat Tazeliği & Gözlem Metadata'sı:** Canlı fiyatta `source`, `asOf`, `fetchedAt` ve `status` (`live`, `stale`, `missing`) alanları eksiksiz taşınmalı. | ✅ |
| **DAT-03** | **P1** | `scripts/sync-tefas-funds.mjs` | **TEFAS Partili Eşitleme (Batch Sync):** 1.000+ fon küçük partiler halinde taranmalı; işlem kesilirse kaldığı yerden devam edebilmeli. | ✅ |
| **DAT-04** | **P1** | `src/lib/market/symbolQuery.ts` | **İstek Birleştirme (Deduplication):** Aynı sembol için gelen eşzamanlı istekler tek bir sağlayıcı çağrısına birleştirilmeli; başarısız istekler önbelleğe alınmamalı. | ✅ |
| **DAT-05** | **P1** | `src/components/markets/AllMarketsOverviewTab.tsx` | **Modüler Piyasa Sekmeleri:** Piyasalar ana sayfası dev tek parça dosya yerine bağımsız alt bileşenlerle çalışmalı. | ✅ |

---

### SÜTUN 4: Alarmlar, E-posta & Zamanlanmış Görevler (Cron & Alerts)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **ALR-01** | **P0** | `wrangler.jsonc` | **Cloudflare Cron Triggers:** Günlük bülten (`0 17 * * 1-5`) ve seans içi fiyat alarm değerlendirmesi (`*/15 7-17 * * 1-5`) Cloudflare işçisine bağlanmalı. | ✅ |
| **ALR-02** | **P0** | `src/lib/email/runDailyBulletin.ts` | **İdempotent E-posta Kuyruğu:** Aynı gün için iki çalışan başlatılsa veya job kesilip yeniden başlasa bile kullanıcıya mükerrer e-posta gitmemeli. | ✅ |
| **ALR-03** | **P1** | `src/components/stocks/PriceAlertModal.tsx` | **Teknik Gösterge Alarmları Arayüzü:** RSI(14) < 30 / > 70 ve SMA(20)/SMA(50) Golden & Death Cross alarmları modal üzerinden kurulup izlenebilmeli. | ✅ |
| **ALR-04** | **P1** | `src/lib/market/serverAlertEvaluator.ts` | **Tazelik Filtresiyle Alarm Değerlendirme:** Eski (stale) veya teyitsiz fiyatta alarm tetiklenmemeli; bekleme süresi (cooldown) ve histerezis bandı çalışmalı. | ✅ |
| **ALR-05** | **P1** | `src/lib/notifications/pushNotification.ts` | **Web Push & Mobil Bildirim:** Kullanıcı izin verdiğinde fiyat hedefine veya gösterge eşiğine ulaşıldığında anlık sesli bildirim gönderilmeli. | ✅ |

---

### SÜTUN 5: Aracı Kurum Ekstreleri & Veri İçe/Dışa Aktarımı (Broker & Excel)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **BRK-01** | **P0** | `src/components/portfolio/ExcelImportModal.tsx` | **Midas & Banka Ekstre Entegrasyonu:** Midas, İş Bankası, Garanti CSV/XLSX ekstreleri otomatik tanınmalı ve sütun eşlemesi yapılmalı. | ✅ |
| **BRK-02** | **P0** | `src/lib/portfolio/brokerSyncPrototype.ts` | **İdempotent Deduplication Tagging:** Midas ekstreleri içe aktarılırken `[broker-sync:midas:FINGERPRINT]` etiketiyle kaydedilerek mükerrer alımlar elenmeli. | ✅ |
| **BRK-03** | **P1** | `src/lib/portfolio/excelParser.ts` | **Atomik Portföy Değişimi:** "Tümünü Değiştir" seçildiğinde eski kayıtlar ancak yeni kayıtlar başarıyla yazıldıktan sonra silinmeli (veri kaybı önleme). | ✅ |
| **BRK-04** | **P1** | `src/lib/portfolio/reportExport.ts` | **Portföy Rapor Dışa Aktarımı:** CSV ve formatlanmış özet tablosu seçili dönem ve para birimiyle dışa aktarılabilmeli. | ✅ |

---

### SÜTUN 6: Yapay Zeka (AI) & Quant Analiz Motoru (AI & Quant)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **AIP-01** | **P0** | `src/app/api/ai/chat/route.ts` | **Sunucu Tarafı Fiyat Doğrulaması:** İstemcinin gönderdiği fiyat bilgisine güvenilmemeli; hisse fiyatı sunucuda doğrulanıp AI context'ine eklenmeli. | ✅ |
| **AIP-02** | **P0** | `src/lib/ai/quota.ts`, `006_api_quotas.sql` | **Kalıcı Atomik Kota:** Kullanıcı saatlik soru sınırları veritabanında atomik olarak sayılmalı; sağlayıcı hatasında kredi iade edilmeli. | ✅ |
| **AIP-03** | **P0** | `tests/aiEval.test.cjs` | **Finansal Tavsiye Sınırı & Halüsinasyon Filtresi:** Belirsiz haberlerde kesin "AL/SAT" tavsiyesi verilmemeli; eksik veride açıkça veri yokluğu belirtilmeli. | ✅ |
| **AIP-04** | **P1** | `src/app/api/quant/committee/route.ts` | **Yatırım Komitesi Simülasyonu:** Değer, Büyüme ve Risk analistleri yapılandırılmış JSON çıktısıyla bağımsız değerlendirme yapmalı. | ✅ |

---

### SÜTUN 7: Mobil Uygulama & Android Yayın Süreci (Android App)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **MOB-01** | **P0** | `android/app/build.gradle` | **Sürüm Bütünlüğü:** `versionCode 20` ve `versionName "2.0.0"`, `package.json` ve `/api/app/version` ile birebir eşleşmeli. | ✅ |
| **MOB-02** | **P0** | `android/app/src/main/AndroidManifest.xml` | **WebView Güvenliği:** `cleartextTraffic: false` (HTTPS zorunlu), harici URL filtreleme ve güvenli kaynak politikası uygulanmalı. | ✅ |
| **MOB-03** | **P0** | `package.json` (`build:apk:release`) | **Release Keystore İmzalaması:** Production için `KEYSTORE_PATH` ve şifre değişkenleri ayarlandığında `assembleRelease` ile imzalı APK/AAB üretilmeli. | ⏳ |
| **MOB-04** | **P1** | `src/app/api/download/apk/route.ts` | **APK İndirme & Sağlama Toplamı:** APK indirme endpoint'i SHA-256 sağlama toplamı ve arşiv başlıklarıyla dağıtım yapmalı. | ✅ |
| **MOB-05** | **P1** | `src/components/ui/ApkDownloadModal.tsx` | **Cihaz Filtresi:** APK indirme modalı yalnızca Android tarayıcılarda açılmalı; iOS veya masaüstünde gösterilmemeli. | ✅ |

---

### SÜTUN 8: Kullanıcı Deneyimi, UI/UX & Erişilebilirlik (UI & A11y)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **UX-01** | **P1** | `src/lib/theme/contrast.ts` | **WCAG Kontrast Uyumu:** Açık ve koyu temalarda tüm metin, kart ve grafik etiketleri en az 4.5:1 kontrast oranını sağlamalı. | ✅ |
| **UX-02** | **P1** | `src/components/ui/Modal.tsx` | **Focus Trap & Scroll Lock:** Açılan modallar arka plan kaydırmasını kilitlemeli, ESC tuşu ile kapanmalı ve odak ilk alana çekilmeli. | ✅ |
| **UX-03** | **P1** | `src/components/portfolio/EmptyPortfolioOnboarding.tsx` | **Boş Durum (Empty State) Başlangıcı:** Portföyü boş kullanıcıya tek ekranda "İlk İşlemi Gir", "Ekstre Yükle" ve "Örnek Portföyü Gör" seçenekleri sunulmalı. | ✅ |
| **UX-04** | **P1** | `src/components/layout/Sidebar.tsx`, `Header.tsx` | **Erişilebilir Etiketler:** Tüm arama girişleri ve simge düğmeleri ekran okuyucular için açık `aria-label` taşımalı. | ✅ |

---

### SÜTUN 9: Canlı Dağıtım, Cloudflare & Alan Adı (DevOps & Hosting)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **OPS-01** | **P0** | `wrangler.jsonc`, `open-next.config.ts` | **Cloudflare Workers / OpenNext Yapılandırması:** Next.js 16 Webpack derlemesi OpenNext adapter üzerinden hatasız paketlenmeli. | ✅ |
| **OPS-02** | **P0** | Cloudflare DNS / SSL | **Özel Alan Adı & SSL Aktivasyonu:** `stockmind.kaanrmak.com` (veya belirlenen alan adı) Cloudflare proxied DNS ve Full (Strict) SSL ile bağlanmalı. | ⏳ |
| **OPS-03** | **P0** | Supabase Production Dashboard | **Canlı DB Migration Senkronizasyonu:** `supabase/migrations/` altındaki 24 adet migration dosyasının canlı veritabanında eksiksiz çalıştığı doğrulanmalı. | ⏳ |
| **OPS-04** | **P1** | `scripts/check-lint-warnings.mjs` | **Linter Bütçe Kapısı (CI Gate):** Pull request ve build öncesi linter uyarı bütçesi aşılmamalı (şu an 447 / limit 455). | ✅ |

---

### SÜTUN 10: Canlıya Çıkış Doğrulama & Geri Alma (Go-Live & Rollback)

| ID | Öncelik | Alan & Dosyalar | Görev ve Kabul Kriteri | Durum |
| :--- | :---: | :--- | :--- | :---: |
| **VER-01** | **P0** | `npm run test:pre-release` | **Otomatik Ön Sürüm Testi:** `tsc --noEmit` ve tüm 303 birim testin canlı dağıtım öncesi tek komutla geçmesi. | ✅ |
| **VER-02** | **P0** | `tests/criticalFlows.test.cjs` | **Kritik Akış (Smoke) Testi:** Misafir başlangıç, işlem kaydı, Excel aktarımı, alarm tetikleme ve bülten üretiminin canlı simülasyonu. | ✅ |
| **VER-03** | **P0** | Rollback Stratejisi | **Sürüm Geri Alma (Instant Rollback):** Cloudflare Workers paneli üzerinden tek tıkla önceki deployment sürümüne dönülebilmeli. | ✅ |

---

## 3. Adım Adım Canlıya Dağıtım (Go-Live Runbook)

### Aşama 1: Yerel Doğrulama & Derleme
```bash
# 1. Tip denetimi ve test paketi
npm run test:pre-release

# 2. Linter bütçesi kontrolü
npm run lint:budget

# 3. Yük testi simülasyonu
npm run perf:api-load

# 4. Production Next.js derlemesi
npm run build:next
```

> **Yerel Doğrulama Durumu (Tamamlandı ✅):** `typecheck` (0 hata), `lint:budget` (`447/455` uyarı, `0` hata), `npm test` (303/303 test geçti), `perf:api-load` (%0 hata oranı) ve `build:next` (41/41 sayfa derlendi) başarıyla doğrulandı.

### Aşama 2: Veritabanı Hazırlığı (Supabase)
1. Supabase Dashboard -> **SQL Editor** üzerinden `supabase/migrations/` altındaki migration dosyalarının sırayla uygulandığını teyit edin.
2. Supabase Dashboard -> **Authentication** -> **URL Configuration**:
   * `Site URL`: `https://stockmind.kaanrmak.com` (veya `https://stockmind.kaanrmak7.workers.dev`)
   * `Redirect URLs`: `https://stockmind.kaanrmak.com/**`

### Aşama 3: Cloudflare Workers Dağıtımı
```bash
# Cloudflare Workers ortamına derleme ve canlı dağıtım
npm run deploy:cloudflare
```
Cloudflare Dashboard -> Workers & Pages -> `stockmind` -> **Settings** -> **Variables and Secrets**:
* `CRON_SECRET` = (Güçlü rastgele parola)
* `SUPABASE_SERVICE_ROLE_KEY` = (Supabase service role secret)
* `OPENROUTER_API_KEY` = (Canlı AI API anahtarı)
* `SMTP_PASS` = (Gmail uygulama şifresi)
* `ADMIN_EMAIL` = `kaanrmak7@gmail.com`

### Aşama 4: Canlı Smoke Testleri
1. [ ] Canlı siteye masaüstü ve mobilden erişim (`https://...`).
2. [ ] Yeni kullanıcı kaydı ve e-posta doğrulama akışı.
3. [ ] BIST hissesi (örn. THYAO) ve ABD hissesi (örn. AAPL) alım işlemi kaydı.
4. [ ] Portföy özetinde TL maliyet, canlı kâr ve kur ayrıştırması (`fxPnL` vs `assetPnL`) kontrolü.
5. [ ] Vergi raporu sekmesinden yıllık matrah hesaplaması ve CSV dışa aktarımı.
6. [ ] Fiyat alarmı ve RSI gösterge alarmı kurulumu.
7. [ ] Android cihaz üzerinden `StockMind.apk` indirilmesi ve giriş yapılması.

