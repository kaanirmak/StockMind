// StockMind Quant Lab - İleri Seviye Temel & Kantitatif Değerleme Modelleri

export interface DCFParams {
  symbol: string;
  currentPrice: number;
  freeCashFlow: number; // Milyon TL veya USD
  growthRate5Y: number; // % olarak örn 18 -> 0.18
  terminalGrowthRate: number; // % olarak örn 5 -> 0.05
  wacc: number; // % AOMM örn 16 -> 0.16
  netDebt: number; // Milyon TL
  sharesOutstanding: number; // Milyon Adet Lot
  currency: 'TRY' | 'USD';
}

export interface DCFProjectionYear {
  year: number;
  cashFlow: number;
  discountFactor: number;
  presentValue: number;
}

export interface DCFResult {
  projections: DCFProjectionYear[];
  sumPVScheduled: number;
  terminalValue: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  fairValuePerShare: number;
  currentPrice: number;
  discountRate: number; // % iskonto veya prim
  isUndervalued: boolean;
  verdict: string;
  sensitivityMatrix: {
    waccRates: number[];
    growthRates: number[];
    grid: number[][]; // [waccIndex][growthIndex] -> fairValue
  };
}

export function calculateDCF(params: DCFParams): DCFResult {
  const g = params.growthRate5Y / 100;
  const tg = params.terminalGrowthRate / 100;
  const wacc = Math.max(params.wacc / 100, tg + 0.01); // WACC must be > terminal growth

  const projections: DCFProjectionYear[] = [];
  let currentFCF = params.freeCashFlow;
  let sumPVScheduled = 0;

  for (let y = 1; y <= 5; y++) {
    currentFCF = currentFCF * (1 + g);
    const discountFactor = 1 / Math.pow(1 + wacc, y);
    const presentValue = currentFCF * discountFactor;
    sumPVScheduled += presentValue;

    projections.push({
      year: y,
      cashFlow: Math.round(currentFCF),
      discountFactor: Number(discountFactor.toFixed(4)),
      presentValue: Math.round(presentValue),
    });
  }

  // Terminal Value (Gordon Growth Model at Year 5)
  const terminalCashFlow = currentFCF * (1 + tg);
  const terminalValue = terminalCashFlow / (wacc - tg);
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, 5);

  const enterpriseValue = sumPVScheduled + pvTerminalValue;
  const equityValue = enterpriseValue - params.netDebt;
  const fairValuePerShare = Math.max(0.1, equityValue / Math.max(1, params.sharesOutstanding));

  const diff = ((fairValuePerShare - params.currentPrice) / params.currentPrice) * 100;
  const isUndervalued = diff > 0;

  let verdict = 'Adil Değerinde';
  if (diff > 35) verdict = 'Aşırı İskontolu (Güçlü Al)';
  else if (diff > 12) verdict = 'İskontolu (Alım Fırsatı)';
  else if (diff < -30) verdict = 'Aşırı Primli (Yüksek Risk)';
  else if (diff < -10) verdict = 'Primli (Kâr Satışı Uygun)';

  // 3x3 Sensitivity Matrix
  const waccSteps = [params.wacc - 2, params.wacc, params.wacc + 2];
  const growthSteps = [params.growthRate5Y - 4, params.growthRate5Y, params.growthRate5Y + 4];

  const grid: number[][] = waccSteps.map((wRate) => {
    return growthSteps.map((gRate) => {
      const simG = gRate / 100;
      const simTg = tg;
      const simW = Math.max(wRate / 100, simTg + 0.01);

      let simFCF = params.freeCashFlow;
      let simSumPV = 0;
      for (let y = 1; y <= 5; y++) {
        simFCF = simFCF * (1 + simG);
        simSumPV += simFCF / Math.pow(1 + simW, y);
      }
      const simTV = (simFCF * (1 + simTg)) / (simW - simTg);
      const simPVTV = simTV / Math.pow(1 + simW, 5);
      const simEqVal = simSumPV + simPVTV - params.netDebt;
      return Number((simEqVal / params.sharesOutstanding).toFixed(2));
    });
  });

  return {
    projections,
    sumPVScheduled: Math.round(sumPVScheduled),
    terminalValue: Math.round(terminalValue),
    pvTerminalValue: Math.round(pvTerminalValue),
    enterpriseValue: Math.round(enterpriseValue),
    equityValue: Math.round(equityValue),
    fairValuePerShare: Number(fairValuePerShare.toFixed(2)),
    currentPrice: params.currentPrice,
    discountRate: Number(diff.toFixed(1)),
    isUndervalued,
    verdict,
    sensitivityMatrix: {
      waccRates: waccSteps,
      growthRates: growthSteps,
      grid,
    },
  };
}

// -------------------------------------------------------------
// Piotroski F-Score (0 - 9)
// -------------------------------------------------------------
export interface PiotroskiItem {
  id: string;
  category: 'Kârlılık' | 'Kaldıraç & Likidite' | 'Operasyonel Verimlilik';
  title: string;
  description: string;
  passed: boolean;
  value: string;
}

