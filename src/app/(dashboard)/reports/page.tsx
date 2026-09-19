'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Button, Badge, useToast } from '@/components/ui';

export default function ReportsPage() {
  const { showToast } = useToast();
  const { portfolios, activePortfolioId, getSummary, fetchPortfoliosAndTransactions } = usePortfolioStore();
  const [isMounted, setIsMounted] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  const summary = getSummary();
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmailReport = async () => {
    // Settings saves everything as one JSON object under stockmind_settings_{userKey}
    // We need to find the right key (could be 'guest' or 'user_{id}')
    let settings: Record<string, any> = {};
    try {
      // Try 'guest' first, then look for user_ keys
      const guestRaw = localStorage.getItem('stockmind_settings_guest');
      if (guestRaw) {
        settings = JSON.parse(guestRaw);
      } else {
        // Find any stockmind_settings_ key
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || '';
          if (key.startsWith('stockmind_settings_') && !key.includes('_smtp_')) {
            try {
              const raw = localStorage.getItem(key);
              if (raw) settings = JSON.parse(raw);
              break;
            } catch {}
          }
        }
      }
    } catch {}

    const smtpUser = (settings.smtpUser || '').trim();
    const smtpPass = (settings.smtpPass || '').trim();
    const smtpHost = (settings.smtpHost || 'smtp.gmail.com').trim();
    const smtpPort = Number(settings.smtpPort || 587);
    const smtpFrom = (settings.smtpFrom || '').trim();
    const smtpService = (settings.smtpService || 'gmail').trim();
    const recipientEmail = (settings.notificationEmail || smtpUser || '').trim();

    if (!smtpUser || !smtpPass) {
      showToast({
        type: 'danger',
        title: 'SMTP Ayarları Gerekli',
        message: 'E-posta göndermek için Ayarlar → E-posta & Bildirimler bölümünden SMTP bilgilerinizi kaydedin.',
      });
      return;
    }

    if (!recipientEmail || !recipientEmail.includes('@')) {
      showToast({
        type: 'danger',
        title: 'Alıcı E-posta Eksik',
        message: 'Ayarlar sayfasından bildirim e-posta adresinizi girin.',
      });
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          userName: settings.fullName || 'Kullanıcı',
          subject: `StockMind Portföy Raporu • ${activePortfolio?.name || 'Portföy'} (${new Date().toLocaleDateString('tr-TR')})`,
          portfolioSummary: {
            totalValue: summary.totalValue,
            totalPnL: summary.totalPnL,
            totalPnLPercent: summary.totalPnLPercent,
          },
          customSmtp: {
            user: smtpUser,
            pass: smtpPass,
            host: smtpHost,
            port: smtpPort,
            from: smtpFrom || `StockMind <${smtpUser}>`,
            service: smtpService,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'Rapor E-postayla Gönderildi! 📨',
          message: data.message || `Portföy raporunuz ${recipientEmail} adresine iletildi.`,
        });
      } else if (data.requiresSmtpConfig) {
        showToast({
          type: 'danger',
          title: 'SMTP Yapılandırması Gerekli',
          message: 'Ayarlar → E-posta bölümünden SMTP bilgilerinizi ekleyin.',
        });
      } else {
        showToast({
          type: 'danger',
          title: 'Gönderim Başarısız',
          message: data.message || data.error || 'E-posta iletilemedi. Gmail kullanıyorsanız 16 haneli App Password gereklidir.',
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

  if (!isMounted) {
    return (
      <div className="space-y-6 animate-pulse pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-bg-card rounded-lg border border-border" />
            <div className="h-4 w-80 bg-bg-card rounded border border-border" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-bg-card rounded-xl border border-border" />
            <div className="h-10 w-24 bg-bg-card rounded-xl border border-border" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-bg-card border border-border" />
          ))}
        </div>
        <div className="h-96 rounded-2xl bg-bg-card border border-border" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Portföy Performans Raporları</h1>
          <p className="text-text-secondary text-sm mt-1">
            Detaylı getiri analizleri, varlık dağılımı ve vergi/kar-zarar dökümü.
          </p>
        </div>

        {/* Action buttons — responsive: stacked on mobile, row on desktop */}
        <div className="grid grid-cols-1 sm:flex sm:flex-row gap-2">
          {/* Email button — glassmorphic card on mobile */}
          <button
            onClick={handleSendEmailReport}
            disabled={sendingEmail}
            className="glass-card flex items-center gap-3 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:border-accent/30 active:scale-[0.98] disabled:opacity-50 cursor-pointer group"
          >
            <div className="w-9 h-9 sm:w-auto sm:h-auto rounded-lg sm:rounded-none bg-accent/15 sm:bg-transparent flex items-center justify-center shrink-0">
              {sendingEmail ? (
                <svg className="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="text-left sm:hidden">
              <span className="text-text-primary block font-semibold">{sendingEmail ? 'Gönderiliyor...' : 'E-posta Gönder'}</span>
              <span className="text-[11px] text-text-muted">Raporu e-posta ile paylaş</span>
            </div>
            <span className="hidden sm:inline text-text-primary">{sendingEmail ? 'Gönderiliyor...' : 'E-posta Gönder'}</span>
          </button>

          {/* Print button */}
          <button
            onClick={handlePrint}
            disabled={summary.holdings.length === 0}
            className="glass-card flex items-center gap-3 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:border-accent/30 active:scale-[0.98] disabled:opacity-50 cursor-pointer group"
          >
            <div className="w-9 h-9 sm:w-auto sm:h-auto rounded-lg sm:rounded-none bg-accent/15 sm:bg-transparent flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-accent-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <div className="text-left sm:hidden">
              <span className="text-text-primary block font-semibold">Yazdır / PDF</span>
              <span className="text-[11px] text-text-muted">Raporu yazdır veya PDF olarak kaydet</span>
            </div>
            <span className="hidden sm:inline text-text-primary">Yazdır / PDF</span>
          </button>

          {/* CSV Export button */}
          <button
            onClick={handleExportCSV}
            disabled={summary.holdings.length === 0}
            className="flex items-center gap-3 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer bg-gradient-to-r from-accent to-accent-secondary text-white shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:brightness-110"
          >
            <div className="w-9 h-9 sm:w-auto sm:h-auto rounded-lg sm:rounded-none bg-white/10 sm:bg-transparent flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="text-left sm:hidden">
              <span className="block">CSV Dışa Aktar</span>
              <span className="text-[11px] text-white/70 font-normal">Verileri CSV dosyası olarak indir</span>
            </div>
            <span className="hidden sm:inline">CSV Dışa Aktar</span>
          </button>
        </div>
      </div>

      {summary.holdings.length === 0 ? (
        <div className="glass-purple p-10 sm:p-12 text-center text-text-muted space-y-4 rounded-2xl">
          {/* Empty state illustration */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
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
        <div className="glass-card p-4 sm:p-6 space-y-8 print:border-none print:shadow-none">
          {/* Report Meta Header */}
          <div className="flex flex-col sm:flex-row justify-between pb-6 border-b border-border/80 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black gradient-text">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-purple p-4 rounded-xl">
              <span className="text-[11px] sm:text-xs text-text-muted block">Toplam Piyasa Değeri</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-text-primary mt-1 block">
                ₺{summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="glass-purple p-4 rounded-xl">
              <span className="text-[11px] sm:text-xs text-text-muted block">Toplam Yatırım Maliyeti</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-text-secondary mt-1 block">
                ₺{summary.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="glass-purple p-4 rounded-xl">
              <span className="text-[11px] sm:text-xs text-text-muted block">Net Kar / Zarar</span>
              <span className={`text-lg sm:text-xl font-bold font-mono ${summary.totalPnL >= 0 ? 'text-success' : 'text-danger'} mt-1 block`}>
                {summary.totalPnL >= 0 ? '+' : ''}₺{summary.totalPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="glass-purple p-4 rounded-xl">
              <span className="text-[11px] sm:text-xs text-text-muted block">Toplam Getiri Oranı</span>
              <span className={`text-lg sm:text-xl font-bold font-mono ${summary.totalPnLPercent >= 0 ? 'text-success' : 'text-danger'} mt-1 block`}>
                {summary.totalPnLPercent >= 0 ? '+' : ''}%{summary.totalPnLPercent.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Detailed Holdings Statement */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-text-primary">Portföy Varlık Listesi</h3>

            {/* Desktop table — hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
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

            {/* Mobile card layout — visible only on mobile */}
            <div className="md:hidden space-y-3 stagger-children">
              {summary.holdings.map((h) => (
                <div
                  key={h.symbol}
                  className="glass-card p-4 space-y-3"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <span className="text-sm font-black text-accent">
                          {h.symbol.substring(0, 2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-text-primary block">{h.symbol}</span>
                        <span className="text-[11px] text-text-muted">
                          {h.assetType === 'stock' ? 'Hisse Senedi' : 'TEFAS Fon'}
                        </span>
                      </div>
                    </div>
                    <div className={`text-right`}>
                      <span className={`text-sm font-bold font-mono ${h.pnl >= 0 ? 'text-success' : 'text-danger'} block`}>
                        {h.pnl >= 0 ? '+' : ''}{h.pnlPercent.toFixed(1)}%
                      </span>
                      <span className={`text-[11px] font-mono ${h.pnl >= 0 ? 'text-success/70' : 'text-danger/70'}`}>
                        {h.pnl >= 0 ? '+' : ''}₺{h.pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Card stats grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-bg-tertiary/50 rounded-lg p-2.5">
                      <span className="text-[10px] text-text-muted block uppercase tracking-wider">Adet</span>
                      <span className="text-xs font-bold font-mono text-text-primary">{h.totalQuantity.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="bg-bg-tertiary/50 rounded-lg p-2.5">
                      <span className="text-[10px] text-text-muted block uppercase tracking-wider">Maliyet</span>
                      <span className="text-xs font-bold font-mono text-text-primary">₺{h.averageCost.toFixed(2)}</span>
                    </div>
                    <div className="bg-bg-tertiary/50 rounded-lg p-2.5">
                      <span className="text-[10px] text-text-muted block uppercase tracking-wider">Son Fiyat</span>
                      <span className="text-xs font-bold font-mono text-text-primary">₺{h.currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="bg-bg-tertiary/50 rounded-lg p-2.5">
                      <span className="text-[10px] text-text-muted block uppercase tracking-wider">Değer</span>
                      <span className="text-xs font-bold font-mono text-text-primary">₺{h.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Portfolio weight bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary transition-all duration-500"
                        style={{ width: `${Math.min(h.weight, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-text-muted font-semibold shrink-0">
                      %{h.weight.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
