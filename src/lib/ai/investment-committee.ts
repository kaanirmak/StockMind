// StockMind Yatırım Komitesi - Çoklu AI Ajan Simülasyonu Motoru

export interface CommitteeAgent {
  id: 'buffett' | 'lynch' | 'simons' | 'burry';
  name: string;
  role: string;
  avatar: string;
  color: string;
  accentBg: string;
  focus: string;
  verdict: 'AL' | 'GÜÇLÜ AL' | 'TUT' | 'SAT' | 'TEMKİNLİ';
  score: number; // 0 - 10
  speech: string;
  keyArguments: string[];
}

export interface CommitteeReport {
  symbol: string;
  companyName: string;
  consensusVerdict: 'GÜÇLÜ AL' | 'AL' | 'TUT / DENGELİ' | 'DİKKATLİ / SAT';
  consensusScore: number; // 0 - 10
  consensusSummary: string;
  agents: CommitteeAgent[];
  generatedAt: string;
  isLiveLLM: boolean;
}

export const COMMITTEE_AGENTS_CONFIG = [
  {
    id: 'buffett' as const,
    name: 'Warren Buffett',
    role: 'Değer & Hendek (Moat) Ajanı',
    avatar: '👴🏻',
    color: '#3b82f6',
    accentBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    focus: 'Ekonomik Hendek, Serbest Nakit Akışı, F/K, Sermaye Kârlılığı (ROE)',
  },
  {
    id: 'lynch' as const,
    name: 'Peter Lynch',
    role: 'Büyüme & Trend Ajanı',
    avatar: '📈',
    color: '#10b981',
    accentBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    focus: 'Büyüme Potansiyeli, PEG Oranı, Müşteri Sadakati, 10-Bagger Potansiyeli',
  },
  {
    id: 'simons' as const,
    name: 'Jim Simons (Quant)',
    role: 'Algoritmik & Matematiksel Ajan',
    avatar: '📐',
    color: '#8b5cf6',
    accentBg: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
    focus: 'Momentum, RSI/MACD, Volatilite, İstatistiksel Sapma & Olasılık',
  },
  {
    id: 'burry' as const,
    name: 'Michael Burry',
    role: 'Risk Yöneticisi (Ayı Senaryosu)',
    avatar: '🐻',
    color: '#f43f5e',
    accentBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    focus: 'Makro Kriz Riskleri, Borç Vadesi, Kur Riski, Aşırı Değerleme İpuçları',
  },
];

export async function runInvestmentCommittee(
  symbol: string,
  stockQuote?: any,
  apiKey?: string
): Promise<CommitteeReport> {
  const sym = symbol.toUpperCase().trim();

  // If user provided a real OpenRouter API key, call OpenRouter to get authentic dynamic multi-agent debate
  if (apiKey && apiKey.trim()) {
    try {
      return await callLiveCommitteeAPI(sym, stockQuote, apiKey.trim());
    } catch (e) {
      console.warn('Live committee LLM call failed, fallback to analytical simulation:', e);
    }
  }

  // High-fidelity structured analytical simulation
  return generateAnalyticalCommittee(sym, stockQuote);
}

