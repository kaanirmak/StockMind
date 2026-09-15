# 📈 StockMind — Akıllı Borsa & Fon Takip Platformu

## Proje Özeti

StockMind, yatırımcıların borsa hisselerini ve TEFAS fonlarını tek bir platformdan takip edebileceği, portföy yönetimi yapabileceği ve AI destekli analizler alabileceği modern bir web uygulamasıdır.

---

## 🛠️ Teknoloji Stack

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| **Frontend Framework** | Next.js (App Router) | 15.x |
| **UI Framework** | React | 19.x |
| **Styling** | Tailwind CSS | v4 |
| **Dil** | TypeScript | 5.x |
| **Backend / DB** | Supabase (PostgreSQL + Auth + RLS) | Latest |
| **Grafik** | TradingView Lightweight Charts | Latest |
| **Borsa Verileri** | `@mathieuc/tradingview` (TvDatafeed JS) | Latest |
| **TEFAS Verileri** | `@firstthumb/tefas-api` | Latest |
| **State Management** | Zustand | Latest |
| **i18n** | next-intl | Latest |
| **AI** | Google Gemini API (veya OpenAI) | Latest |

---

## 🌍 Desteklenen Piyasalar

- **BIST** (Borsa İstanbul) — Tüm hisseler
- **NYSE** (New York Stock Exchange)
- **NASDAQ**
- **TEFAS** (Türkiye Elektronik Fon Alım Satım Platformu) — Tüm fonlar

---

## 🗣️ Dil Desteği

- 🇹🇷 Türkçe
- 🇬🇧 İngilizce

---

## ✨ Özellikler

### 1. 🔐 Kullanıcı Yönetimi (Auth)
- Kayıt / Giriş / Çıkış (Supabase Auth)
- E-posta + Şifre ile kayıt
- Google OAuth ile giriş
- Şifremi unuttum akışı
- Kullanıcı profili (avatar, isim, tercihler)
- Row Level Security (RLS) ile veri güvenliği

### 2. 📊 Dashboard (Ana Pano)
- Toplam portföy değeri ve günlük değişim
- Portföy dağılım grafiği (pie chart)
- En çok kazandıran / kaybettiren hisseler
- Piyasa özeti (BIST100, S&P500, NASDAQ endeksleri)
- Günlük kar/zarar göstergesi
- Son işlemler listesi
- Watchlist'ten hızlı fiyat bilgisi

### 3. 📈 Hisse Senedi Fiyat Takibi & Grafikler
- Gerçek zamanlı fiyat verileri (TvDatafeed)
- TradingView Lightweight Charts ile interaktif mum grafikleri
- Zaman aralıkları: 1G, 1H, 1A, 3A, 6A, 1Y, 5Y, Max
- Hacim göstergesi
- Hisse detay sayfası (fiyat, değişim, hacim, piyasa değeri)

### 4. 📐 Teknik Analiz Göstergeleri
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands
- SMA / EMA (Hareketli Ortalamalar)
- Stochastic RSI
- Göstergeleri grafik üzerinde toggle ile açma/kapama

### 5. 💼 Portföy Yönetimi
- Alım/satım işlemi ekleme (hisse, fiyat, miktar, tarih, komisyon)
- Birden fazla portföy oluşturabilme
- Hisse bazlı maliyet ortalaması hesaplama
- Toplam yatırım tutarı ve güncel değer
- Ağırlıklı ortalama maliyet
- İşlem geçmişi

### 6. 💰 Kar / Zarar Hesaplama & Raporlama
- Hisse bazlı kar/zarar
- Portföy bazlı toplam kar/zarar
- Yüzdesel ve TL bazlı getiri
- Günlük, haftalık, aylık performans grafiği
- CSV / PDF olarak rapor indirme

### 7. 🏦 TEFAS Fon Takibi & Analizi
- Fon arama ve listeleme
- Fon detay sayfası (günlük fiyat, getiri, risk)
- Fon karşılaştırma
- Fon portföyüne alım/satım ekleme
- Fon performans grafiği
- Fon bazlı kar/zarar

### 8. ⭐ Watchlist (Favori Liste)
- Hisse ve fon favorilere ekleme
- Watchlist'te anlık fiyat ve değişim gösterimi
- Fiyat alarmı kurma (belirli fiyata ulaşınca bildirim)
- Birden fazla watchlist oluşturabilme

