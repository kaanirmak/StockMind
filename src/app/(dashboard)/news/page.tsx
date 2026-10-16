'use client';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Badge, Input, Button } from '@/components/ui';
import { NewsArticle } from '@/app/api/news/route';
import { calculatePortfolioHoldings } from '@/lib/portfolio/calculations';
import { mentionsNewsSymbol } from '@/lib/news/symbolMatch';
import { usePortfolioStore } from '@/store/usePortfolioStore';

export default function NewsPage() {
  const {
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    transactions,
    fetchPortfoliosAndTransactions,
  } = usePortfolioStore();

  const requestRef = useRef<AbortController | null>(null);
  const [newsError, setNewsError] = useState('');
  const [newsWarning, setNewsWarning] = useState('');
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSymbolFilter, setSelectedSymbolFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  // Extract unique portfolio symbols
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];
  const activeTransactions = transactions.filter((t) => t.portfolioId === activePortfolio?.id);

  const portfolioSymbols = useMemo(() => {
    return calculatePortfolioHoldings(activeTransactions).filter(holding => holding.totalQuantity > 0).map(holding => holding.symbol.toUpperCase().trim());
  }, [activeTransactions]);

  const fetchNews = async (isManualRefresh = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setNewsError(''); setNewsWarning('');
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }

      if (selectedCategory === 'PORTFOLIO' && portfolioSymbols.length > 0) {
        params.append('symbols', portfolioSymbols.join(','));
      }

      const res = await fetch(`/api/news?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.data)) throw new Error(data.error || 'Haberler yüklenemedi.');
      if (requestRef.current !== controller) return;
      setNews(data.data.map((article: NewsArticle) => ({ ...article, relatedSymbols: article.relatedSymbols?.filter(symbol => mentionsNewsSymbol(`${article.title} ${article.summary}`, symbol)) })));
      setNewsWarning(data.warning ? `${data.warning}${data.collectedAt ? ` Son güncelleme: ${new Date(data.collectedAt).toLocaleString('tr-TR')}` : ''}` : '');
    } catch (err) {
      if (requestRef.current !== controller) return;
      setNewsError(!navigator.onLine ? 'İnternet bağlantısı yok. Bağlantınızı kontrol edip tekrar deneyin.' : controller.signal.aborted ? 'Haber sunucusu zamanında yanıt vermedi. Tekrar deneyin.' : err instanceof Error ? err.message : 'Haberler yüklenemedi. Tekrar deneyin.');
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) { setLoading(false); setIsRefreshing(false); }
    }
  };

  useEffect(() => {
    fetchNews();
    setSelectedSymbolFilter('ALL');
    return () => requestRef.current?.abort();
  }, [selectedCategory, portfolioSymbols.join(',')]);

  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      // Filter by specific symbol chip if selected
      if (selectedSymbolFilter !== 'ALL') {
        const sym = selectedSymbolFilter.toUpperCase();
        const hasSym =
          item.relatedSymbols?.includes(sym) ||
          mentionsNewsSymbol(`${item.title} ${item.summary}`, sym);
        if (!hasSym) return false;
      }

      // Filter by search text query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.relatedSymbols?.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [news, searchQuery, selectedSymbolFilter]);

  const categories = [
    { id: 'ALL', label: 'Tüm Haberler' },
    {
      id: 'PORTFOLIO',
      label: ` Portföyümdeki Varlıklar${portfolioSymbols.length > 0 ? ` (${portfolioSymbols.length})` : ''}`,
      highlight: true,
    },
    { id: 'BIST', label: " BIST & Şirketler" },
    { id: 'KAP', label: " KAP Bildirimleri" },
    { id: 'GLOBAL', label: " Küresel Piyasalar" },
    { id: 'MACRO', label: " Makroekonomi & Emtia" },
  ];

  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in pb-12">
      <h1 className="sr-only">Piyasa Haberleri & KAP</h1>
      {/* Filter & Search Bar */}
      <div className="glass-card p-2.5 sm:p-4 space-y-2.5 sm:space-y-4">
        <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-4 items-stretch lg:items-center justify-between">
          <select aria-label="Haber kategorisi" value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)} className="sm:hidden w-full min-w-0 h-11 px-3 rounded-xl border border-border bg-bg-input text-sm text-text-primary">
            {categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
          <div className="hidden sm:flex min-w-0 items-center gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border overflow-x-auto">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? cat.id === 'PORTFOLIO'
                        ? 'bg-emerald-600 text-white shadow-md font-bold'
                        : 'bg-accent text-white shadow font-bold'
                      : cat.id === 'PORTFOLIO'
                      ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex w-full min-w-0 lg:w-80 items-center gap-2">
            <div className="min-w-0 flex-1">
            <Input
              placeholder="Haber, hisse veya kaynak ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            </div>
          <Button
            variant="outline"
            size="sm"
            aria-label={isRefreshing ? 'Haberler yenileniyor' : 'Haberleri yenile'}
            title="Haberleri yenile"
            className="shrink-0 !h-11 !w-11 !min-w-11 !p-0 sm:!w-auto sm:!px-3"
            onClick={() => fetchNews(true)}
            disabled={isRefreshing || loading}
            leftIcon={
              <svg
                className={`w-3.5 h-3.5 text-accent ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            }
          >
            <span className="hidden sm:inline">{isRefreshing ? 'Yenileniyor...' : 'Yenile'}</span>
          </Button>
          </div>
        </div>
          {portfolios.length > 1 && (
            <select
              value={activePortfolioId}
              onChange={(e) => setActivePortfolioId(e.target.value)}
              className="bg-bg-secondary text-text-primary text-xs font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:border-accent"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

        {/* Portfolio symbols quick filter chips */}
        {selectedCategory === 'PORTFOLIO' && portfolioSymbols.length > 0 && (
          <div className="pt-2 border-t border-border/40 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-text-muted font-medium whitespace-nowrap">Varlık Filtrele:</span>
            <button
              onClick={() => setSelectedSymbolFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedSymbolFilter === 'ALL'
                  ? 'bg-accent/20 text-accent border border-accent/40'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              Tümü ({news.length})
            </button>
            {portfolioSymbols.map((sym) => {
              const count = news.filter(
                (n) =>
                  n.relatedSymbols?.includes(sym) ||
                  mentionsNewsSymbol(`${n.title} ${n.summary}`, sym)
              ).length;
              return (
                <button
                  key={`filter-sym-${sym}`}
                  onClick={() => setSelectedSymbolFilter(sym)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                    selectedSymbolFilter === sym
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span>${sym}</span>
                  {count > 0 && <span className="text-[10px] opacity-75">({count})</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {newsError && <div role="alert" className="glass-card p-4 space-y-2"><p className="text-sm text-danger">{newsError}</p>{news.length > 0 && <p className="text-xs text-text-muted">Son yüklenen haberler gösteriliyor.</p>}<Button variant="secondary" size="sm" onClick={() => fetchNews(true)} disabled={isRefreshing}>Tekrar Dene</Button></div>}
      {newsWarning && <p role="status" className="text-xs text-warning">{newsWarning}</p>}

      {/* Portfolio Empty State */}
      {selectedCategory === 'PORTFOLIO' && portfolioSymbols.length === 0 && !loading ? (
        <div className="glass-card p-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">

          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-text-primary">Portföyünüzde Henüz Varlık Bulunmuyor</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Portföyünüze hisse senedi veya yatırım fonu eklediğinizde, sahip olduğunuz varlıklara ait tüm KAP bildirimleri ve piyasa haberleri otomatik olarak burada toplanacaktır.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/portfolio">
              <Button variant="primary" size="md">
                + Portföye Varlık Ekle
              </Button>
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="glass-card p-12 text-center text-text-muted space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Canlı haberler ve KAP bildirimleri yükleniyor...</p>
        </div>
      ) : newsError && news.length === 0 ? null : filteredNews.length === 0 ? (
        <div className="glass-card p-12 text-center text-text-muted space-y-2">
          <svg className="w-10 h-10 mx-auto text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <p className="text-sm font-semibold text-text-primary">{selectedCategory === 'PORTFOLIO' && !searchQuery && selectedSymbolFilter === 'ALL' ? 'Bağlı kaynaklarda portföy varlıklarınızla eşleşen haber bulunamadı.' : 'Aradığınız kriterlere uygun haber bulunamadı.'}</p>
          <p className="text-xs">{selectedCategory === 'PORTFOLIO' ? 'Investing.com BİST, şirket ve borsa haberleri; TRT Haber ekonomi ve ECB bültenleri taranıyor. Şirket ve fon haberlerinin tamamı bu kaynaklarda yer almayabilir.' : 'Farklı bir arama terimi deneyebilir veya kategoriyi değiştirebilirsiniz.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredNews.map((item, idx) => {
            const sentimentBadge =
              item.sentiment === 'positive' ? (
                <Badge variant="success" size="sm">
                  Olumlu
                </Badge>
              ) : item.sentiment === 'negative' ? (
                <Badge variant="danger" size="sm">
                  Olumsuz
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Nötr
                </Badge>
              );

            // Identify if this news relates to any of the user's portfolio holdings
            const matchedPortfolioSymbols = portfolioSymbols.filter(symbol => mentionsNewsSymbol(`${item.title} ${item.summary}`, symbol));

            const isPortfolioRelated = matchedPortfolioSymbols.length > 0;

            return (
              <div
                key={item.id || `news-card-${idx}`}
                className={`glass-card p-5 transition-all duration-300 flex flex-col justify-between space-y-4 hover:border-accent/40 ${
                  isPortfolioRelated ? 'border-emerald-500/40 bg-emerald-500/[0.02]' : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Source, Portfolio Match Badge, Sentiment & Date */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-accent">{item.source}</span>
                      {isPortfolioRelated && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <span><UIIcon name="sparkles" className="w-4 h-4" /></span> Portföyünüzde: {matchedPortfolioSymbols.join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span title={item.sentimentReason} aria-label={`Haber tonu: ${item.sentiment === 'positive' ? 'Olumlu' : item.sentiment === 'negative' ? 'Olumsuz' : 'Nötr'}. ${item.sentimentReason || ''}`}>{sentimentBadge}</span>
                      <span className="text-[11px] text-text-muted">
                        {new Date(item.publishedAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <h3 className="text-base font-bold text-text-primary leading-snug group-hover:text-accent transition-colors">
                      {item.title}
                    </h3>
                  </a>

                  {/* Summary */}
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                    {item.summary}
                  </p>
                </div>

                {/* Footer: Related Symbols & Action Links */}
                <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.relatedSymbols?.map((sym, sIdx) => {
                      const inPort = portfolioSymbols.includes(sym.toUpperCase());
                      return (
                        <Link key={`sym-${item.id || idx}-${sym}-${sIdx}`} href={`/stocks/${sym}`}>
                          <Badge
                            variant={inPort ? 'success' : 'purple'}
                            size="sm"
                            className="hover:scale-105 transition-transform cursor-pointer"
                          >
                            ${sym}
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.url && item.url !== '#' && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
                        title="Haberi Kaynağında Aç"
                      >
                        <span>Kaynak</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}

                    <Link
                      href={`/ai-assistant?prompt=${encodeURIComponent(
                        isPortfolioRelated
                          ? `Portföyümde bulunan (${matchedPortfolioSymbols.join(', ')}) hisselerim/fonlarım açısından şu haberi analiz et ve etkisini yorumla: "${item.title}" - ${item.summary}`
                          : `Şu haberin piyasaya ve ilgili hisselere etkisini analiz et: "${item.title}" - ${item.summary}`
                      )}`}
                    >
                      <Button variant="ghost" size="sm" className="text-accent hover:text-accent text-xs">
                        {isPortfolioRelated ? "AI Portföy Yorumu " : 'AI Yorumla →'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