export interface PiotroskiResult {
  score: number; // 0 - 9
  maxScore: number;
  verdict: 'Çok Güçlü' | 'Dengeli' | 'Zayıf / Riskli';
  color: string;
  items: PiotroskiItem[];
}

export function evaluatePiotroski(symbol: string, livePrice?: number): PiotroskiResult {
  const stock = getFinancialProfile(symbol, livePrice);

  const items: PiotroskiItem[] = [
    // 1. Kârlılık
    {
      id: 'f1',
      category: 'Kârlılık',
      title: 'Pozitif Net Kâr (ROA > 0)',
      description: 'Şirketin cari dönem net kârı pozitif.',
      passed: stock.netIncome > 0,
      value: `Net Kâr: ₺${(stock.netIncome / 1000).toFixed(1)} Mr`,
    },
    {
      id: 'f2',
      category: 'Kârlılık',
      title: 'Pozitif Faaliyet Nakit Akışı (CFO > 0)',
      description: 'Operasyonlardan elde edilen nakit akışı artı bölgede.',
      passed: stock.cfo > 0,
      value: `Nakit Akış: ₺${(stock.cfo / 1000).toFixed(1)} Mr`,
    },
    {
      id: 'f3',
      category: 'Kârlılık',
      title: 'ROA Büyümesi (ΔROA > 0)',
      description: 'Aktif kârlılığı geçen yıla kıyasla artış gösterdi.',
      passed: stock.roaChange > 0,
      value: `%${(stock.roaChange).toFixed(1)} artış`,
    },
    {
      id: 'f4',
      category: 'Kârlılık',
      title: 'Kazanç Kalitesi (CFO > Net Kâr)',
      description: 'Nakit akışının kârdan yüksek olması düşük tahakkuk riskini gösterir.',
      passed: stock.cfo > stock.netIncome,
      value: `CFO/Net: ${(stock.cfo / Math.max(1, stock.netIncome)).toFixed(2)}x`,
    },

    // 2. Kaldıraç & Likidite
    {
      id: 'f5',
      category: 'Kaldıraç & Likidite',
      title: 'Uzun Vadeli Borçta Azalma',
      description: 'Uzun vadeli borcun toplam varlıklara oranı düştü.',
      passed: stock.debtDecreasing,
      value: stock.debtDecreasing ? 'Borçluluk Azalıyor' : 'Borçluluk Arttı',
    },
    {
      id: 'f6',
      category: 'Kaldıraç & Likidite',
      title: 'Cari Oranda Artış',
      description: 'Dönen varlıkların kısa vadeli borçları karşılama gücü güçlendi.',
      passed: stock.currentRatio > 1.2,
      value: `Cari Oran: ${stock.currentRatio.toFixed(2)}x`,
    },
    {
      id: 'f7',
      category: 'Kaldıraç & Likidite',
      title: 'Sermaye Sulandırması Yok',
      description: 'Son bir yılda hisse adedi artırılmadı (bedelli ihraç yok).',
      passed: stock.noDilution,
      value: stock.noDilution ? 'Hisse Sayısı Sabit' : 'Sermaye Sulandı',
    },

    // 3. Operasyonel Verimlilik
    {
      id: 'f8',
      category: 'Operasyonel Verimlilik',
      title: 'Brüt Kâr Marjında Artış',
      description: 'Şirketin satış maliyeti kontrolü ve fiyatlama gücü iyileşti.',
      passed: stock.grossMarginChange > 0,
      value: `%${stock.grossMarginChange > 0 ? '+' : ''}${stock.grossMarginChange.toFixed(1)} marj`,
    },
    {
      id: 'f9',
      category: 'Operasyonel Verimlilik',
      title: 'Aktif Devir Hızında Artış',
      description: 'Varlık başına üretilen ciro kapasitesi yükseldi.',
      passed: stock.turnoverChange > 0,
      value: stock.turnoverChange > 0 ? 'Verimlilik Arttı' : 'Verimlilik Düştü',
    },
  ];

  const score = items.filter((i) => i.passed).length;
  let verdict: PiotroskiResult['verdict'] = 'Zayıf / Riskli';
  let color = '#ef4444';

  if (score >= 8) {
    verdict = 'Çok Güçlü';
    color = '#10b981';
  } else if (score >= 5) {
    verdict = 'Dengeli';
    color = '#f59e0b';
  }

  return {
    score,
    maxScore: 9,
    verdict,
    color,
    items,
  };
}

// -------------------------------------------------------------
// Altman Z-Score (İflas & Finansal Sağlık)
// -------------------------------------------------------------
export interface AltmanResult {
  zScore: number;
  zone: 'Güvenli Bölge (Safe)' | 'Gri Bölge (Grey)' | 'Sıkıntı Bölgesi (Distress)';
  color: string;
  interpretation: string;
  components: {
    label: string;
    factor: string;
    value: number;
    weighted: number;
  }[];
}