### 9. 🤖 AI Destekli Tahmin & Öneri
- Hisse için AI tabanlı kısa vadeli tahmin
- Teknik analiz özeti (AI tarafından yorumlanan)
- Portföy çeşitlendirme önerisi
- Risk analizi ve uyarılar
- Doğal dilde soru-cevap ("THYAO'yu almalı mıyım?")

### 10. 📰 Haber / Duyuru Akışı
- Piyasa haberleri akışı
- Hisse bazlı haber filtreleme
- KAP bildirimleri (BIST için)
- Haber kaynağı entegrasyonu (RSS veya API)

---

## 🗄️ Veritabanı Şeması (Supabase / PostgreSQL)

### Tablolar

```sql
-- Kullanıcı Profilleri
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'tr',
  preferred_currency TEXT DEFAULT 'TRY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Portföyler
portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT DEFAULT 'TRY',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- İşlemler (Alım/Satım)
transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'fund')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  quantity DECIMAL NOT NULL,
  price DECIMAL NOT NULL,
  commission DECIMAL DEFAULT 0,
  transaction_date DATE NOT NULL,
  exchange TEXT, -- 'BIST', 'NYSE', 'NASDAQ', 'TEFAS'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Watchlistler
watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Watchlist Kalemleri
watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'fund')),
  exchange TEXT,
  price_alert_high DECIMAL,
  price_alert_low DECIMAL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, symbol, exchange)
)

-- Fiyat Alarmları
price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  exchange TEXT,
  target_price DECIMAL NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  is_triggered BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  triggered_at TIMESTAMPTZ
)

-- AI Sohbet Geçmişi
ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 📁 Proje Klasör Yapısı

```
StockMind/
├── public/
│   ├── locales/
│   │   ├── tr/
│   │   │   └── common.json
│   │   └── en/
│   │       └── common.json
│   └── images/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── portfolio/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── stocks/
│   │   │   │   ├── [symbol]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── funds/
│   │   │   │   ├── [code]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── watchlist/
│   │   │   │   └── page.tsx
│   │   │   ├── reports/
│   │   │   │   └── page.tsx
│   │   │   ├── ai-assistant/
│   │   │   │   └── page.tsx
│   │   │   ├── news/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── stocks/
│   │   │   │   ├── [symbol]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── search/
│   │   │   │       └── route.ts
│   │   │   ├── funds/
│   │   │   │   ├── [code]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── search/
│   │   │   │       └── route.ts
│   │   │   ├── ai/
│   │   │   │   └── chat/
│   │   │   │       └── route.ts
│   │   │   └── news/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing page
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # Genel UI bileşenleri
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Toast.tsx
│   │   ├── charts/             # Grafik bileşenleri
│   │   │   ├── CandlestickChart.tsx
│   │   │   ├── LineChart.tsx
│   │   │   ├── PieChart.tsx
│   │   │   ├── VolumeChart.tsx
│   │   │   └── PerformanceChart.tsx
│   │   ├── dashboard/          # Dashboard bileşenleri
│   │   │   ├── PortfolioSummary.tsx
│   │   │   ├── MarketOverview.tsx
│   │   │   ├── RecentTransactions.tsx
│   │   │   ├── TopMovers.tsx
│   │   │   └── WatchlistPreview.tsx
│   │   ├── portfolio/          # Portföy bileşenleri
│   │   │   ├── PortfolioCard.tsx
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── HoldingsTable.tsx
│   │   │   └── PortfolioChart.tsx
│   │   ├── stocks/             # Hisse bileşenleri
│   │   │   ├── StockCard.tsx
│   │   │   ├── StockSearch.tsx
│   │   │   ├── TechnicalIndicators.tsx
│   │   │   └── StockDetail.tsx
│   │   ├── funds/              # Fon bileşenleri
│   │   │   ├── FundCard.tsx
│   │   │   ├── FundSearch.tsx
│   │   │   ├── FundComparison.tsx
│   │   │   └── FundDetail.tsx
│   │   ├── ai/                 # AI bileşenleri
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   └── AIInsightCard.tsx
│   │   ├── news/               # Haber bileşenleri
│   │   │   ├── NewsCard.tsx
│   │   │   └── NewsFeed.tsx
│   │   └── layout/             # Layout bileşenleri
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       ├── MobileNav.tsx
│   │       └── Footer.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Browser client
│   │   │   ├── server.ts       # Server client
│   │   │   └── middleware.ts   # Auth middleware
│   │   ├── data/
│   │   │   ├── stocks.ts       # TvDatafeed entegrasyonu
│   │   │   ├── funds.ts        # TEFAS API entegrasyonu
│   │   │   └── indicators.ts   # Teknik analiz hesaplamaları
│   │   ├── ai/
│   │   │   └── gemini.ts       # AI API entegrasyonu
│   │   ├── utils/
│   │   │   ├── format.ts       # Para, tarih formatlama
│   │   │   ├── calculations.ts # Kar/zarar hesaplamaları
│   │   │   └── constants.ts    # Sabit değerler
│   │   └── i18n/
│   │       ├── config.ts
│   │       └── dictionaries.ts
│   ├── hooks/
│   │   ├── useStockData.ts
│   │   ├── useFundData.ts
│   │   ├── usePortfolio.ts
│   │   ├── useWatchlist.ts
│   │   └── useAuth.ts
│   ├── store/
│   │   ├── useAuthStore.ts
│   │   ├── usePortfolioStore.ts
│   │   └── useUIStore.ts
│   └── types/
│       ├── stock.ts
│       ├── fund.ts
│       ├── portfolio.ts
│       ├── user.ts
│       └── ai.ts
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts           # (v4'te minimal veya CSS-first)
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── Project.md
└── README.md
```

---

## 🎨 Tasarım Sistemi

### Renk Paleti (Dark Mode Öncelikli)

| Değişken | Renk | Kullanım |
|----------|------|----------|
| `--bg-primary` | `#0a0e17` | Ana arka plan |
| `--bg-secondary` | `#111827` | Kart arka planı |
| `--bg-tertiary` | `#1f2937` | Hover, input alanları |
| `--accent-primary` | `#6366f1` | Ana vurgu (Indigo) |
| `--accent-secondary` | `#8b5cf6` | İkincil vurgu (Violet) |
| `--success` | `#10b981` | Kar, artış, pozitif |
| `--danger` | `#ef4444` | Zarar, düşüş, negatif |
| `--warning` | `#f59e0b` | Uyarılar |
| `--text-primary` | `#f9fafb` | Ana metin |
| `--text-secondary` | `#9ca3af` | İkincil metin |
| `--border` | `#374151` | Kenar çizgileri |

