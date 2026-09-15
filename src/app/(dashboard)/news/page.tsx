'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge, Input, Button } from '@/components/ui';
import { NewsArticle } from '@/app/api/news/route';

export default function NewsPage() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (selectedCategory !== 'ALL') params.append('category', selectedCategory);

        const res = await fetch(`/api/news?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setNews(data.data);
        }
      } catch (err) {
        console.error('Failed to load news:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [selectedCategory]);

  const filteredNews = news.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.relatedSymbols?.some((s) => s.toLowerCase().includes(q))
    );
  });

  const categories = [
    { id: 'ALL', label: 'Tüm Haberler' },
    { id: 'BIST', label: '🇹🇷 BIST & Şirketler' },
    { id: 'KAP', label: '📢 KAP Bildirimleri' },
    { id: 'GLOBAL', label: '🌐 Küresel Piyasalar' },
    { id: 'MACRO', label: '📊 Makroekonomi & Emtia' },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Piyasa Haberleri & KAP</h1>
        <p className="text-text-secondary text-sm mt-1">
          Borsa İstanbul, KAP duyuruları ve küresel finans piyasalarından anlık gelişmeler.
        </p>
      </div>

      {/* Filter & Search */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border w-full md:w-auto overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-accent text-white shadow'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="w-full md:w-72">
            <Input
              placeholder="Haber veya hisse ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
        </div>
      </div>

      {/* News Feed Grid */}
      {loading ? (
        <div className="glass-card p-12 text-center text-text-muted">
          <span>Haberler yükleniyor...</span>
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="glass-card p-12 text-center text-text-muted">
          <span>Aradığınız kriterlere uygun haber bulunamadı.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredNews.map((item) => {
            const sentimentBadge =
              item.sentiment === 'positive' ? (
                <Badge variant="success" size="sm">
                  Pozitif / Boğa
                </Badge>
              ) : item.sentiment === 'negative' ? (
                <Badge variant="danger" size="sm">
                  Negatif / Ayı
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Nötr
                </Badge>
              );

            return (
              <div
                key={item.id}
                className="glass-card p-5 hover:border-accent/40 transition-all duration-300 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-accent">{item.source}</span>
                    <div className="flex items-center gap-2">
                      {sentimentBadge}
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

                  <h3 className="text-base font-bold text-text-primary leading-snug hover:text-accent transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.relatedSymbols?.map((sym) => (
                      <Link key={sym} href={`/stocks/${sym}`}>
                        <Badge variant="purple" size="sm" className="hover:border-accent">
                          ${sym}
                        </Badge>
                      </Link>
                    ))}
                  </div>

                  <Link href={`/ai-assistant?prompt=${encodeURIComponent(`Şu haberin piyasaya ve ilgili hisselere etkisini analiz et: "${item.title}" - ${item.summary}`)}`}>
                    <Button variant="ghost" size="sm" className="text-accent hover:text-accent">
                      AI Yorumla &rarr;
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
