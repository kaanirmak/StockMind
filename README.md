<div align="center">

<img src="public/logo-white.png" alt="StockMind Logo" width="280" />

### Akıllı Borsa, Fon & Portföy Analiz Platformu

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg?style=flat-square)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20RLS-3fcf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Tests](https://img.shields.io/badge/Tests-137%20Passed-brightgreen?style=flat-square)](tests/)
[![License](https://img.shields.io/badge/License-MIT-a855f7?style=flat-square)](LICENSE)

**BIST · NYSE · NASDAQ · TEFAS · Emtia · Döviz** — Tek platformda, gerçek zamanlı ve yapay zeka destekli.

[Canlı Demo →](https://stockmind.kaanrmak7.workers.dev/) · [Hata Bildir](https://github.com/kaanirmak/StockMind/issues) · [Özellik İste](https://github.com/kaanirmak/StockMind/issues/new)

</div>

---

## 🌟 Genel Bakış

**StockMind**, bireysel ve profesyonel yatırımcılar için geliştirilmiş yeni nesil finansal takip ve portföy analiz platformudur. 

Borsa İstanbul (BIST), Amerikan Borsaları (NASDAQ, NYSE), TEFAS Yatırım Fonları, Emtialar ve Döviz paritelerini tek bir çatı altında toplayarak; **FIFO lot tabanlı kâr/zarar hesabı**, **TradingView grafik motoru**, **Kantitatif DCF ve Stres Testleri** ile **OpenRouter çoklu LLM destekli AI finans asistanı** sunar.

---

## ✨ Temel Özellikler

<table>
<tr>
<td width="50%" valign="top">

### 📊 Çoklu Piyasa & Varlık Kapsamı
- **BIST Hisseleri & Endeksleri**: Canlı fiyatlar, derinlikli özetler ve sektör filtreleri.
- **ABD Borsaları (NASDAQ / NYSE)**: Global hisseler ve popüler ETF'ler (QQQ, SPY, VOO vb.).
- **3.000+ TEFAS Yatırım Fonu**: Otomatik senkronize edilen fon kataloğu, getiri ve risk sıralaması.
- **Kıymetli Madenler & Emtia**: Gram/Çeyrek Altın, Gümüş, Brent/WTI Petrol, Doğalgaz ve tarım emtiaları.
- **Döviz & Kripto**: USD/TRY, EUR/TRY, majör pariteler ve kripto para piyasaları.

### 💼 Profesyonel Portföy Yönetimi
- **FIFO (First-In, First-Out) Lot Takibi**: Her alım lotu için ayrı maliyet ve gerçekleşen kâr/zarar hesabı.
- **Excel & CSV İçe / Dışa Aktarımı**: Midas, İş Bankası, Garanti BBVA, Yapı Kredi ve evrensel şablon desteği.
- **Çoklu Portföy & Nakit Yönetimi**: Sınırsız portföy (Büyüme, Temettü vb.) ve çoklu para birimli nakit bakiyesi (TRY, USD, EUR).
- **Görsel Dağılım & Isı Haritası**: Varlık/sektör tahsis grafikleri ve Günlük P&L Takvim Isı Haritası.
- **Aracı Kurum Rehberi**: Tek tıkla ilgili hisse için Midas ve banka işlem kısayolu.

### 📈 Teknik Analiz & TradingView Grafikleri
- **TradingView Lightweight Charts v5** entegrasyonu ile akıcı mum ve çizgi grafikleri.
- **15+ Teknik İndikatör**: RSI, MACD, Bollinger Bantları, SMA, EMA, Süpertrent ve hacim osilatörleri.
- **Farklı Zaman Dilimleri**: Günlük, haftalık, aylık ve çok yıllık periyotlar.

</td>
<td width="50%" valign="top">

### 🧪 Quant Lab (Kantitatif Analiz)
- **DCF (İndirgenmiş Nakit Akışı) Değerleme**: Adil hisse değeri ve iskonto/prim oranları.
- **Portföy Stres Testi**: 2008 Krizi, COVID-19 Pandemisi, Faiz Şoku ve Stagflasyon simülasyonları.
- **Bilanço Sağlık Puanı**: Piotroski F-Score ve borç/likidite oranları analizi.
- **Sanal Yatırım Komitesi**: Warren Buffett, Peter Lynch ve Benjamin Graham felsefelerine dayalı AI komite değerlendirmesi.

### 🤖 AI Finansal Asistan
- **OpenRouter Entegrasyonu**: Gemini, GPT, Claude ve Llama modelleri ile zengin analiz.
- **Portföy Bağlamı**: Portföyünüzdeki hisseleri ve nakit dengesini göz önünde bulunduran akıllı tavsiyeler.
- **Akıllı Hata Toleransı & Saatlik Kota**: Standart (5 soru/saat) ve Pro (20 soru/saat) kademeli dinamik kota yönetimi.

### 🛡️ Güvenlik, Bildirimler & Ekstralar
- **Passkeys / WebAuthn Biyometrik Giriş**: Parolasız, donanım destekli güvenli oturum.
- **Fiyat Alarmları**: Yüzdesel yükseliş, düşüş ve eşik alarmları.
- **HTML Günlük Bülten**: Idempotent korumalı SMTP e-posta raporlama servisi.
- **Watchlist (İzleme Listesi)**: Özelleştirilebilir takip listeleri.
- **Modern Tema**: Göz yormayan Dark & Light tema seçenekleri.

</td>
</tr>
</table>

---

## 🛠 Teknoloji Mimarisi

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **Framework** | Next.js 16.4 (App Router) | React Server Components, Route Handlers & Edge Runtime |
| **Arayüz (UI)** | React 19 + Tailwind CSS 4 | Modern glassmorphism, responsive tasarım ve minimal utility sınıfları |
| **Veritabanı & Auth** | Supabase (PostgreSQL + RLS) | Row Level Security ile tam veri izolasyonu, WebAuthn & OAuth |
| **Dağıtım (Hosting)** | Cloudflare Workers (@opennextjs/cloudflare) | Küresel CDN üzerinden ultra düşük gecikmeli sunucusuz (serverless) dağıtım |
| **Durum Yönetimi** | Zustand 5 | Hafif, optimize ve hızlı istemci durum yönetimi |
| **Finansal Grafikler** | TradingView Lightweight Charts v5 | Performans odaklı canvas tabanlı profesyonel grafikler |
| **Veri & Excel** | SheetJS (xlsx) | Banka ve aracı kurum ekstrelerini yüksek doğrulukla parse etme |
| **Yapay Zeka (AI)** | OpenRouter API | Çoklu LLM sağlayıcı desteği ve akıllı fallback mekanizmaları |
| **E-Posta** | Nodemailer (SMTP) | Günlük zengin HTML portföy performans bültenleri |
| **Mobil** | Android WebView | Yerel Android Studio / Gradle APK derleme desteği |
| **Tip Güvenliği & Test** | TypeScript 5 + Node.js Test Runner | Katı tip kontrolü ve 137+ otomatik güvenlik/işlem birim testi |

---

## 🚀 Hızlı Başlangıç

### Ön Gereksinimler

- **Node.js**: `22.x LTS` veya `24.x LTS`
- **Paket Yöneticisi**: `npm`, `pnpm` veya `bun`
- [Supabase](https://supabase.com) hesabı (Ücretsiz katman yeterlidir)

### 1. Depoyu Klonlayın

```bash
git clone https://github.com/kaanirmak/StockMind.git
cd StockMind
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. Ortam Değişkenlerini Tanımlayın

`.env.example` dosyasını baz alarak `.env.local` oluşturun:

```bash
cp .env.example .env.local
```

`.env.local` dosyasını kendi anahtarlarınızla güncelleyin:

```env
# Supabase (Zorunlu)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Asistan (Opsiyonel)
OPENROUTER_API_KEY=your-openrouter-key

# Zamanlanmış Görev Güvenliği
CRON_SECRET=your-cron-secret-token

# E-posta Raporlama (Opsiyonel)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresine gidin.

---

## 🧪 Test ve Kalite Güvencesi

StockMind; finansal hesaplamaların (FIFO maliyetleri, nakit mutabakatı, günlük getiri hesabı) ve güvenlik mekanizmalarının doğruluğu için kapsamlı bir test paketine sahiptir.

```bash
# Tüm testleri çalıştırın (137 test)
npm test

# Güvenlik ve yetkilendirme testleri
npm run test:security

# Portföy, FIFO lot ve nakit mutabakat testleri
npm run test:portfolio

# Kullanıcı etkileşim ve alarm testleri
npm run test:interaction

# TypeScript tip kontrolü
npm run typecheck
```

---

## ☁️ Cloudflare Workers ile Canlıya Alma

Proje Cloudflare Workers üzerinde `@opennextjs/cloudflare` köprüsü ile çalışacak şekilde optimize edilmiştir:

```bash
# Cloudflare Workers için optimize derleme
npm run build:cloudflare

# Cloudflare üzerinde önizleme
npm run preview:cloudflare

# Cloudflare Workers'a dağıtma
npm run deploy:cloudflare
```

---

## 📱 Mobil Uygulama (Android APK)

StockMind yerleşik Android WebView sarmalayıcısına sahiptir. Doğrudan bağımsız bir `.apk` dosyası üretebilirsiniz:

```bash
npm run build:apk
```

> **Not**: Android Studio (JBR 21) veya OpenJDK 21 ve Android SDK yüklü olmalıdır. Derleme çıktısı projenin kök dizininde ve `public/StockMind.apk` olarak oluşturulur.

---

## 📂 Proje Dizin Yapısı

```
StockMind/
├── android/                 # Android WebView mobil uygulaması
├── public/                  # Statik görseller, logo ve manifest
├── scripts/                 # TEFAS fon senkronizasyonu vb. yardımcı betikler
├── src/
│   ├── app/
│   │   ├── (auth)/          # Giriş, Kayıt, Şifremi Unuttum sayfaları
│   │   ├── (dashboard)/     # Ana uygulama ekranları
│   │   │   ├── ai-assistant/    # Yapay zeka sohbet asistanı
│   │   │   ├── dashboard/       # Genel bakış ve piyasa kartları
│   │   │   ├── funds/           # TEFAS fon kataloğu ve detay
│   │   │   ├── news/            # Finansal haber akışı
│   │   │   ├── piyasalar/       # Canlı BIST, ABD, Emtia & Döviz piyasaları
│   │   │   ├── portfolio/       # Portföy, FIFO lotlar ve işlem geçmişi
│   │   │   ├── quant-lab/       # DCF, Stres Testi ve Yatırım Komitesi
│   │   │   ├── reports/         # Portföy performans raporları
│   │   │   ├── settings/        # Kullanıcı tercihleri, kota & biyometri
│   │   │   ├── stocks/          # Hisse detay, teknik grafik & alarmlar
│   │   │   └── watchlist/       # Takip listesi
│   │   ├── admin/           # Masaüstü biyometrik yönetim ve onay paneli
│   │   ├── api/             # Güvenli REST API rotaları
│   │   │   ├── ai/              # AI sohbet ve kota endpoint'leri
│   │   │   ├── cron/            # Günlük bülten ve TEFAS senkronizasyon cron'ları
│   │   │   ├── funds/           # Fon veri sağlayıcısı
│   │   │   ├── markets/         # Emtia ve döviz verileri
│   │   │   ├── news/            # Finans haberleri servisi
│   │   │   ├── notifications/   # Fiyat alarmı bildirimleri
│   │   │   ├── pro/             # Pro üyelik doğrulama ve talepleri
│   │   │   ├── quant/           # DCF ve Komite analiz rotaları
│   │   │   └── stocks/          # Hisse, indikatör ve mum verileri
│   │   └── auth/callback/   # Supabase OAuth yönlendirme noktası
│   ├── components/          # Modüler UI ve domain bileşenleri
│   │   ├── dashboard/       # Dashboard widget'ları ve ısı haritaları
│   │   ├── layout/          # Navbar, Sidebar ve Header
│   │   ├── portfolio/       # HoldingsTable, İşlem/Excel Modalları, BrokerDirectory
│   │   ├── quant/           # DCF, Stres Testi, Sağlık & Komite modülleri
│   │   ├── stocks/          # TradingView grafik, teknik analiz ve alarmlar
│   │   └── ui/              # Butonlar, modallar, giriş alanları ve logolar
│   ├── hooks/               # useAuth, usePortfolioPerformance vb. custom hook'lar
│   ├── lib/                 # İş mantığı, veri kaynakları ve yardımcılar
│   │   ├── ai/              # OpenRouter & Yatırım komitesi prompt motoru
│   │   ├── data/            # BIST, TEFAS, Emtia ve Broker statik verileri
│   │   ├── portfolio/       # FIFO lot hesabı, Excel parser & nakit mutabakatı
│   │   └── supabase/        # Supabase istemci ve sunucu yardımcıları
│   ├── store/               # Zustand state mağazaları (usePortfolioStore vb.)
│   └── types/               # Güçlü TypeScript arayüz ve tip tanımları
├── tests/                   # 137+ Güvenlik, Portföy & Etkileşim testleri
├── .env.example             # Çevre değişkenleri kılavuzu
├── package.json
└── tsconfig.json
```

---

## 🔌 Başlıca API Endpoint'leri

| Metot | Endpoint | Açıklama |
|---|---|---|
| `GET` | `/api/stocks` | BIST ve ABD hisse senetleri listesi |
| `GET` | `/api/stocks/[symbol]` | Hisse güncel fiyat ve detay metrikleri |
| `GET` | `/api/stocks/[symbol]/history` | Mum grafik ve tarihsel fiyat verileri |
| `GET` | `/api/stocks/[symbol]/indicators` | RSI, MACD ve hareketli ortalama indikatörleri |
| `GET` | `/api/funds` | TEFAS fon listesi ve kategorik filtreleme |
| `GET` | `/api/funds/[code]` | Fon detay, risk değeri ve getiri geçmişi |
| `GET` | `/api/markets` | Emtia, altın, petrol ve döviz pariteleri |
| `POST`| `/api/ai/chat` | AI Asistan sohbet (OpenRouter & kota denetimli) |
| `POST`| `/api/quant/committee` | Sanal AI Yatırım Komitesi analizi |
| `GET` | `/api/news` | Anlık finans ve piyasa haber akışı |
| `POST`| `/api/cron/daily-report` | Günlük portföy bülteni gönderimi (`CRON_SECRET` korumalı) |
| `POST`| `/api/cron/sync-funds` | TEFAS veritabanı periyodik senkronizasyonu |

---

## 🔒 Güvenlik

- **Veri İzolasyonu**: Veritabanı seviyesinde etkinleştirilmiş PostgreSQL RLS (Row Level Security) ile kullanıcılar sadece kendi portföy ve işlemlerine erişebilir.
- **Biyometrik Güvenlik**: FIDO2 / WebAuthn standardı ile donanım destekli (Touch ID, Face ID, Windows Hello) oturum açma.
- **CSRF & Origin Koruması**: API rotalarında katı origin, CORS ve content-length kontrolleri.
- **Güvenli Cron Mimarisi**: Zamanlanmış arka plan görevleri query parametresi yerine sadece yetkili `Bearer` başlığı ile tetiklenebilir.

---

## 🤝 Katkıda Bulunma

Projeye katkıda bulunmaktan mutluluk duyarız! Adımlar:

1. Projeyi **Fork** edin (`https://github.com/kaanirmak/StockMind/fork`)
2. Yeni bir özellik dalı oluşturun (`git checkout -b feature/harika-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: harika özellik eklendi'`)
4. Dalınızı uzak depoya gönderin (`git push origin feature/harika-ozellik`)
5. Bir **Pull Request** açın

---

## 📄 Lisans

Bu proje **MIT Lisansı** altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına göz atabilirsiniz.

---

<div align="center">

**StockMind** — Yatırımlarınızı akıllı ve bilinçli yönetin. 📈

Geliştirici: [Kaan Irmak](https://github.com/kaanirmak)

</div>