### Tipografi
- **Font**: Inter (Google Fonts)
- **Başlık**: 600-700 weight
- **Gövde**: 400-500 weight

### UI Öğeleri
- Glassmorphism efektli kartlar
- Yumuşak gölgeler ve gradyanlar
- Micro-animasyonlar (hover, geçiş)
- Responsive tasarım (mobil öncelikli)

---

## 🔌 API Entegrasyonları

### 1. Borsa Verileri — TvDatafeed (`@mathieuc/tradingview`)
- WebSocket üzerinden gerçek zamanlı fiyat
- OHLCV (Open, High, Low, Close, Volume) verileri
- Birden fazla borsa desteği (BIST, NYSE, NASDAQ)
- Server-side API route'larında kullanılacak

### 2. TEFAS Verileri — `@firstthumb/tefas-api`
- Fon fiyat geçmişi
- Fon detay bilgileri (tip, risk, getiri)
- Varlık dağılımı

### 3. Supabase
- Auth: Kullanıcı kimlik doğrulama
- Database: PostgreSQL ile veri depolama
- RLS: Satır bazlı güvenlik politikaları
- Realtime: Canlı veri güncellemeleri

### 4. AI — Google Gemini
- Doğal dilde soru-cevap
- Teknik analiz yorumlama
- Portföy optimizasyon önerileri

---

## ⚠️ Önemli Notlar

1. **Mock data kullanılmayacak** — Tüm veriler gerçek API'lerden çekilecek
2. **RLS zorunlu** — Her tablo için Row Level Security politikaları yazılacak
3. **Rate limiting** — TvDatafeed ve TEFAS API'leri için rate limiting uygulanacak
4. **Caching** — Sık erişilen veriler için önbellek stratejisi (Redis veya Next.js cache)
5. **Error handling** — Tüm API çağrılarında hata yönetimi
6. **Loading states** — Skeleton loader'lar ile kullanıcı deneyimi iyileştirmesi
7. **SEO** — Her sayfa için meta tag'ler ve Open Graph bilgileri
