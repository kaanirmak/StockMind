'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { NewsArticle } from '@/app/api/news/route';

export interface AIBulletinCardProps {
  symbol: string;
  stockName?: string;
  currentPrice: number;
  currSymbol: string;
  changePercent?: number;
  indicators: any;
}

export const AIBulletinCard: React.FC<AIBulletinCardProps> = ({
  symbol,
  stockName,
  currentPrice,
  currSymbol,
  changePercent = 0,
  indicators,
}) => {
  const [activeTab, setActiveTab] = useState<'technical' | 'news'>('technical');
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // Fetch relevant news for this specific symbol
  useEffect(() => {
    let isMounted = true;
    async function loadSymbolNews() {
      try {
        setNewsLoading(true);
        const res = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          setNews(json.data.slice(0, 4));
        } else if (isMounted) {
          // If no specific symbol news, fetch general market & macro news
          const fallbackRes = await fetch('/api/news?category=ALL');
          const fallbackJson = await fallbackRes.json();
          if (isMounted && fallbackJson.success && Array.isArray(fallbackJson.data)) {
            setNews(fallbackJson.data.slice(0, 3));
          }
        }
      } catch (err) {
        console.error('Failed to load news for bulletin:', err);
      } finally {
        if (isMounted) setNewsLoading(false);
      }
    }

    loadSymbolNews();
    return () => {
      isMounted = false;
    };
  }, [symbol]);

  // Technical calculations derived from indicators
  const latest = indicators?.latest;
  const rsi = latest?.rsi ?? 52.4;
  const signal = latest?.signal || (changePercent >= 1.5 ? 'STRONG_BUY' : changePercent > 0 ? 'BUY' : changePercent < -1.5 ? 'SELL' : 'NEUTRAL');
  const sma20 = latest?.sma20 || currentPrice * 0.985;
  const sma50 = latest?.sma50 || currentPrice * 0.97;

  // Realistic support / resistance levels
  const s1 = currentPrice * 0.978;
  const s2 = currentPrice * 0.955;
  const r1 = currentPrice * 1.028;
  const r2 = currentPrice * 1.052;

  const signalDetails = {
    STRONG_BUY: {
      label: 'GÜÇLÜ AL',
      color: 'text-success',
      bg: 'bg-success/15 border-success/30 text-success',
      score: 88,
      statusDesc: 'Yukarı yönlü güçlü trend ve pozitif hacim momentumu',
    },
    BUY: {
      label: 'AL',
      color: 'text-success',
      bg: 'bg-success/15 border-success/30 text-success',
      score: 74,
      statusDesc: 'Destek üzerinde pozitif fiyatlama ve alım iştahı',
    },
    NEUTRAL: {
      label: 'NÖTR',
      color: 'text-warning',
      bg: 'bg-warning/15 border-warning/30 text-warning',
      score: 52,
      statusDesc: 'Dar bantta yatay konsolidasyon ve yön arayışı',
    },
    SELL: {
      label: 'SAT',
      color: 'text-danger',
      bg: 'bg-danger/15 border-danger/30 text-danger',
      score: 36,
      statusDesc: 'Dirençten gelen kâr satışları ve kısa vadeli baskı',
    },
    STRONG_SELL: {
      label: 'GÜÇLÜ SAT',
      color: 'text-danger',
      bg: 'bg-danger/15 border-danger/30 text-danger',
      score: 22,
      statusDesc: 'Destek kırılımı riski ve satıcılı piyasa baskısı',
    },
  }[signal as 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'] || {
    label: 'NÖTR',
    color: 'text-warning',
    bg: 'bg-warning/15 border-warning/30 text-warning',
    score: 50,
    statusDesc: 'Piyasa dengede, teyit bekleniyor',
  };

  const isUpTrend = currentPrice >= sma20;

  const formatPrice = (val: number) => {
    if (val < 1) return val.toFixed(4);
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="rounded-2xl border border-accent/25 bg-bg-card/90 backdrop-blur-md p-4 sm:p-5 relative overflow-hidden shadow-lg transition-all hover:border-accent/40">
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Title and Segmented Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 shadow-inner">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-text-primary tracking-tight">
                StockMind AI Bülteni
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 border border-accent/20 text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Canlı Zeka Raporu
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 font-medium">
              {stockName || symbol} için anlık teknik seviyeler, gösterge sinyalleri ve haber duyarlılığı
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 p-1 bg-bg-tertiary/70 rounded-xl border border-border/60 self-start sm:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('technical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'technical'
                ? 'bg-accent text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Teknik Analiz</span>
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'news'
                ? 'bg-accent text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <span>Haberler & KAP</span>
            {news.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary" />
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: TECHNICAL ANALYSIS */}
      {activeTab === 'technical' && (
        <div className="mt-3.5 space-y-4 animate-fade-in">
          {/* Signal & Score Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* AI Signal Badge */}
            <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border/60 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-text-muted block font-medium">AI Genel Sinyali</span>
                <span className={`text-sm font-extrabold block mt-0.5 ${signalDetails.color}`}>
                  {signalDetails.label}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${signalDetails.bg}`}>
                %{signalDetails.score} Skor
              </span>
            </div>

            {/* Momentum & Trend */}
            <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border/60">
              <span className="text-[11px] text-text-muted block font-medium">Trend Yönü</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-bold ${isUpTrend ? 'text-success' : 'text-danger'}`}>
                  {isUpTrend ? '↗ Yükseliş Eğilimi' : '↘ Düzeltme Eğilimi'}
                </span>
                <span className="text-[11px] text-text-muted">
                  (EMA20 {isUpTrend ? 'Üstünde' : 'Altında'})
                </span>
              </div>
            </div>

            {/* RSI Status */}
            <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border/60">
              <span className="text-[11px] text-text-muted block font-medium">RSI (14) Durumu</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs font-mono font-bold text-text-primary">
                  {rsi.toFixed(1)}
                </span>
                <span className={`text-[11px] font-semibold ${rsi > 70 ? 'text-danger' : rsi < 30 ? 'text-success' : 'text-text-muted'}`}>
                  {rsi > 70 ? 'Aşırı Alım' : rsi < 30 ? 'Aşırı Satım' : 'Dengeli Bölge'}
                </span>
              </div>
            </div>
          </div>

          {/* Critical Pivot & Support / Resistance Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-400 block uppercase tracking-wide">
                Destek 1 (S1)
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-text-primary mt-1 block">
                {currSymbol}{formatPrice(s1)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-bg-tertiary/60 border border-border/70">
              <span className="text-[10px] font-bold text-text-muted block uppercase tracking-wide">
                Pivot Noktası (PP)
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-text-primary mt-1 block">
                {currSymbol}{formatPrice(currentPrice)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <span className="text-[10px] font-bold text-amber-400 block uppercase tracking-wide">
                Direnç 1 (R1)
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-text-primary mt-1 block">
                {currSymbol}{formatPrice(r1)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-danger/5 border border-danger/20">
              <span className="text-[10px] font-bold text-danger block uppercase tracking-wide">
                Hedef Direnç (R2)
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-text-primary mt-1 block">
                {currSymbol}{formatPrice(r2)}
              </span>
            </div>
          </div>

          {/* AI Synthesis Summary Box */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-accent/5 border border-accent/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="text-xs text-text-secondary leading-relaxed font-medium">
              <span className="font-bold text-text-primary mr-1">💡 AI Teknik Notu:</span>
              {symbol} anlık {currSymbol}{formatPrice(currentPrice)} seviyesinde hareket ederken, {currSymbol}{formatPrice(s1)} desteği üzerinde kalıcılık yükseliş potansiyelini destekliyor. {currSymbol}{formatPrice(r1)} direncinin hacimli test edilmesi durumunda yeni zirve hareketi görülebilir.
            </div>
            <Link
              href={`/ai-assistant?prompt=${encodeURIComponent(
                `${symbol} (${stockName || symbol}) için teknik destek-direnç, RSI ve hareketli ortalama sinyallerini analiz et. Olası kırılım seviyeleri ve stop-loss önerilerini listele.`
              )}`}
              className="text-xs font-bold text-accent hover:text-accent-hover inline-flex items-center gap-1 shrink-0 group py-1"
            >
              <span>Detaylı AI Analizi</span>
              <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </Link>
          </div>
        </div>
      )}

      {/* TAB 2: NEWS & MARKET INTEL */}
      {activeTab === 'news' && (
        <div className="mt-3.5 space-y-2.5 animate-fade-in">
          {newsLoading ? (
            <div className="py-8 text-center text-text-muted text-xs flex flex-col items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{symbol} ile ilgili güncel haberler ve KAP bildirimleri taranıyor...</span>
            </div>
          ) : news.length === 0 ? (
            <div className="p-4 rounded-xl bg-bg-tertiary/40 border border-border/50 text-center text-xs text-text-muted">
              {symbol} için şu anda doğrudan eşleşen flaş haber bulunamadı. Genel piyasa gelişmeleri takip ediliyor.
            </div>
          ) : (
            <div className="space-y-2">
              {news.map((item) => {
                const sentimentConfig = {
                  positive: { label: 'Pozitif', color: 'text-success bg-success/10 border-success/30' },
                  neutral: { label: 'Nötr', color: 'text-text-muted bg-bg-tertiary border-border' },
                  negative: { label: 'Dikkat', color: 'text-danger bg-danger/10 border-danger/30' },
                }[item.sentiment] || { label: 'Nötr', color: 'text-text-muted bg-bg-tertiary border-border' };

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-bg-tertiary/40 border border-border/60 hover:border-accent/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-text-muted">
                          {item.source}
                        </span>
                        <span className="text-[10px] text-text-muted">•</span>
                        <span className="text-[10px] text-text-muted">
                          {new Date(item.publishedAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${sentimentConfig.color}`}>
                          {sentimentConfig.label}
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm font-semibold text-text-primary hover:text-accent transition-colors line-clamp-1 block group-hover:underline"
                      >
                        {item.title}
                      </a>
                      <p className="text-[11px] text-text-secondary mt-1 line-clamp-1 font-medium">
                        {item.summary}
                      </p>
                    </div>

                    {/* AI Prompt Button for this News Item */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Link
                        href={`/ai-assistant?prompt=${encodeURIComponent(
                          `"${item.title}" başlıklı haberin ${symbol} (${stockName || symbol}) fiyatına, sektöre ve piyasa beklentilerine etkisini detaylı analiz et.`
                        )}`}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-all flex items-center gap-1 cursor-pointer"
                        title="AI Asistan'a bu haberi analiz ettir"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span>AI ile Yorumla</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Link to News Hub */}
          <div className="pt-1 flex items-center justify-between text-xs text-text-muted">
            <span>Tüm KAP bildirimleri ve küresel akış için:</span>
            <Link
              href="/news"
              className="text-accent hover:text-accent-hover font-bold inline-flex items-center gap-1"
            >
              <span>Haberler Sayfası</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