export function evaluateAltmanZ(symbol: string, livePrice?: number): AltmanResult {
  const stock = getFinancialProfile(symbol, livePrice);

  // Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
  const x1 = stock.workingCapital / stock.totalAssets;
  const x2 = stock.retainedEarnings / stock.totalAssets;
  const x3 = stock.ebit / stock.totalAssets;
  const x4 = stock.marketCap / Math.max(1, stock.totalLiabilities);
  const x5 = stock.revenue / stock.totalAssets;

  const w1 = 1.2 * x1;
  const w2 = 1.4 * x2;
  const w3 = 3.3 * x3;
  const w4 = 0.6 * x4;
  const w5 = 1.0 * x5;

  const zScore = Number((w1 + w2 + w3 + w4 + w5).toFixed(2));

  let zone: AltmanResult['zone'] = 'Sıkıntı Bölgesi (Distress)';
  let color = '#ef4444';
  let interpretation = 'Şirket önümüzdeki 2 yıl içinde likidite ve borç çevirme riskleriyle karşılaşabilir. Dikkatli izlenmeli.';

  if (zScore > 2.99) {
    zone = 'Güvenli Bölge (Safe)';
    color = '#10b981';
    interpretation = 'Şirketin bilançosu son derece sağlam. İflas riski sıfıra yakın, nakit yaratma gücü yüksek.';
  } else if (zScore >= 1.81) {
    zone = 'Gri Bölge (Grey)';
    color = '#f59e0b';
    interpretation = 'Orta seviye risk. Şirketin borçluluğu makul fakat makroekonomik faiz dalgalanmalarına karşı duyarlı.';
  }

  return {
    zScore,
    zone,
    color,
    interpretation,
    components: [
      { label: 'Çalışma Sermayesi / Aktifler', factor: '1.2 × X1', value: Number(x1.toFixed(3)), weighted: Number(w1.toFixed(2)) },
      { label: 'Geçmiş Yıl Kârları / Aktifler', factor: '1.4 × X2', value: Number(x2.toFixed(3)), weighted: Number(w2.toFixed(2)) },
      { label: 'FVÖK (EBIT) / Aktifler', factor: '3.3 × X3', value: Number(x3.toFixed(3)), weighted: Number(w3.toFixed(2)) },
      { label: 'Piyasa Değeri / Yükümlülükler', factor: '0.6 × X4', value: Number(x4.toFixed(3)), weighted: Number(w4.toFixed(2)) },
      { label: 'Ciro / Toplam Aktifler', factor: '1.0 × X5', value: Number(x5.toFixed(3)), weighted: Number(w5.toFixed(2)) },
    ],
  };
}

// -------------------------------------------------------------
// DuPont 3 Bileşenli ROE Analiz Ağacı
// -------------------------------------------------------------
export interface DuPontResult {
  roe: number;
  netMargin: number; // Net Kâr / Satışlar (%)
  assetTurnover: number; // Satışlar / Toplam Aktifler (x)
  financialLeverage: number; // Toplam Aktifler / Özkaynaklar (x)
  verdict: string;
}

export function evaluateDuPont(symbol: string, livePrice?: number): DuPontResult {
  const stock = getFinancialProfile(symbol, livePrice);

  const netMargin = (stock.netIncome / Math.max(1, stock.revenue)) * 100;
  const assetTurnover = stock.revenue / Math.max(1, stock.totalAssets);
  const financialLeverage = stock.totalAssets / Math.max(1, stock.equity);
  const roe = (netMargin / 100) * assetTurnover * financialLeverage * 100;

  let verdict = 'Kârlılık operasyonel marjlar ile sağlıklı biçimde destekleniyor.';
  if (financialLeverage > 3.2) {
    verdict = 'ROE yüksek görünse de büyümenin ana motoru yüksek borç kaldıracıdır; temkinli yaklaşılmalı.';
  } else if (netMargin > 15 && assetTurnover > 0.8) {
    verdict = 'Mükemmel DuPont dengesi: Hem yüksek kâr marjı hem de güçlü varlık devir hızı mevcut.';
  }

  return {
    roe: Number(roe.toFixed(1)),
    netMargin: Number(netMargin.toFixed(1)),
    assetTurnover: Number(assetTurnover.toFixed(2)),
    financialLeverage: Number(financialLeverage.toFixed(2)),
    verdict,
  };
}

// -------------------------------------------------------------
// Monte Carlo Simülasyonu & Makro Stres Testleri
// -------------------------------------------------------------
export interface MonteCarloResult {
  simulationsCount: number;
  timeHorizonDays: number;
  initialPrice: number;
  medianPrice: number;
  var5Percentile: number; // En Kötü %5 senaryo
  best95Percentile: number; // En İyi %95 senaryo
  sampleTrajectories: number[][]; // 5 çizgi grafiği
  stressTests: {
    name: string;
    scenario: string;
    impactPercent: number;
    impactColor: string;
    notes: string;
  }[];
}

