'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui';
import { ProRequestModal } from './ProRequestModal';

interface ProPlanCardProps {
  isPro?: boolean;
  plan?: string;
  proRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  userEmail?: string;
  userName?: string;
  onRefresh?: () => void;
}

export function ProPlanCard({
  isPro,
  plan,
  proRequestStatus = 'none',
  userEmail,
  userName,
  onRefresh,
}: ProPlanCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState(proRequestStatus);

  const effectivePro = isPro || plan === 'pro' || plan === 'enterprise';
  const effectivePending = localStatus === 'pending' || proRequestStatus === 'pending';

  return (
    <>
      <div
        className={`p-5 sm:p-6 rounded-3xl border transition-all ${
          effectivePro
            ? 'bg-gradient-to-br from-amber-500/10 via-bg-card to-bg-card border-amber-500/30 shadow-lg shadow-amber-500/5'
            : 'bg-bg-card border-border'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                effectivePro
                  ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-bg-secondary text-text-secondary border border-border'
              }`}
            >
              {effectivePro ? '⭐' : '⚡'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-text-primary">Üyelik & Plan Durumu</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    effectivePro
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-bg-secondary text-text-muted border-border'
                  }`}
                >
                  {effectivePro ? 'StockMind Pro' : 'Standart (Ücretsiz)'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {effectivePro
                  ? 'Tüm yapay zeka modelleri ve kantitatif yatırım analiz araçları hesabınızda açık.'
                  : 'Yatırım Komitesi ve gelişmiş AI modelleri için Pro hesap onayı gereklidir.'}
              </p>
            </div>
          </div>

          {!effectivePro && (
            <div className="shrink-0">
              {effectivePending ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Onay Bekleniyor
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold shadow-md shadow-amber-500/20"
                >
                  🚀 Pro Hesap İste
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Status Notification if Pending */}
        {effectivePending && !effectivePro && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <span className="text-lg shrink-0">⏳</span>
            <div className="text-xs text-text-secondary leading-relaxed">
              <strong className="text-amber-400 font-semibold">Talebiniz Yönetici İncelemesinde:</strong> Pro hesap isteğiniz sistem yöneticisine e-posta ile iletilmiştir. Onaylandığında hesabınız otomatik olarak Pro'ya yükseltilecek ve tarafınıza bilgilendirme e-postası gönderilecektir.
            </div>
          </div>
        )}

        {/* Collapsible Feature Matrix / Benefits */}
        <details className="mt-3 group">
          <summary className="text-xs text-amber-500 hover:text-amber-400 font-semibold cursor-pointer list-none flex items-center justify-between p-2.5 rounded-xl bg-bg-secondary/60 border border-border/50">
            <span>✨ Tüm Pro Ayrıcalıklarını İncele (7 Özellik)</span>
            <span className="transition-transform group-open:rotate-180 text-[10px]">▼</span>
          </summary>
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-border/50 space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-text-primary">Yatırım Komitesi (4 AI)</span>
                <span className={effectivePro ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                  {effectivePro ? '✓ Açık' : '🔒 Pro'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">Buffett, Lynch, Simons, Burry simülasyonu.</p>
            </div>

            <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-border/50 space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-text-primary">Gelişmiş AI Modelleri</span>
                <span className={effectivePro ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                  {effectivePro ? '✓ Açık' : '🔒 Pro'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">GPT-4o, Claude 3.5 Sonnet ve premium modeller.</p>
            </div>

            <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-border/50 space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-text-primary">Monte Carlo & Stres Testi</span>
                <span className={effectivePro ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                  {effectivePro ? '✓ Açık' : '🔒 Pro'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">10.000 koşulu GBM simülasyonu ve VaR analizi.</p>
            </div>

            <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-border/50 space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-text-primary">Günlük AI Kapanış Bülteni</span>
                <span className={effectivePro ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                  {effectivePro ? '✓ Açık' : '🔒 Pro'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">Hisse bazlı sinyaller ve 18:30 e-posta bülteni.</p>
            </div>

            <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-border/50 space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-text-primary">Sınırsız Portföy</span>
                <span className={effectivePro ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                  {effectivePro ? '✓ Sınırsız' : '🔒 1 Portföy'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">Temettü, büyüme ve fonlar için ayrı portföyler.</p>
            </div>

            <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-border/50 space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-text-primary">Sınırsız Akıllı Alarm</span>
                <span className={effectivePro ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                  {effectivePro ? '✓ Sınırsız' : '🔒 3 Alarm'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">Hedef fiyat ve yüzdesel eşik bildirimleri.</p>
            </div>

            <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-border/50 space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-text-primary">20 AI Soru / Saat Kotası</span>
                <span className={effectivePro ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                  {effectivePro ? '✓ 20 Soru / Saat' : '🔒 5 Soru / Saat'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">StockMind AI asistanıyla genişletilmiş saatlik soru limiti.</p>
            </div>
          </div>
        </details>
      </div>

      <ProRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userEmail={userEmail}
        userName={userName}
        onSuccess={() => {
          setLocalStatus('pending');
          if (onRefresh) onRefresh();
        }}
      />
    </>
  );
}
