<div align="center">

<img src="public/logo-white.png" alt="StockMind Logo" width="300" />

# StockMind

### Yeni Nesil Akıllı Borsa, Fon & Portföy Analiz Terminali
**BIST · NYSE · NASDAQ · TEFAS · Emtia · Döviz · Kripto**

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg?style=for-the-badge&logo=semver&logoColor=white)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.3-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-06b6d4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20RLS-3fcf8e?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Tests](https://img.shields.io/badge/Tests-137%20Passed-brightgreen?style=for-the-badge&logo=checkmarx&logoColor=white)](tests/)
[![Android](https://img.shields.io/badge/Android-APK_v1.5-3DDC84?style=for-the-badge&logo=android&logoColor=white)](public/StockMind.apk)
[![License](https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge)](LICENSE)

<br />

[🌐 Canlı Demo](https://stockmind.kaanrmak7.workers.dev/) · [📱 Android APK İndir](https://stockmind.kaanrmak7.workers.dev/apk) · [✨ Özellikler](#-temel-özellikler) · [🚀 Hızlı Başlangıç](#-hızlı-başlangıç) · [📊 API Referansı](#-başlıca-api-endpointleri) · [🧩 Widgetlar](#-gömülebilir-finansal-widgetlar)

</div>

---

## 📌 İçindekiler (Table of Contents)

- [🌟 Genel Bakış](#-genel-bakış)
- [✨ Temel Özellikler](#-temel-özellikler)
  - [📊 Çoklu Piyasa & Varlık Kapsamı](#-çoklu-piyasa--varlık-kapsamı)
  - [💼 Profesyonel FIFO Portföy Yönetimi](#-profesyonel-fifo-portföy-yönetimi)
  - [📈 TradingView Grafikleri & Teknik İndikatörler](#-tradingview-grafikleri--teknik-i̇ndikatörler)
  - [🧪 Quant Lab (Kantitatif Finans)](#-quant-lab-kantitatif-finans)
  - [🤖 Çoklu LLM Destekli AI Finans Danışmanı](#-çoklu-llm-destekli-ai-finans-danışmanı)
  - [🧩 Gömülebilir Finansal Widget'lar](#-gömülebilir-finansal-widgetlar)
  - [🛡️ Kurumsal Güvenlik & Biyometrik Giriş](#️-kurumsal-güvenlik--biyometrik-giriş)
- [🛠 Teknoloji Yığını](#-teknoloji-yığını)
- [🚀 Hızlı Başlangıç & Kurulum](#-hızlı-başlangıç--kurulum)
- [🧪 Test ve Kalite Güvencesi](#-test-ve-kalite-güvencesi)
- [☁️ Cloudflare Workers ile Canlıya Alma](#️-cloudflare-workers-ile-canlıya-alma)
- [📱 Android Mobil APK Derleme](#-android-mobil-apk-derleme)
- [📂 Proje Dizin Yapısı](#-proje-dizin-yapısı)
- [🔌 Başlıca API Endpoint'leri](#-başlıca-api-endpointleri)
- [🤝 Katkıda Bulunma](#-katkıda-bulunma)
- [📄 Lisans](#-lisans)

---

## 🌟 Genel Bakış

**StockMind**, bireysel ve profesyonel yatırımcılar için geliştirilmiş, yüksek performanslı ve modern bir **finansal terminal & portföy analiz ekosistemidir**. 

Borsa İstanbul (**BIST**), Amerikan Borsaları (**NASDAQ, NYSE**), 3.000'den fazla **TEFAS Yatırım Fonu**, **Emtialar** (Altın, Gümüş, Petrol, Doğalgaz), **Döviz Pariteleri** ve **Kripto Varlıkları** tek bir çatı altında birleştirir.

Sıradan portföy takip araçlarının aksine StockMind; **FIFO lot tabanlı kesin maliyetleme**, **nakit mutabakatı**, **TradingView grafik motoru**, **DCF Değerleme ve Kriz Stres Testleri** ile **OpenRouter çoklu LLM destekli Sanal Yatırım Komitesi** sunar.

> **💡 İngilizce Özet (Overview in English):**  
> *StockMind is a next-generation AI-powered financial terminal and portfolio analytics platform for BIST, US Equities (NASDAQ/NYSE), TEFAS Mutual Funds, Commodities, and FX. Built with Next.js 16, React 19, Supabase RLS, and Cloudflare Workers edge runtime.*

---

## ✨ Temel Özellikler

<table>
<tr>
<td width="50%" valign="top">

### 📊 Çoklu Piyasa & Varlık Kapsamı
- **BIST 100 & Tüm BIST Hisseleri**: Anlık fiyatlar, derinlikli özetler, sektör filtreleri ve hacim liderleri.
- **ABD Piyasaları (NASDAQ / NYSE)**: Global devler (Apple, Microsoft, Nvidia vb.) ve popüler ETF'ler (QQQ, SPY, VOO).
- **3.000+ TEFAS Yatırım Fonu**: Otomatik senkronize edilen fon kataloğu, takas günleri, kategori dağılımı ve getiri/risk sıralamaları.
- **Kıymetli Madenler & Emtia**: Gram, Çeyrek, Yarım, Cumhuriyet Altını, Gümüş, Brent & WTI Petrol, Doğalgaz ve tarım emtiaları.
- **Döviz & Kripto**: USD/TRY, EUR/TRY, majör pariteler ve lider kripto varlıklar.

### 💼 Profesyonel FIFO Portföy Yönetimi
- **FIFO (First-In, First-Out) Lot Hesaplama**: Her alım emri ayrı bir lot olarak izlenir; kısmi satışlarda en eski lot kapatılarak kesin gerçekleşen/gerçekleşmeyen kâr-zarar bulunur.
- **Çoklu Para Birimli Nakit Hesabı**: Portföy bünyesinde TRY, USD ve EUR nakit bakiyesi, döviz değerlemesi ve para yatırma/çekme hareketleri.
- **Excel & CSV Entegrasyonu**: Midas, İş Bankası, Garanti BBVA, Yapı Kredi ve evrensel CSV/Excel şablonlarıyla tek tıkla toplu işlem içe aktarma.
- **Görsel Dağılım & Isı Haritası**: Varlık türü, sektör ve piyasa bazlı pasta grafikleri ile takvimsel P&L Getiri Isı Haritası.
- **Aracı Kurum Rehberi**: İlgili hisse için tek tıkla Midas veya banka işlem ekranına hızlı geçiş.

### 📈 TradingView Grafikleri & Teknik İndikatörler
- **TradingView Lightweight Charts v5**: Canvas tabanlı, ultra akıcı mum, bar ve çizgi grafikleri.
- **15+ Teknik İndikatör**: RSI, MACD, Bollinger Bantları, SMA, EMA, Stokastik ve hacim osilatörleri.
- **Zaman Dilimleri**: Günlük, haftalık, aylık ve çok yıllık periyotlar arasında anlık geçiş.

</td>
<td width="50%" valign="top">

### 🧪 Quant Lab (Kantitatif Finans)
- **DCF (İndirgenmiş Nakit Akışı) Değerleme**: Gelecek nakit akış projeksiyonları, WACC ve nihai büyüme oranlarıyla hedef adil hisse fiyatı hesaplama.
- **Portföy Stres Testleri**: 2008 Küresel Krizi, COVID-19 Pandemi Şoku, Ani Faiz Artışı ve Stagflasyon senaryolarında portföy direnç simülasyonu.
- **Bilanço Sağlık Puanı**: Piotroski F-Score (0-9 puanlama), kaldıraç ve likidite oranları analizi.
- **Sanal Yatırım Komitesi**: Warren Buffett, Peter Lynch, Jim Simons ve Risk Yöneticisi felsefeleriyle çoklu AI ajanının hisse konsensüs analizi.

### 🤖 Çoklu LLM Destekli AI Finans Danışmanı
- **OpenRouter Sağlayıcı Entegrasyonu**: Claude 3.5 Sonnet, GPT-4o, Gemini 2.0 Flash ve DeepSeek modelleriyle finansal analiz.
- **Portföy Bağlamı (Context-Aware)**: Kullanıcının varlıklarını ve nakit dengesini gözeten kişiselleştirilmiş finansal değerlendirmeler.
- **Dinamik Kota & Güvenlik**: Standart (5 soru/saat) ve Pro (20 soru/saat) kademeli saatlik kota yönetimi.

### 🧩 Gömülebilir Finansal Widget'lar
- **Taşınabilir iFrame Bileşenleri**: StockMind portföy ve piyasa ısı haritası widget'larını herhangi bir web sitesine veya bloga tek satır `<iframe>` ile yerleştirme.

### 🛡️ Kurumsal Güvenlik & Biyometrik Giriş
- **Passkeys / WebAuthn (FIDO2)**: Touch ID, Face ID veya Windows Hello ile parolasız donanım destekli güvenli oturum.
- **PostgreSQL RLS**: Supabase seviyesinde her kullanıcının verisini mutlak biçimde izole eden güvenlik kuralları.
- **Pro Token İmzası**: Kurcalamaya karşı korumalı (tamper-proof) yetki doğrulaması.
- **Fiyat Alarmları & E-Posta Bülteni**: Yüzdesel eşik bildirimleri ve günlük idempotent HTML portföy bülteni.

</td>
</tr>
</table>

---

## 🛠 Teknoloji Yığını

```mermaid
graph LR
    subgraph İstemci (Frontend)
        A[Next.js 16 App Router] --> B[React 19]
        B --> C[Tailwind CSS 4]
        B --> D[Zustand 5]
        B --> E[TradingView Charts v5]
        B --> M[Android WebView APK]
    end
    subgraph Sunucu & Kenar (Edge)
        F[Cloudflare Workers] --> G[Route Handlers]
        G --> H[OpenRouter AI Engine]
        G --> I[Nodemailer SMTP]
    end
    subgraph Veritabanı & Güvenlik
        J[(Supabase PostgreSQL)] --> K[Row Level Security]
        J --> L[WebAuthn Passkeys]
    end
    A --> F
    F --> J
```

| Katman | Teknoloji | Sürüm | Kullanım Alanı |
|---|---|---|---|
| **Framework** | [Next.js](https://nextjs.org) | `16.4.2` | App Router, React Server Components ve Edge optimizasyonu |
| **Kullanıcı Arayüzü** | [React](https://react.dev) | `19.3.1` | Modern reaktif bileşen mimarisi |
| **Stil & Tasarım** | [Tailwind CSS](https://tailwindcss.com) | `4.x` | Modern karanlık cam (glassmorphism) tasarım dili |
| **Veritabanı & Kimlik** | [Supabase](https://supabase.com) | `v2` | PostgreSQL, Row Level Security (RLS) ve WebAuthn biyometrik auth |
| **Kenar Dağıtım** | [Cloudflare Workers](https://workers.cloudflare.com) | `@opennextjs/cloudflare` | Sıfır soğuk başlangıçlı, ultra düşük gecikmeli global sunucusuz dağıtım |
| **Durum Yönetimi** | [Zustand](https://github.com/pmndrs/zustand) | `5.0.x` | Hafif, performanslı ve reaktif istemci durum mağazası |
| **Grafik Motoru** | [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/) | `5.2.1` | Canvas tabanlı akıcı hisse mum ve indikatör grafikleri |
| **Tablo & Excel** | [SheetJS (xlsx)](https://sheetjs.com) | `0.20.3` | Midas, Garanti, İş Bankası, Yapı Kredi ekstre parser motoru |
| **Yapay Zeka** | [OpenRouter](https://openrouter.ai) | REST API | Çoklu LLM (Gemini, Claude, GPT, DeepSeek) finansal danışman |
| **E-Posta Servisi** | [Nodemailer](https://nodemailer.com) | `10.1.7` | Günlük performans raporu ve bülten iletimi |
| **Mobil Taban** | Android WebView | SDK 34 / JBR 21 | Bağımsız Android APK derleme altyapısı |
| **Test & Kalite** | Node.js Test Runner | Node 22+ | 137 adet güvenlik, FIFO ve portföy birim testi |

---

## 🚀 Hızlı Başlangıç & Kurulum

### Ön Gereksinimler

- **Node.js**: `22.x LTS` veya `24.x LTS` (bkz: `.nvmrc`)
- **Paket Yöneticisi**: `npm`, `pnpm` veya `bun`
- [Supabase](https://supabase.com) hesabı (Ücretsiz katman yeterlidir)
- *(Opsiyonel)* [OpenRouter](https://openrouter.ai) API anahtarı (AI asistanı için)

### 1. Depoyu Klonlayın

```bash
git clone https://github.com/kaanirmak/StockMind.git
cd StockMind
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. Çevre Değişkenlerini Yapılandırın

`.env.example` dosyasını baz alarak `.env.local` oluşturun:

```bash
cp .env.example .env.local
```

`.env.local` dosyasını kendi anahtarlarınızla düzenleyin:

```env
# Supabase (Zorunlu)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Asistan (Opsiyonel)
OPENROUTER_API_KEY=your-openrouter-key

# Zamanlanmış Görev Güvenliği
CRON_SECRET=your-cron-secret-token

# E-posta Raporlama Servisi (Opsiyonel)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. TEFAS Fon Verilerini Senkronize Edin *(İsteğe Bağlı)*

```bash
npm run sync:funds
```

### 5. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresine giderek StockMind'ı kullanmaya başlayabilirsiniz.

---

## 🧪 Test ve Kalite Güvencesi

StockMind; finansal hesaplamaların (FIFO maliyetleri, nakit mutabakatı, günlük getiri oranları) ve güvenlik mekanizmalarının doğruluğunu garanti altına almak için **137 adet otomatik test** içerir:

```bash
# Tüm test paketini çalıştırın (137 test)
npm test

# Güvenlik, CSRF, origin ve kota testleri
npm run test:security

# Portföy, FIFO lot ve nakit mutabakat testleri
npm run test:portfolio

# Kullanıcı etkileşim ve fiyat alarmı testleri
npm run test:interaction

# TypeScript statik tip doğrulaması
npm run typecheck

# Kod kalitesi denetimi (ESLint)
npm run lint
```

```
ℹ tests 137
ℹ suites 0
ℹ pass 137
ℹ fail 0
```

---

## ☁️ Cloudflare Workers ile Canlıya Alma

StockMind, `@opennextjs/cloudflare` adaptörü sayesinde Cloudflare Workers üzerinde tam Edge uyumlu olarak çalışır:

```bash
# 1. Cloudflare Workers için optimize derleme yapın
npm run build:cloudflare

# 2. Yerel Cloudflare ortamında test edin
npm run preview:cloudflare

# 3. Canlıya dağıtın
npm run deploy:cloudflare
```

---

## 📱 Android Mobil APK Derleme

StockMind, masaüstü deneyiminin yanı sıra yerel Android cihazlar için optimize edilmiş bir mobil WebView sarmalayıcısına sahiptir.

```bash
# APK çıktısını üretin (public/StockMind.apk ve StockMind.apk)
npm run build:apk
```

> **Gereksinim:** Android Studio (JBR 21) veya OpenJDK 21 ile Android SDK yüklü olmalıdır.  
> Hazır derlenmiş sürümü doğrudan [https://stockmind.kaanrmak7.workers.dev/apk](https://stockmind.kaanrmak7.workers.dev/apk) adresinden veya deponun kök dizinindeki [`StockMind.apk`](StockMind.apk) dosyasından indirebilirsiniz.

---

## 🧩 Gömülebilir Finansal Widget'lar

StockMind'ın interaktif grafiklerini kendi web sitenize, bülteninize veya yatırım blogunuza iFrame ile entegre edebilirsiniz:

### 1. Portföy Özeti Kartı Widget'ı
```html
<iframe 
  src="https://stockmind.kaanrmak7.workers.dev/widgets/portfolio?theme=dark" 
  width="100%" 
  height="380" 
  frameborder="0" 
  style="border-radius: 16px; overflow: hidden;"
  title="StockMind Portfolio Widget">
</iframe>
```

### 2. Piyasa & Varlık Isı Haritası Widget'ı
```html
<iframe 
  src="https://stockmind.kaanrmak7.workers.dev/widgets/heatmap?theme=dark" 
  width="100%" 
  height="450" 
  frameborder="0" 
  style="border-radius: 16px; overflow: hidden;"
  title="StockMind Heatmap Widget">
</iframe>
```

---

## 📂 Proje Dizin Yapısı

```
StockMind/
├── android/                 # Android WebView mobil uygulaması & Gradle yapılandırması
├── docs/                    # Mimari notlar, regresyon ve mobil optimizasyon kılavuzları
├── public/                  # Statik görseller, logo, APK dosyası ve Excel şablonları
├── scripts/                 # TEFAS fon senkronizasyonu vb. bakım betikleri
├── src/
│   ├── app/
│   │   ├── (auth)/          # Giriş, Kayıt, Şifremi Unuttum sayfaları
│   │   ├── (dashboard)/     # Ana platform ekranları
│   │   │   ├── ai-assistant/    # Çoklu LLM finansal sohbet asistanı
│   │   │   ├── dashboard/       # Portföy özeti, piyasa kartları & dağılımlar
│   │   │   ├── funds/           # TEFAS fon kataloğu ve fon detay sayfası
│   │   │   ├── news/            # Canlı finans haber akışı
│   │   │   ├── piyasalar/       # Canlı BIST, ABD, Emtia & Döviz piyasaları
│   │   │   ├── portfolio/       # FIFO lot takibi, işlem geçmişi & Excel aktarımı
│   │   │   ├── quant-lab/       # DCF, Stres Testleri ve Sanal Yatırım Komitesi
│   │   │   ├── reports/         # Performans raporları ve P&L ısı haritası
│   │   │   ├── settings/        # Kullanıcı tercihleri, kota & WebAuthn biyometri
│   │   │   ├── stocks/          # Hisse detay, TradingView grafiği ve alarmlar
│   │   │   ├── watchlist/       # Özelleştirilebilir takip listesi
│   │   │   └── widgets/         # Widget embed kod üretici ve önizleme paneli
│   │   ├── admin/           # Pro onay paneli ve yönetim arayüzü
│   │   ├── apk/ & download/ # Doğrudan Android APK indirme sayfaları
│   │   ├── widgets/         # Dış siteler için izole iFrame widget sayfaları
│   │   └── api/             # Güvenli REST API rotaları
│   │       ├── ai/              # AI sohbet ve kota denetim endpoint'leri
│   │       ├── cron/            # Günlük bülten ve TEFAS senkronizasyon cron'ları
│   │       ├── funds/           # Fon veri sağlayıcı servisi
│   │       ├── markets/         # Emtia, altın, petrol ve döviz kurları
│   │       ├── news/            # Finansal haber akış servisi
│   │       ├── notifications/   # Fiyat alarm bildirim motoru
│   │       ├── pro/             # Pro üyelik doğrulama ve talep rotaları
│   │       ├── quant/           # DCF ve Komite analiz rotaları
│   │       └── stocks/          # Hisse, indikatör ve mum grafik verileri
│   ├── components/          # Modüler UI ve domain bileşenleri
│   │   ├── dashboard/       # Dashboard kartları ve performans ısı haritası
│   │   ├── layout/          # Navbar, Sidebar, Header ve Mobil Navigasyon
│   │   ├── portfolio/       # HoldingsTable, İşlem/Excel Modalları, BrokerDirectory
│   │   ├── pro/             # ProPlanCard ve üyelik kartları
│   │   ├── quant/           # DCF, Stres Testi, Sağlık & Komite modülleri
│   │   ├── stocks/          # TradingView grafik, teknik analiz ve alarmlar
│   │   ├── ui/              # Butonlar, modallar, giriş alanları ve logolar
│   │   └── widgets/         # Widget Embed Modal ve dışa aktarım araçları
│   ├── hooks/               # useAuth, usePortfolioPerformance, useAlerts hook'ları
│   ├── lib/                 # Temel iş mantığı, algoritmalar ve yardımcılar
│   │   ├── ai/              # OpenRouter & Yatırım Komitesi prompt motoru
│   │   ├── data/            # BIST, TEFAS, Emtia ve Broker statik verileri
│   │   ├── portfolio/       # FIFO lot motoru, Excel parser & nakit mutabakatı
│   │   └── supabase/        # Supabase istemci, sunucu ve admin yardımcıları
│   ├── store/               # Zustand mağazaları (usePortfolioStore vb.)
│   └── types/               # TypeScript tip tanımları ve arayüzler
├── tests/                   # 137 adet Güvenlik, Portföy & Etkileşim testi
├── open-next.config.ts      # Cloudflare Workers derleme yapılandırması
├── wrangler.jsonc           # Cloudflare Workers ortam ayarları
└── package.json
```

---

## 🔌 Başlıca API Endpoint'leri

| Metot | Endpoint | Yetki | Açıklama |
|---|---|---|---|
| `GET` | `/api/stocks` | Herkese Açık | BIST ve ABD hisse senetleri listesi |
| `GET` | `/api/stocks/[symbol]` | Herkese Açık | Hisse güncel fiyat ve detay metrikleri |
| `GET` | `/api/stocks/[symbol]/history` | Herkese Açık | Mum grafik ve tarihsel fiyat verileri |
| `GET` | `/api/stocks/[symbol]/indicators` | Herkese Açık | RSI, MACD ve hareketli ortalama indikatörleri |
| `GET` | `/api/funds` | Herkese Açık | TEFAS fon listesi ve kategorik filtreleme |
| `GET` | `/api/funds/[code]` | Herkese Açık | Fon detay, risk değeri ve getiri geçmişi |
| `GET` | `/api/markets` | Herkese Açık | Emtia, altın, petrol ve döviz pariteleri |
| `POST`| `/api/ai/chat` | Kullanıcı | AI Asistan sohbet (OpenRouter & kota denetimli) |
| `POST`| `/api/quant/committee` | Pro Kullanıcı | Sanal AI Yatırım Komitesi analizi |
| `GET` | `/api/news` | Herkese Açık | Anlık finans ve piyasa haber akışı |
| `POST`| `/api/cron/daily-report` | `CRON_SECRET` | Günlük portföy bülteni gönderimi (İdempotent) |
| `POST`| `/api/cron/sync-funds` | `CRON_SECRET` | TEFAS veritabanı periyodik senkronizasyonu |
| `POST`| `/api/pro/request` | Kullanıcı | Pro üyelik talep başvurusu |
| `GET` | `/api/admin/pro-requests` | Admin | Pro başvuru listesi ve onay yönetimi |

---

## 🔒 Güvenlik & Gizlilik İlkeleri

- **Veri İzolasyonu (Row Level Security)**: Veritabanı katmanında etkinleştirilmiş PostgreSQL RLS ile her kullanıcı yalnızca kendi portföyünü, işlemlerini ve ayarlarını görebilir ve değiştirebilir.
- **Biyometrik Kimlik Doğrulama**: FIDO2 / WebAuthn standardıyla Touch ID, Face ID veya Windows Hello ile parolasız giriş.
- **CSRF & Origin Doğrulaması**: Tüm mutasyon API rotalarında kaynak ve başlık doğrulama kontrolleri.
- **Güvenli Arka Plan Görevleri**: Cron endpoint'leri yalnızca gizli `CRON_SECRET` Bearer token ile tetiklenebilir; URL üzerinden sızıntı imkanı engellenmiştir.
- **XSS & HTML İnjeksiyon Koruması**: E-posta şablonları ve kullanıcı girdileri katı şekilde sanitize edilir.

---

## 🤝 Katkıda Bulunma

Projeye katkıda bulunmak isterseniz aşağıdaki adımları izleyebilirsiniz:

1. Projeyi Fork edin (`https://github.com/kaanirmak/StockMind/fork`)
2. Yeni bir özellik dalı açın (`git checkout -b feature/harika-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: harika özellik eklendi'`)
4. Testlerin geçtiğinden emin olun (`npm test && npm run typecheck`)
5. Dalınızı push edin (`git push origin feature/harika-ozellik`)
6. Bir **Pull Request** oluşturun

---

## 📄 Lisans

Bu proje **MIT Lisansı** altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına göz atabilirsiniz.

---

<div align="center">

**StockMind** — Yatırımlarınızı akıllı, rasyonel ve yapay zeka desteğiyle yönetin. 📈

Geliştirici: [Kaan Irmak](https://github.com/kaanirmak) · [Canlı Platform](https://stockmind.kaanrmak7.workers.dev/)

</div>