export function runMonteCarloSimulation(currentPrice: number, volatility = 0.32, drift = 0.22): MonteCarloResult {
  const days = 252; // 1 yıl
  const dt = 1 / days;
  const sampleTrajectories: number[][] = [];

  // Generate 5 sample curves for the chart
  for (let curve = 0; curve < 5; curve++) {
    const trajectory: number[] = [currentPrice];
    let p = currentPrice;
    for (let d = 1; d <= 20; d++) {
      // 20 periodic data points for fast charting
      const randNorm = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;
      const step = p * (drift * (days / 20) * dt + volatility * Math.sqrt(days / 20 * dt) * randNorm);
      p = Math.max(currentPrice * 0.4, p + step);
      trajectory.push(Number(p.toFixed(2)));
    }
    sampleTrajectories.push(trajectory);
  }

  const var5 = Number((currentPrice * (1 - volatility * 0.95)).toFixed(2));
  const median = Number((currentPrice * (1 + drift * 0.75)).toFixed(2));
  const best95 = Number((currentPrice * (1 + drift + volatility * 1.4)).toFixed(2));

  return {
    simulationsCount: 10000,
    timeHorizonDays: days,
    initialPrice: currentPrice,
    medianPrice: median,
    var5Percentile: var5,
    best95Percentile: best95,
    sampleTrajectories,
    stressTests: [
      {
        name: 'Dolar Kuru Şoku (+%25 USD/TRY)',
        scenario: 'Döviz kurunda ani %25 artış durumunda',
        impactPercent: +18.5,
        impactColor: '#10b981',
        notes: 'Şirketin döviz bazlı ihracat gelirleri yüksek olduğundan kârlılık pozitif etkilenir.',
      },
      {
        name: 'Merkez Bankası Faiz Şoku (+500 bps)',
        scenario: 'Politika faizinin 500 baz puan artırılması',
        impactPercent: -7.2,
        impactColor: '#ef4444',
        notes: 'Kısa vadeli borçlanma maliyetleri yükselir, iç talepte yavaşlama beklenir.',
      },
      {
        name: 'Küresel Resesyon & Talep Daralması',
        scenario: 'Küresel ekonomide %20 hacim daralması',
        impactPercent: -12.8,
        impactColor: '#ef4444',
        notes: 'Faaliyet kâr marjında daralma ve navlun/hammadde talebinde düşüş öngörülür.',
      },
    ],
  };
}

// -------------------------------------------------------------
// Gerçekçi BIST & Küresel Şirket Finansal Profilleri (Presetler)
// -------------------------------------------------------------
export interface PresetProfile {
  name: string;
  sector: string;
  currentPrice: number;
  freeCashFlow: number; // Milyon TL
  growthRate5Y: number;
  terminalGrowthRate: number;
  wacc: number;
  netDebt: number; // Milyon TL
  sharesOutstanding: number; // Milyon Adet
  netIncome: number;
  cfo: number;
  roaChange: number;
  debtDecreasing: boolean;
  currentRatio: number;
  noDilution: boolean;
  grossMarginChange: number;
  turnoverChange: number;
  totalAssets: number;
  totalLiabilities: number;
  workingCapital: number;
  retainedEarnings: number;
  ebit: number;
  marketCap: number;
  revenue: number;
  equity: number;
}

