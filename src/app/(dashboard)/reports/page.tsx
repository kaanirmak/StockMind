'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Button, Badge, useToast } from '@/components/ui';

export default function ReportsPage() {
  const { showToast } = useToast();
  const { portfolios, activePortfolioId, getSummary } = usePortfolioStore();
  const summary = getSummary();
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];

  const [sendingEmail, setSendingEmail] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmailReport = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'support@stockmind.app',
          userName: 'Kaan Irmak',
          subject: `StockMind Portföy Raporu • ${activePortfolio.name} (${new Date().toLocaleDateString('tr-TR')})`,
          portfolioSummary: {
            totalValue: summary.totalValue,
            totalPnL: summary.totalPnL,
            totalPnLPercent: summary.totalPnLPercent,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'Rapor E-postayla Gönderildi! 📨',
          message: data.message || 'Portföy performans raporunuz e-posta adresinize iletildi.',
        });
      } else {
        showToast({
          type: 'danger',
          title: 'Gönderim Başarısız',
          message: data.message || 'E-posta iletilemedi.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: err.message || 'Sunucuya bağlanılamadı.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleExportCSV = () => {
    if (summary.holdings.length === 0) return;

    const headers = 'Sembol,Varlık Türü,Adet,Ortalama Maliyet,Son Fiyat,Toplam Değer,Net Kar Zarar,Getiri Yüzdesi,Portföy Payı\n';
    const rows = summary.holdings
      .map(
        (h) =>
          `${h.symbol},${h.assetType === 'stock' ? 'Hisse' : 'TEFAS Fon'},${h.totalQuantity},${h.averageCost},${h.currentPrice},${h.currentValue},${h.pnl},${h.pnlPercent}%,%${h.weight}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `StockMind_Portfoy_Raporu_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Portföy Performans Raporları</h1>
          <p className="text-text-secondary text-sm mt-1">
            Detaylı getiri analizleri, varlık dağılımı ve vergi/kar-zarar dökümü.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleSendEmailReport}
            disabled={sendingEmail}
            leftIcon={
              sendingEmail ? (
                <svg className="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )
            }
          >
            {sendingEmail ? 'Gönderiliyor...' : 'E-posta Gönder'}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handlePrint}
            disabled={summary.holdings.length === 0}
            leftIcon={
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            }
          >
            Yazdır / PDF
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleExportCSV}
            disabled={summary.holdings.length === 0}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
          >
            CSV Dışa Aktar
          </Button>
        </div>
      </div>

      {summary.holdings.length === 0 ? (
        <div className="glass-card p-12 text-center text-text-muted space-y-3">
          <p className="text-base font-semibold text-text-primary">Rapor oluşturulacak varlık bulunmuyor</p>
          <p className="text-xs max-w-sm mx-auto">
            Portföyünüze alım işlemi eklediğinizde burada otomatik olarak performans raporları, vergi/kâr-zarar dökümü ve getiri tablosu oluşturulacaktır.
          </p>
          <div className="pt-2">
            <Link href="/portfolio">
              <Button variant="primary" size="sm">
                Portföye Git &rarr;
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Main Report Document Card */
        <div className="glass-card p-6 space-y-8 print:border-none print:shadow-none">
          {/* Report Meta Header */}
          <div className="flex flex-col sm:flex-row justify-between pb-6 border-b border-border/80 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                  StockMind
                </span>
                <span className="text-xs text-text-muted">| Portföy Durum Belgesi</span>
              </div>
              <h2 className="text-lg font-bold text-text-primary mt-2">{activePortfolio.name}</h2>
              <p className="text-xs text-text-muted">{activePortfolio.description || 'Standart Portföy'}</p>
            </div>
            <div className="text-left sm:text-right text-xs text-text-muted space-y-1">
              <p>Rapor Tarihi: <span className="text-text-primary font-mono">{new Date().toLocaleDateString('tr-TR')}</span></p>
              <p>Para Birimi: <span className="text-text-primary font-mono">{activePortfolio.currency}</span></p>
              <p>Durum: <span className="text-success font-semibold">Aktif Portföy</span></p>
            </div>
          </div>

          {/* High-level Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-bg-tertiary/60 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">Toplam Piyasa Değeri</span>
              <span className="text-xl font-bold font-mono text-text-primary mt-1 block">
                ₺{summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-bg-tertiary/60 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">Toplam Yatırım Maliyeti</span>
              <span className="text-xl font-bold font-mono text-text-secondary mt-1 block">
                ₺{summary.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-bg-tertiary/60 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">Net Kar / Zarar</span>
              <span className={`text-xl font-bold font-mono ${summary.totalPnL >= 0 ? 'text-success' : 'text-danger'} mt-1 block`}>
                {summary.totalPnL >= 0 ? '+' : ''}₺{summary.totalPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-bg-tertiary/60 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">Toplam Getiri Oranı</span>
              <span className={`text-xl font-bold font-mono ${summary.totalPnLPercent >= 0 ? 'text-success' : 'text-danger'} mt-1 block`}>
                {summary.totalPnLPercent >= 0 ? '+' : ''}%{summary.totalPnLPercent.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Detailed Holdings Statement */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-text-primary">Portföy Varlık Listesi</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-border/60 rounded-xl overflow-hidden">
                <thead className="bg-bg-secondary text-text-muted uppercase border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-3">Varlık</th>
                    <th className="py-2.5 px-3">Tür</th>
                    <th className="py-2.5 px-3 text-right">Adet</th>
                    <th className="py-2.5 px-3 text-right">Maliyet</th>
                    <th className="py-2.5 px-3 text-right">Son Fiyat</th>
                    <th className="py-2.5 px-3 text-right">Toplam Değer</th>
                    <th className="py-2.5 px-3 text-right">Net Getiri</th>
                    <th className="py-2.5 px-3 text-right">Ağırlık</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {summary.holdings.map((h) => (
                    <tr key={h.symbol} className="hover:bg-bg-hover/40">
                      <td className="py-2.5 px-3 font-bold text-text-primary">{h.symbol}</td>
                      <td className="py-2.5 px-3 text-text-secondary">{h.assetType === 'stock' ? 'Hisse' : 'TEFAS Fon'}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{h.totalQuantity.toLocaleString('tr-TR')}</td>
                      <td className="py-2.5 px-3 text-right font-mono">₺{h.averageCost.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">₺{h.currentPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary">
                        ₺{h.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${h.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                        {h.pnl >= 0 ? '+' : ''}₺{h.pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ({h.pnl >= 0 ? '+' : ''}{h.pnlPercent.toFixed(1)}%)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">%{h.weight.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
