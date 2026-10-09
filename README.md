<div align="center">

<img src="public/logo-white.png" alt="StockMind Logo" width="280" />

### Akıllı Borsa & Fon Takip Platformu

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-3fcf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-a855f7)](LICENSE)

**BIST · NYSE · NASDAQ · TEFAS** — Tek platformda, gerçek zamanlı.

[Canlı Demo →](https://stockmind-finora.vercel.app/) · [Hata Bildir](https://github.com/kaanirmak/StockMind/issues) · [Özellik İste](https://github.com/kaanirmak/StockMind/issues/new)

</div>

---

## ✨ Özellikler

<table>
<tr>
<td width="50%">

### 📊 Piyasa Verileri
- **4+ borsa** desteği (BIST, NYSE, NASDAQ, TEFAS)
- **10.000+** hisse ve yatırım fonu
- Gerçek zamanlı fiyat akışı
- Mum grafik (candlestick) ile interaktif görselleştirme

### 📈 Teknik Analiz
- **15+ teknik gösterge** (RSI, MACD, Bollinger Bands, SMA, EMA…)
- TradingView tarzı profesyonel grafikler
- Tarihsel fiyat verileri ve trend analizi

### 🤖 AI Destekli Analiz
- OpenRouter LLM entegrasyonu
- Doğal dilde piyasa sorgulama
- Yapay zeka destekli yatırım önerileri

</td>
<td width="50%">

### 💼 Portföy Yönetimi
- Çoklu portföy oluşturma ve takibi
- Alım/satım işlem kaydı
- Maliyet ortalaması ve kâr/zarar hesaplama
- Günlük performans snapshot'ları

### 🧪 Quant Lab
- **DCF Değerleme** — İndirgenmiş nakit akışı analizi
- **Stres Testi** — Portföy senaryoları
- **Finansal Sağlık** — Bilanço analizi
- **Yatırım Komitesi** — AI destekli kolektif karar

### 📋 Ek Özellikler
- Watchlist (takip listesi)
- Finans haberleri akışı
- E-posta ile günlük raporlama (SMTP)
- TEFAS fon karşılaştırma
- Dark / Light tema
- Türkçe & İngilizce dil desteği

</td>
</tr>
</table>

---

## 🛠 Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Tailwind CSS 4 |
| **State** | Zustand 5 |
| **Auth & DB** | Supabase (Auth, PostgreSQL, Row Level Security) |
| **Grafikler** | Lightweight Charts (TradingView) |
| **AI** | OpenRouter (Gemini, GPT, Claude, Llama) |
| **E-posta** | Nodemailer (SMTP) |
| **Deploy** | Vercel (Edge Middleware) |
| **Mobil** | Android WebView (APK build desteği) |
| **Dil** | TypeScript 5 |

---

## 🚀 Hızlı Başlangıç

### Gereksinimler

- **Node.js** ≥ 18
- **npm**, **yarn**, **pnpm** veya **bun**
- [Supabase](https://supabase.com) hesabı (ücretsiz)

### 1. Projeyi Klonlayın

```bash
git clone https://github.com/kaanirmak/StockMind.git
cd StockMind
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. Ortam Değişkenlerini Ayarlayın

`.env.example` dosyasını kopyalayıp düzenleyin:

```bash
cp .env.example .env.local
```

```env
# Zorunlu
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Opsiyonel — AI Asistan
OPENROUTER_API_KEY=your-openrouter-key

# Opsiyonel — E-posta Raporları
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Opsiyonel — Cron Güvenliği
CRON_SECRET=your-secret
```

### 4. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) adresini tarayıcınızda açın. 🎉

---

## 📁 Proje Yapısı

```
StockMind/
├── public/                  # Statik dosyalar (logo, ikonlar)
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, Register sayfaları
│   │   ├── (dashboard)/     # Ana uygulama sayfaları
│   │   │   ├── ai-assistant/    # AI sohbet asistanı
│   │   │   ├── dashboard/       # Ana gösterge paneli
│   │   │   ├── funds/           # TEFAS fon listesi ve detay
│   │   │   ├── news/            # Finans haberleri
│   │   │   ├── piyasalar/       # Piyasa genel görünümü
│   │   │   ├── portfolio/       # Portföy yönetimi
│   │   │   ├── quant-lab/       # Kantitatif analiz araçları
│   │   │   ├── reports/         # Raporlar
│   │   │   ├── settings/        # Kullanıcı ayarları
│   │   │   ├── stocks/          # Hisse detay sayfaları
│   │   │   └── watchlist/       # Takip listesi
│   │   ├── api/             # API Route'ları
│   │   │   ├── ai/chat/         # AI sohbet endpoint'i
│   │   │   ├── cron/            # Zamanlanmış görevler
│   │   │   ├── funds/           # Fon verileri
│   │   │   ├── news/            # Haber verileri
│   │   │   ├── quant/           # Kantitatif analiz
│   │   │   └── stocks/          # Hisse verileri & göstergeler
│   │   └── auth/callback/   # OAuth callback
│   ├── components/
│   │   ├── dashboard/       # Dashboard widget'ları
│   │   ├── layout/          # Header, Sidebar, Navigation
│   │   ├── portfolio/       # Portföy bileşenleri
│   │   ├── quant/           # Quant Lab sekmeleri
│   │   ├── stocks/          # Grafik ve teknik analiz
│   │   ├── theme/           # Tema yönetimi
│   │   └── ui/              # Ortak UI bileşenleri
│   ├── hooks/               # Custom React hooks (useAuth, vb.)
│   ├── lib/                 # Yardımcı kütüphaneler
│   │   ├── portfolio/           # Portföy hesaplama mantığı
│   │   └── supabase/            # Supabase client/server/middleware
│   ├── store/               # Zustand state yönetimi
│   └── types/               # TypeScript tip tanımları
├── android/                 # Android WebView wrapper (APK)
├── .env.example             # Ortam değişkenleri şablonu
├── package.json
└── tsconfig.json
```

---

## 📱 Android APK

StockMind, Android WebView wrapper ile mobil uygulama olarak da derlenebilir:

```bash
npm run build:apk
```

> **Not:** JDK 21 ve Android SDK gereklidir. Çıktı: `StockMind.apk`

---

## 🔌 API Endpoint'leri

| Endpoint | Açıklama |
|----------|----------|
| `GET /api/stocks` | Hisse listesi |
| `GET /api/stocks/[symbol]` | Hisse detay bilgisi |
| `GET /api/stocks/[symbol]/history` | Tarihsel fiyat verileri |
| `GET /api/stocks/[symbol]/indicators` | Teknik göstergeler |
| `GET /api/funds` | TEFAS fon listesi |
| `GET /api/funds/[code]` | Fon detay bilgisi |
| `POST /api/ai/chat` | AI asistan sohbet |
| `POST /api/quant/committee` | Yatırım komitesi analizi |
| `GET /api/news` | Finans haberleri |
| `POST /api/cron/daily-report` | Günlük rapor gönderimi |
| `POST /api/cron/sync-funds` | TEFAS fon senkronizasyonu |

---

## ⚙️ Ortam Değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase proje URL'si |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonim (public) anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Sunucu tarafı admin işlemleri |
| `OPENROUTER_API_KEY` | ❌ | AI asistan için LLM erişimi |
| `CRON_SECRET` | ❌ | Cron endpoint güvenliği |
| `SMTP_USER` | ❌ | E-posta gönderim adresi |
| `SMTP_PASS` | ❌ | Gmail uygulama şifresi |
| `NEXT_PUBLIC_APP_URL` | ❌ | Uygulama base URL |

---

## 🤝 Katkıda Bulunma

Katkılarınızı memnuniyetle karşılıyoruz!

1. Projeyi **fork** edin
2. Yeni bir branch oluşturun (`git checkout -b feature/harika-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: harika özellik eklendi'`)
4. Branch'i push edin (`git push origin feature/harika-ozellik`)
5. **Pull Request** açın

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

<div align="center">

**StockMind** ile yatırımlarınızı bir üst seviyeye taşıyın. 🚀

Built with ❤️ by [Kaan Irmak](https://github.com/kaanirmak)

</div>