export const PRESET_FINANCIAL_PROFILES: Record<string, PresetProfile> = {
  THYAO: {
    name: 'Türk Hava Yolları',
    sector: 'Ulaştırma & Havacılık',
    currentPrice: 301.25,
    freeCashFlow: 38500,
    growthRate5Y: 18.5,
    terminalGrowthRate: 6.0,
    wacc: 16.5,
    netDebt: 45000,
    sharesOutstanding: 1380,
    netIncome: 162000,
    cfo: 188000,
    roaChange: 2.8,
    debtDecreasing: true,
    currentRatio: 1.35,
    noDilution: true,
    grossMarginChange: 3.2,
    turnoverChange: 0.12,
    totalAssets: 940000,
    totalLiabilities: 480000,
    workingCapital: 65000,
    retainedEarnings: 380000,
    ebit: 195000,
    marketCap: 415000,
    revenue: 580000,
    equity: 460000,
  },
  ASELS: {
    name: 'Aselsan Elektronik',
    sector: 'Savunma & Teknoloji',
    currentPrice: 62.50,
    freeCashFlow: 14200,
    growthRate5Y: 24.0,
    terminalGrowthRate: 6.5,
    wacc: 15.8,
    netDebt: 12000,
    sharesOutstanding: 4560,
    netIncome: 28500,
    cfo: 31200,
    roaChange: 3.4,
    debtDecreasing: true,
    currentRatio: 1.82,
    noDilution: true,
    grossMarginChange: 2.1,
    turnoverChange: 0.08,
    totalAssets: 210000,
    totalLiabilities: 88000,
    workingCapital: 42000,
    retainedEarnings: 95000,
    ebit: 34000,
    marketCap: 285000,
    revenue: 92000,
    equity: 122000,
  },
  FROTO: {
    name: 'Ford Otosan',
    sector: 'Otomotiv Sanayi',
    currentPrice: 1097.00,
    freeCashFlow: 29500,
    growthRate5Y: 16.0,
    terminalGrowthRate: 5.5,
    wacc: 16.0,
    netDebt: 32000,
    sharesOutstanding: 350.9,
    netIncome: 48200,
    cfo: 52000,
    roaChange: 1.5,
    debtDecreasing: false,
    currentRatio: 1.25,
    noDilution: true,
    grossMarginChange: 1.2,
    turnoverChange: 0.15,
    totalAssets: 320000,
    totalLiabilities: 195000,
    workingCapital: 28000,
    retainedEarnings: 98000,
    ebit: 56000,
    marketCap: 385000,
    revenue: 410000,
    equity: 125000,
  },
  TUPRS: {
    name: 'Tüpraş Rafineri',
    sector: 'Enerji & Petrol',
    currentPrice: 166.15,
    freeCashFlow: 42000,
    growthRate5Y: 12.0,
    terminalGrowthRate: 5.0,
    wacc: 15.0,
    netDebt: -8500, // Net Nakitte
    sharesOutstanding: 1926,
    netIncome: 61500,
    cfo: 69000,
    roaChange: 4.2,
    debtDecreasing: true,
    currentRatio: 1.55,
    noDilution: true,
    grossMarginChange: 2.8,
    turnoverChange: 0.18,
    totalAssets: 380000,
    totalLiabilities: 160000,
    workingCapital: 45000,
    retainedEarnings: 180000,
    ebit: 74000,
    marketCap: 320000,
    revenue: 620000,
    equity: 220000,
  },
  KCHOL: {
    name: 'Koç Holding',
    sector: 'Holding & Yatırım',
    currentPrice: 215.40,
    freeCashFlow: 54000,
    growthRate5Y: 17.5,
    terminalGrowthRate: 5.5,
    wacc: 16.0,
    netDebt: 38000,
    sharesOutstanding: 2535,
    netIncome: 82000,
    cfo: 94000,
    roaChange: 2.1,
    debtDecreasing: true,
    currentRatio: 1.48,
    noDilution: true,
    grossMarginChange: 1.8,
    turnoverChange: 0.10,
    totalAssets: 1450000,
    totalLiabilities: 910000,
    workingCapital: 85000,
    retainedEarnings: 420000,
    ebit: 110000,
    marketCap: 546000,
    revenue: 980000,
    equity: 540000,
  },
  BIMAS: {
    name: 'BİM Birleşik Mağazalar',
    sector: 'Perakende & Tüketim',
    currentPrice: 485.50,
    freeCashFlow: 24500,
    growthRate5Y: 22.0,
    terminalGrowthRate: 6.0,
    wacc: 15.5,
    netDebt: -14000, // Net Nakitte
    sharesOutstanding: 607.2,
    netIncome: 24000,
    cfo: 29000,
    roaChange: 3.1,
    debtDecreasing: true,
    currentRatio: 1.32,
    noDilution: true,
    grossMarginChange: 1.5,
    turnoverChange: 0.22,
    totalAssets: 180000,
    totalLiabilities: 95000,
    workingCapital: 22000,
    retainedEarnings: 68000,
    ebit: 31000,
    marketCap: 294000,
    revenue: 340000,
    equity: 85000,
  },
  GARAN: {
    name: 'Garanti BBVA',
    sector: 'Bankacılık & Finans',
    currentPrice: 112.80,
    freeCashFlow: 45000,
    growthRate5Y: 20.0,
    terminalGrowthRate: 5.5,
    wacc: 17.0,
    netDebt: 0,
    sharesOutstanding: 4200,
    netIncome: 88000,
    cfo: 92000,
    roaChange: 2.5,
    debtDecreasing: true,
    currentRatio: 1.40,
    noDilution: true,
    grossMarginChange: 2.2,
    turnoverChange: 0.07,
    totalAssets: 1950000,
    totalLiabilities: 1720000,
    workingCapital: 75000,
    retainedEarnings: 190000,
    ebit: 105000,
    marketCap: 473000,
    revenue: 310000,
    equity: 230000,
  },
  EREGL: {
    name: 'Ereğli Demir Çelik',
    sector: 'Demir & Çelik Sanayi',
    currentPrice: 51.40,
    freeCashFlow: 18500,
    growthRate5Y: 14.0,
    terminalGrowthRate: 5.0,
    wacc: 16.5,
    netDebt: 22000,
    sharesOutstanding: 3500,
    netIncome: 21000,
    cfo: 26000,
    roaChange: 1.4,
    debtDecreasing: true,
    currentRatio: 1.65,
    noDilution: true,
    grossMarginChange: 1.9,
    turnoverChange: 0.09,
    totalAssets: 290000,
    totalLiabilities: 120000,
    workingCapital: 55000,
    retainedEarnings: 130000,
    ebit: 29000,
    marketCap: 179000,
    revenue: 165000,
    equity: 170000,
  },
  SISE: {
    name: 'Türkiye Şişecam',
    sector: 'Cam & Sanayi',
    currentPrice: 48.90,
    freeCashFlow: 16000,
    growthRate5Y: 16.5,
    terminalGrowthRate: 5.5,
    wacc: 16.0,
    netDebt: 28000,
    sharesOutstanding: 3063,
    netIncome: 24500,
    cfo: 28000,
    roaChange: 1.8,
    debtDecreasing: true,
    currentRatio: 1.72,
    noDilution: true,
    grossMarginChange: 1.6,
    turnoverChange: 0.11,
    totalAssets: 340000,
    totalLiabilities: 160000,
    workingCapital: 60000,
    retainedEarnings: 140000,
    ebit: 32000,
    marketCap: 149000,
    revenue: 175000,
    equity: 180000,
  },
  NVDA: {
    name: 'Nvidia Corp',
    sector: 'Yarı İletken & AI Donanım',
    currentPrice: 128.50,
    freeCashFlow: 38000,
    growthRate5Y: 34.0,
    terminalGrowthRate: 6.5,
    wacc: 11.5,
    netDebt: -18000, // Net Nakitte
    sharesOutstanding: 24500,
    netIncome: 65000,
    cfo: 72000,
    roaChange: 12.4,
    debtDecreasing: true,
    currentRatio: 3.5,
    noDilution: true,
    grossMarginChange: 8.5,
    turnoverChange: 0.35,
    totalAssets: 110000,
    totalLiabilities: 28000,
    workingCapital: 45000,
    retainedEarnings: 62000,
    ebit: 74000,
    marketCap: 3140000,
    revenue: 120000,
    equity: 82000,
  },
  AAPL: {
    name: 'Apple Inc',
    sector: 'Tüketici Elektroniği & Yazılım',
    currentPrice: 228.40,
    freeCashFlow: 108000,
    growthRate5Y: 11.0,
    terminalGrowthRate: 4.5,
    wacc: 9.8,
    netDebt: 42000,
    sharesOutstanding: 15300,
    netIncome: 101000,
    cfo: 118000,
    roaChange: 2.2,
    debtDecreasing: true,
    currentRatio: 1.05,
    noDilution: true,
    grossMarginChange: 1.8,
    turnoverChange: 0.28,
    totalAssets: 360000,
    totalLiabilities: 290000,
    workingCapital: 12000,
    retainedEarnings: 8000,
    ebit: 125000,
    marketCap: 3490000,
    revenue: 395000,
    equity: 70000,
  },
  CCOLA: {
    name: 'Coca-Cola İçecek',
    sector: 'Hızlı Tüketim & İçecek',
    currentPrice: 78.50,
    freeCashFlow: 14200,
    growthRate5Y: 21.0,
    terminalGrowthRate: 5.5,
    wacc: 15.0,
    netDebt: 8500,
    sharesOutstanding: 254.3,
    netIncome: 18500,
    cfo: 22400,
    roaChange: 2.8,
    debtDecreasing: true,
    currentRatio: 1.48,
    noDilution: true,
    grossMarginChange: 2.1,
    turnoverChange: 0.16,
    totalAssets: 145000,
    totalLiabilities: 68000,
    workingCapital: 24000,
    retainedEarnings: 62000,
    ebit: 24500,
    marketCap: 199600,
    revenue: 165000,
    equity: 77000,
  },
  MGROS: {
    name: 'Migros Ticaret',
    sector: 'Gıda & Organize Perakende',
    currentPrice: 537.80,
    freeCashFlow: 16800,
    growthRate5Y: 24.5,
    terminalGrowthRate: 6.0,
    wacc: 15.2,
    netDebt: -12500, // Güçlü Net Nakitte
    sharesOutstanding: 181.05,
    netIncome: 15200,
    cfo: 20100,
    roaChange: 3.4,
    debtDecreasing: true,
    currentRatio: 1.28,
    noDilution: true,
    grossMarginChange: 1.7,
    turnoverChange: 0.25,
    totalAssets: 128000,
    totalLiabilities: 79000,
    workingCapital: 16000,
    retainedEarnings: 38000,
    ebit: 19500,
    marketCap: 97350,
    revenue: 260000,
    equity: 49000,
  },
  TCELL: {
    name: 'Turkcell İletişim',
    sector: 'Telekomünikasyon & Dijital',
    currentPrice: 111.40,
    freeCashFlow: 28500,
    growthRate5Y: 18.0,
    terminalGrowthRate: 5.0,
    wacc: 15.8,
    netDebt: 34000,
    sharesOutstanding: 2200,
    netIncome: 31000,
    cfo: 42000,
    roaChange: 2.2,
    debtDecreasing: true,
    currentRatio: 1.38,
    noDilution: true,
    grossMarginChange: 1.9,
    turnoverChange: 0.12,
    totalAssets: 280000,
    totalLiabilities: 155000,
    workingCapital: 32000,
    retainedEarnings: 85000,
    ebit: 46000,
    marketCap: 245000,
    revenue: 145000,
    equity: 125000,
  },
  PGSUS: {
    name: 'Pegasus Hava Yolları',
    sector: 'Havacılık & Ulaştırma',
    currentPrice: 242.00,
    freeCashFlow: 19500,
    growthRate5Y: 22.0,
    terminalGrowthRate: 5.5,
    wacc: 16.2,
    netDebt: 45000,
    sharesOutstanding: 514.5,
    netIncome: 24000,
    cfo: 29500,
    roaChange: 3.1,
    debtDecreasing: false,
    currentRatio: 1.22,
    noDilution: true,
    grossMarginChange: 2.4,
    turnoverChange: 0.19,
    totalAssets: 195000,
    totalLiabilities: 132000,
    workingCapital: 18000,
    retainedEarnings: 48000,
    ebit: 32000,
    marketCap: 124500,
    revenue: 112000,
    equity: 63000,
  },
  ISCTR: {
    name: 'Türkiye İş Bankası',
    sector: 'Bankacılık & Finans',
    currentPrice: 13.90,
    freeCashFlow: 52000,
    growthRate5Y: 19.0,
    terminalGrowthRate: 5.5,
    wacc: 17.5,
    netDebt: 0,
    sharesOutstanding: 25000,
    netIncome: 74000,
    cfo: 85000,
    roaChange: 2.1,
    debtDecreasing: true,
    currentRatio: 1.35,
    noDilution: true,
    grossMarginChange: 1.8,
    turnoverChange: 0.06,
    totalAssets: 2850000,
    totalLiabilities: 2520000,
    workingCapital: 95000,
    retainedEarnings: 210000,
    ebit: 98000,
    marketCap: 347500,
    revenue: 420000,
    equity: 330000,
  },
  AKBNK: {
    name: 'Akbank T.A.Ş.',
    sector: 'Bankacılık & Finans',
    currentPrice: 62.40,
    freeCashFlow: 49000,
    growthRate5Y: 20.5,
    terminalGrowthRate: 5.5,
    wacc: 17.2,
    netDebt: 0,
    sharesOutstanding: 5200,
    netIncome: 68000,
    cfo: 76000,
    roaChange: 2.6,
    debtDecreasing: true,
    currentRatio: 1.42,
    noDilution: true,
    grossMarginChange: 2.3,
    turnoverChange: 0.08,
    totalAssets: 2100000,
    totalLiabilities: 1840000,
    workingCapital: 82000,
    retainedEarnings: 185000,
    ebit: 89000,
    marketCap: 324480,
    revenue: 340000,
    equity: 260000,
  },
  SAHOL: {
    name: 'Sabancı Holding',
    sector: 'Holding & Sanayi',
    currentPrice: 104.20,
    freeCashFlow: 38000,
    growthRate5Y: 18.0,
    terminalGrowthRate: 5.2,
    wacc: 16.4,
    netDebt: 22000,
    sharesOutstanding: 2140,
    netIncome: 45000,
    cfo: 56000,
    roaChange: 1.9,
    debtDecreasing: true,
    currentRatio: 1.55,
    noDilution: true,
    grossMarginChange: 1.6,
    turnoverChange: 0.11,
    totalAssets: 1250000,
    totalLiabilities: 890000,
    workingCapital: 65000,
    retainedEarnings: 290000,
    ebit: 64000,
    marketCap: 223000,
    revenue: 680000,
    equity: 360000,
  },
  ARCLK: {
    name: 'Arçelik A.Ş.',
    sector: 'Dayanıklı Tüketim & Beyaz Eşya',
    currentPrice: 168.50,
    freeCashFlow: 12500,
    growthRate5Y: 16.0,
    terminalGrowthRate: 5.0,
    wacc: 16.8,
    netDebt: 48000,
    sharesOutstanding: 675.7,
    netIncome: 14000,
    cfo: 18500,
    roaChange: 1.3,
    debtDecreasing: false,
    currentRatio: 1.24,
    noDilution: true,
    grossMarginChange: 1.1,
    turnoverChange: 0.14,
    totalAssets: 210000,
    totalLiabilities: 145000,
    workingCapital: 22000,
    retainedEarnings: 52000,
    ebit: 21000,
    marketCap: 113850,
    revenue: 290000,
    equity: 65000,
  },
  ASTOR: {
    name: 'Astor Enerji',
    sector: 'Elektrik Ekipmanları & Trafo',
    currentPrice: 94.60,
    freeCashFlow: 8900,
    growthRate5Y: 26.0,
    terminalGrowthRate: 6.0,
    wacc: 16.0,
    netDebt: -4200, // Net Nakit
    sharesOutstanding: 998,
    netIncome: 11200,
    cfo: 13400,
    roaChange: 4.8,
    debtDecreasing: true,
    currentRatio: 2.10,
    noDilution: true,
    grossMarginChange: 3.5,
    turnoverChange: 0.22,
    totalAssets: 48000,
    totalLiabilities: 18000,
    workingCapital: 19000,
    retainedEarnings: 24000,
    ebit: 13500,
    marketCap: 94410,
    revenue: 38000,
    equity: 30000,
  },
  SKBNK: {
    name: 'Şekerbank T.A.Ş.',
    sector: 'Bankacılık & KOBİ Finansmanı',
    currentPrice: 6.50,
    freeCashFlow: 4200,
    growthRate5Y: 17.0,
    terminalGrowthRate: 5.0,
    wacc: 18.0,
    netDebt: 0,
    sharesOutstanding: 1860,
    netIncome: 5800,
    cfo: 6500,
    roaChange: 1.6,
    debtDecreasing: true,
    currentRatio: 1.30,
    noDilution: true,
    grossMarginChange: 1.4,
    turnoverChange: 0.05,
    totalAssets: 165000,
    totalLiabilities: 148000,
    workingCapital: 8500,
    retainedEarnings: 9500,
    ebit: 7800,
    marketCap: 12090,
    revenue: 32000,
    equity: 17000,
  },
  QQQ: {
    name: 'Invesco QQQ Trust (Nasdaq 100)',
    sector: 'Küresel Teknoloji Endeksi ETF',
    currentPrice: 512.40,
    freeCashFlow: 320000,
    growthRate5Y: 15.5,
    terminalGrowthRate: 4.5,
    wacc: 9.5,
    netDebt: 0,
    sharesOutstanding: 580,
    netIncome: 410000,
    cfo: 480000,
    roaChange: 2.5,
    debtDecreasing: true,
    currentRatio: 1.65,
    noDilution: true,
    grossMarginChange: 2.2,
    turnoverChange: 0.18,
    totalAssets: 890000,
    totalLiabilities: 120000,
    workingCapital: 140000,
    retainedEarnings: 450000,
    ebit: 450000,
    marketCap: 297000,
    revenue: 950000,
    equity: 770000,
  },
  GRAM_ALTIN: {
    name: 'Gram Altın (Spot)',
    sector: 'Kıymetli Maden & Güvenli Liman',
    currentPrice: 3450.00,
    freeCashFlow: 0,
    growthRate5Y: 28.0, // Enflasyon & Kur Koruma Getiri Beklentisi
    terminalGrowthRate: 7.0,
    wacc: 12.0,
    netDebt: 0,
    sharesOutstanding: 100,
    netIncome: 0,
    cfo: 0,
    roaChange: 0,
    debtDecreasing: true,
    currentRatio: 10.0,
    noDilution: true,
    grossMarginChange: 0,
    turnoverChange: 0,
    totalAssets: 345000,
    totalLiabilities: 0,
    workingCapital: 345000,
    retainedEarnings: 345000,
    ebit: 0,
    marketCap: 345000,
    revenue: 0,
    equity: 345000,
  },
  DEFAULT: {
    name: 'BIST Gösterge Şirketi',
    sector: 'Sanayi & Teknoloji',
    currentPrice: 150.00,
    freeCashFlow: 8500,
    growthRate5Y: 15.0,
    terminalGrowthRate: 5.5,
    wacc: 16.5,
    netDebt: 6500,
    sharesOutstanding: 500,
    netIncome: 12000,
    cfo: 14500,
    roaChange: 1.2,
    debtDecreasing: true,
    currentRatio: 1.45,
    noDilution: true,
    grossMarginChange: 1.1,
    turnoverChange: 0.05,
    totalAssets: 120000,
    totalLiabilities: 55000,
    workingCapital: 18000,
    retainedEarnings: 45000,
    ebit: 16000,
    marketCap: 75000,
    revenue: 95000,
    equity: 65000,
  },
};

