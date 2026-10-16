'use client';

import React, { useState } from 'react';
import { Button, useToast } from '@/components/ui';
import { Icon as UIIcon } from '@/components/ui/Icon';

interface ProRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userEmail?: string;
  userName?: string;
}

export function ProRequestModal({
  isOpen,
  onClose,
  onSuccess,
  userEmail,
  userName,
}: ProRequestModalProps) {
  const { showToast } = useToast();
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/pro/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast({
          type: 'success',
          title: 'Talebiniz Alındı! 🚀',
          message: data.message || 'Pro hesap talebiniz yöneticiye iletildi. Onaylandığında e-posta bildirimi alacaksınız.',
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast({
          type: 'danger',
          title: 'Talep İletilemedi',
          message: data.error || 'İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'danger',
        title: 'Bağlantı Hatası',
        message: err.message || 'Sunucuya bağlanılamadı.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg p-6 rounded-3xl bg-bg-card border border-border shadow-2xl space-y-5 animate-scale-up">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full border border-border/80 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          aria-label="Kapat"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 shrink-0">
            ⭐
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">StockMind Pro Hesap İste</h2>
            <p className="text-xs text-text-muted">Yönetici onayı ile anında aktif edilecek pro üyelik talebi</p>
          </div>
        </div>

        {/* Features Checklist */}
        <div className="p-4 rounded-2xl bg-bg-secondary/60 border border-border/60 space-y-2 text-xs">
          <p className="font-semibold text-text-primary mb-1">Pro Üyelik ile Açılacak Özellikler:</p>
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="text-emerald-400 font-bold shrink-0">✓</span>
            <span><strong>Yatırım Komitesi:</strong> 4 uzman AI ajanının çoklu simülasyonu ve konsensüs kararı</span>
          </div>
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="text-emerald-400 font-bold shrink-0">✓</span>
            <span><strong>Gelişmiş AI Modelleri:</strong> GPT-4o, Claude 3.5 Sonnet ve premium modeller</span>
          </div>
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="text-emerald-400 font-bold shrink-0">✓</span>
            <span><strong>Otomatik DCF & Monte Carlo:</strong> 1.000 simülasyonlu risk ve adil değerleme analizi</span>
          </div>
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="text-emerald-400 font-bold shrink-0">✓</span>
            <span><strong>StockMind AI Bülteni:</strong> Canlı hisse zeka sinyalleri ve günlük 18:30 kapanış bülteni</span>
          </div>
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="text-emerald-400 font-bold shrink-0">✓</span>
            <span><strong>Sınırsız Çoklu Portföy:</strong> Temettü, büyüme ve fon sepetlerinizi ayrı portföylerde sınırsız yönetin (Standart: 1)</span>
          </div>
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="text-emerald-400 font-bold shrink-0">✓</span>
            <span><strong>Sınırsız Fiyat Alarmı:</strong> Anlık sesli uyarı ve bildirim kotası olmadan sınırsız alarm kurun (Standart: 3)</span>
          </div>
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="text-emerald-400 font-bold shrink-0">✓</span>
            <span><strong>Genişletilmiş AI Soru Kotası:</strong> StockMind AI Asistan ile saatte 20 soru hakkı (Standart: 5 soru/saat)</span>
          </div>
        </div>

        {/* Request Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">
              Hesap Sahibi
            </label>
            <div className="px-3.5 py-2.5 rounded-xl bg-bg-input border border-border text-xs text-text-primary flex items-center justify-between">
              <span>{userName || 'Kullanıcı'}</span>
              <span className="text-text-muted font-mono">{userEmail}</span>
            </div>
          </div>

          <div>
            <label htmlFor="pro-request-note" className="block text-xs font-semibold text-text-muted mb-1">
              Yöneticiye Not (İsteğe Bağlı)
            </label>
            <textarea
              id="pro-request-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Örn: Yatırım komitesi ve portföy analiz araçlarını aktif olarak kullanmak istiyorum..."
              rows={3}
              maxLength={500}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-input border border-border text-xs text-text-primary placeholder:text-text-muted/60 focus:border-accent focus:outline-none resize-none transition-colors"
            />
            <p className="text-[10px] text-text-muted mt-1 text-right">{note.length}/500</p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Vazgeç
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold shadow-lg shadow-amber-500/20"
            >
              🚀 Pro Talebini Gönder
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