async function callLiveCommitteeAPI(symbol: string, stockQuote: any, apiKey: string): Promise<CommitteeReport> {
  const prompt = `Lütfen ${symbol} hissesi için StockMind "Yatırım Komitesi" toplantısını yönet.
Komitede 4 farklı yatırımcı kişiliği yer alacak:
1. Warren Buffett (Değer & Hendek odaklı)
2. Peter Lynch (Büyüme ve PEG odaklı)
3. Jim Simons (Teknik, Quant, momentum odaklı)
4. Michael Burry (Riskler, makro tehditler, ayı senaryosu odaklı)

Lütfen aşağıdaki JSON şablonunda geçerli ve saf bir JSON çıktısı üret:
{
  "consensusVerdict": "AL" | "GÜÇLÜ AL" | "TUT / DENGELİ" | "DİKKATLİ / SAT",
  "consensusScore": 8.5,
  "consensusSummary": "Komitenin ortak değerlendirmesi...",
  "agents": [
    {
      "id": "buffett",
      "verdict": "GÜÇLÜ AL",
      "score": 8.8,
      "speech": "Warren Buffett olarak değerlendirmem...",
      "keyArguments": ["Argüman 1", "Argüman 2"]
    },
    {
      "id": "lynch",
      "verdict": "AL",
      "score": 8.2,
      "speech": "Peter Lynch olarak büyüme analizi...",
      "keyArguments": ["Argüman 1", "Argüman 2"]
    },
    {
      "id": "simons",
      "verdict": "AL",
      "score": 7.9,
      "speech": "Jim Simons olarak istatistiksel trend...",
      "keyArguments": ["Argüman 1", "Argüman 2"]
    },
    {
      "id": "burry",
      "verdict": "TEMKİNLİ",
      "score": 6.1,
      "speech": "Michael Burry olarak kriz senaryosu...",
      "keyArguments": ["Risk 1", "Risk 2"]
    }
  ]
}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://stockmind.app',
      'X-Title': 'StockMind Quant Lab',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1800,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || '';

  // Extract JSON
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON from LLM response');

  const parsed = JSON.parse(jsonMatch[0]);

  const agents: CommitteeAgent[] = COMMITTEE_AGENTS_CONFIG.map((cfg) => {
    const fromLlm = parsed.agents?.find((a: any) => a.id === cfg.id) || {};
    return {
      ...cfg,
      verdict: fromLlm.verdict || 'AL',
      score: Number(fromLlm.score || 7.5),
      speech: fromLlm.speech || `${cfg.name} analizi tamamlandı.`,
      keyArguments: fromLlm.keyArguments || ['Güçlü finansal göstergeler', 'Risk yönetimi dengeli'],
    };
  });

  return {
    symbol,
    companyName: stockQuote?.name || symbol,
    consensusVerdict: parsed.consensusVerdict || 'AL',
    consensusScore: Number(parsed.consensusScore || 7.8),
    consensusSummary: parsed.consensusSummary || 'Komite çoğunlukla pozitif görüş bildirdi.',
    agents,
    generatedAt: new Date().toISOString(),
    isLiveLLM: true,
  };
}

function generateAnalyticalCommittee(symbol: string, stockQuote?: any): CommitteeReport {
  const price = stockQuote?.price || 285.5;
  const name = stockQuote?.name || `${symbol} Sanayi A.Ş.`;

  // Tailored responses for key stocks or robust generic
  if (symbol === 'THYAO') {
    return {
      symbol: 'THYAO',
      companyName: 'Türk Hava Yolları',
      consensusVerdict: 'GÜÇLÜ AL',
      consensusScore: 8.6,
      consensusSummary:
        'Komite, THYAO hissesini küresel havacılık pazarındaki pazar payı artışı, güçlü kargo gelirleri ve makul F/K çarpanı nedeniyle yüksek güvenle "GÜÇLÜ AL" olarak derecelendirdi. Petrol fiyatı ve döviz dalgalanmaları ana risk unsuru olarak not edildi.',
      generatedAt: new Date().toISOString(),
      isLiveLLM: false,
      agents: [
        {
          ...COMMITTEE_AGENTS_CONFIG[0],
          verdict: 'GÜÇLÜ AL',
          score: 9.0,
          speech:
            'İstanbul Havalimanı transfer merkezi konumu ve küresel rota ağı şirkete aşılması güç bir "ekonomik hendek" (moat) sağlıyor. 162 Milyar TL serbest nakit akışı ve tek haneli F/K çarpanı, piyasanın şirketi gerçek içsel değerinin çok altında fiyatladığını gösteriyor. Bizim tarzımızda uzun vadeli bir kale.',
          keyArguments: [
            'Düşük F/K (4.8x) ve derin bilanço iskontosu',
            'İstanbul Havalimanı transit avantajı ve küresel moat',
            'Yüksek serbest nakit akışı yaratma kapasitesi',
          ],
        },
        {
          ...COMMITTEE_AGENTS_CONFIG[1],
          verdict: 'GÜÇLÜ AL',
          score: 8.8,
          speech:
            'Yolcu doluluk oranları her çeyrekte %83 üzerinde seyrediyor. Filoya katılacak yeni nesil yakıt tasarruflu uçaklar ve Turkish Cargo’nun dünyada ilk 3 arasına girmesi güçlü bir büyüme hikayesi. PEG rasyosu 0.65 ile büyümesine göre ucuz kalan harika bir yatırım.',
          keyArguments: [
            'PEG Rasyosu < 1.0 (Kâr büyümesine göre cazip fiyat)',
            'Filo büyümesi ve kargo operasyonlarının büyüme kaldıracı',
            'Sürdürülebilir yüksek doluluk oranları',
          ],
        },
        {
          ...COMMITTEE_AGENTS_CONFIG[2],
          verdict: 'AL',
          score: 8.2,
          speech:
            '20 ve 50 günlük hareketli ortalamaların üzerinde pozitif momentum korunuyor. RSI 58 seviyesinde olup ne aşırı alımda ne de aşırı satımda; yukarı yönlü trend devamı için yeterli matematiksel alan var. ₺320 ve ₺340 direnç seviyeleri test edilebilir.',
          keyArguments: [
            'SMA 20 & SMA 50 üzerinde boğa trendi',
            'MACD pozitif bölgede sinyal kesişimi',
            'Hacim destekli yükseliş formasyonu',
          ],
        },
        {
          ...COMMITTEE_AGENTS_CONFIG[3],
          verdict: 'TEMKİNLİ',
          score: 6.8,
          speech:
            'Herkes büyümeye odaklanmışken ben yakıt maliyetlerini ve jeopolitik tansiyonu izliyorum. Brent petrolün 90$ üzerine çıkması veya Orta Doğu hava sahası kapanmaları marjları hızla eritir. Ayrıca yüksek döviz borç servisi göz ardı edilmemeli; mutlaka kâr realizasyon seviyeleri belirlenmeli.',
          keyArguments: [
            'Brent petrol fiyat dalgalanmalarına aşırı hassasiyet',
            'Jeopolitik çatışma ve hava sahası kapanma riskleri',
            'Yüksek döviz cinsi borç stoku',
          ],
        },
      ],
    };
  }

  if (symbol === 'ASELS') {
    return {
      symbol: 'ASELS',
      companyName: 'Aselsan Elektronik',
      consensusVerdict: 'GÜÇLÜ AL',
      consensusScore: 8.4,
      consensusSummary:
        'Komite, Aselsan\'ın 11 Milyar $ seviyesindeki rekor bakiye siparişleri ve yüksek Ar-Ge katma değeriyle savunma sanayii liderliğini takdir etti. Nakit akışı tahsilat vadeleri risk unsuru olarak belirtildi.',
      generatedAt: new Date().toISOString(),
      isLiveLLM: false,
      agents: [
        {
          ...COMMITTEE_AGENTS_CONFIG[0],
          verdict: 'GÜÇLÜ AL',
          score: 8.7,
          speech:
            'Savunma sanayiinde teknoloji tekelidir. Devlet sözleşmeleri ve savunma bütçesi garantisi sarsılmaz bir hendek yaratır. Kâr marjları istikrarlı ve sermaye verimliliği tatmin edici.',
          keyArguments: ['Devlet garantili savunma sözleşmeleri', 'Ar-Ge odaklı yerli teknoloji tekeli', 'İstikrarlı FAVÖK marjı'],
        },
        {
          ...COMMITTEE_AGENTS_CONFIG[1],
          verdict: 'GÜÇLÜ AL',
          score: 8.9,
          speech:
            'Uluslararası ihracat oranı hızla artıyor. Körfez, Asya ve Doğu Avrupa pazarlarına radar ve haberleşme satışı şirketi küresel bir oyuncu haline getiriyor.',
          keyArguments: ['Rekor bakiye sipariş tutarı ($11+ Mr)', 'İhracat payının ciro içindeki artışı'],
        },
        {
          ...COMMITTEE_AGENTS_CONFIG[2],
          verdict: 'AL',
          score: 8.0,
          speech:
            'Teknik göstergelerde istikrarlı yükselen kanal hareketi görülüyor. Volatilite endeksi düşük ve risk-getiri asimetrisi pozitif yönde.',
          keyArguments: ['Düşük beta ve istikrarlı trend', 'RSI 54 dengeli momentum'],
        },
        {
          ...COMMITTEE_AGENTS_CONFIG[3],
          verdict: 'TEMKİNLİ',
          score: 6.4,
          speech:
            'Alacak vadelerinin uzunluğu ve enflasyon muhasebesi nakit akışını zorlayabilir. Tahsilat döngüsü yakından takip edilmeli.',
          keyArguments: ['Uzun vadeli ticari alacaklar', 'İç piyasa bütçe kısıntısı olasılığı'],
        },
      ],
    };
  }

  // Generic robust analysis for any other stock
  return {
    symbol,
    companyName: name,
    consensusVerdict: 'AL',
    consensusScore: 7.7,
    consensusSummary: `Komite, ${symbol} hissesi için temel değerleme, büyüme potansiyeli ve teknik göstergeleri incelemiştir. Genel konsensüs "AL" yönünde olmakla birlikte makroekonomik dalgalanmalara karşı stop-loss ve risk yönetimi önerilmiştir.`,
    generatedAt: new Date().toISOString(),
    isLiveLLM: false,
    agents: [
      {
        ...COMMITTEE_AGENTS_CONFIG[0],
        verdict: 'AL',
        score: 7.8,
        speech: `${symbol} sektöründe bilinen bir marka. Fiyat-kazanç oranı ve özkaynak kârlılığı makul sınırlarda. Şirketin fiyatlama gücünü ve borç çevirme kabiliyetini koruduğu sürece adil değerine doğru yakınsama potansiyeli taşıyor.`,
        keyArguments: ['Makul sektör çarpanları', 'Güvenilir bilanço özkaynağı'],
      },
      {
        ...COMMITTEE_AGENTS_CONFIG[1],
        verdict: 'AL',
        score: 8.0,
        speech: `Şirketin ciro büyümesi enflasyonun üzerinde seyrediyor. Ürün gamı ve müşteri tabanı genişliyor; büyüme eğilimi devam ettikçe piyasadan pozitif ayrışma potansiyeli mevcut.`,
        keyArguments: ['Enflasyon üzeri ciro büyümesi', 'Genişleyen pazar payı'],
      },
      {
        ...COMMITTEE_AGENTS_CONFIG[2],
        verdict: 'AL',
        score: 7.6,
        speech: `Hareketli ortalamalar ve osilatörler sağlıklı bir konsolidasyon sürecinde. RSI nötr bölgede işlem görürken işlem hacmindeki toparlanma yukarı yönlü kırılım olasılığını destekliyor.`,
        keyArguments: ['Teknik destek seviyelerinde tutunma', 'Pozitif risk/getiri oranı'],
      },
      {
        ...COMMITTEE_AGENTS_CONFIG[3],
        verdict: 'TEMKİNLİ',
        score: 6.0,
        speech: `Faiz oranlarının yüksek olduğu bir konjonktürde finansman giderleri kârlılık üzerinde baskı yaratabilir. Yatırımcıların destek seviyelerini yakından izleyerek stop-loss ile pozisyon almaları elzemdir.`,
        keyArguments: ['Yüksek faiz ortamında finansman maliyeti', 'Genel piyasa volatilitesi'],
      },
    ],
  };
}
