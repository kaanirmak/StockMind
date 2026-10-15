'use client';
import { useState } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Button } from '@/components/ui/Button';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
export function PortfolioDangerZone() {
  const [confirm, setConfirm] = useState(false);
  const { activePortfolioId, portfolios, transactions, clearPortfolioTransactions } = usePortfolioStore();
  const active = portfolios.find((p) => p.id === activePortfolioId);
  const count = transactions.filter((t) => t.portfolioId === activePortfolioId).length;
  return <section aria-labelledby="danger-zone-title" className="p-4 sm:p-6 rounded-2xl border border-danger/40 bg-danger/5 space-y-3">
    <h3 id="danger-zone-title" className="font-semibold text-danger">Tehlikeli Alan</h3>
    <p className="text-sm text-text-secondary">Aktif portföyün işlem kayıtlarını sıfırlamak geri alınamaz. {active ? `${active.name} · ${count} işlem` : 'Aktif portföy bulunmuyor.'}</p>
    <Button variant="destructive" disabled={!active || count === 0} onClick={() => setConfirm(true)}>Alım/Satım Geçmişini Temizle</Button>
    {confirm && active && <ConfirmAction title="Alım/Satım Kayıtlarını Temizle" description={`${active.name} portföyündeki ${count} işlem ve bunlardan hesaplanan varlıklar silinecek. Hesabınız ve diğer portföyleriniz korunur.`} onClose={() => setConfirm(false)} onConfirm={() => clearPortfolioTransactions(active.id)} />}
  </section>;
}