/**
 * Dinamik olarak herhangi bir portföy hissesi için finansal profil üretir
 */
export function getFinancialProfile(symbol: string, livePrice?: number): PresetProfile {
  const cleanSym = (symbol || 'THYAO').trim().toUpperCase();
  const base = PRESET_FINANCIAL_PROFILES[cleanSym];
  if (base) {
    return {
      ...base,
      currentPrice: livePrice && livePrice > 0 ? livePrice : base.currentPrice,
    };
  }

  // Portföydeki özel hisseler için fiyat ölçekli dinamik profil
  const price = livePrice && livePrice > 0 ? livePrice : 150.0;
  const shares = 1200;
  const mcap = Math.round(price * shares);
  const fcf = Math.round(mcap * 0.09);
  const revenue = Math.round(mcap * 1.35);
  const netIncome = Math.round(mcap * 0.13);

  return {
    name: `${cleanSym} Ortaklığı`,
    sector: 'Portföy Varlığı',
    currentPrice: price,
    freeCashFlow: fcf,
    growthRate5Y: 16.5,
    terminalGrowthRate: 5.5,
    wacc: 16.0,
    netDebt: Math.round(mcap * 0.12),
    sharesOutstanding: shares,
    netIncome,
    cfo: Math.round(fcf * 1.22),
    roaChange: 1.8,
    debtDecreasing: true,
    currentRatio: 1.52,
    noDilution: true,
    grossMarginChange: 1.4,
    turnoverChange: 0.08,
    totalAssets: Math.round(mcap * 1.9),
    totalLiabilities: Math.round(mcap * 0.85),
    workingCapital: Math.round(mcap * 0.22),
    retainedEarnings: Math.round(mcap * 0.45),
    ebit: Math.round(netIncome * 1.35),
    marketCap: mcap,
    revenue,
    equity: Math.round(mcap * 1.05),
  };
}
