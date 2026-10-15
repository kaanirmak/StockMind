'use client';
import { useState } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import type { CashMovement } from '@/types/portfolio';

export function CashPanel() {
  const { getSummary, cashMovements, activePortfolioId, addCashMovement, deleteCashMovement, cashError, fetchPortfoliosAndTransactions, livePrices, fetchLivePrices } = usePortfolioStore();
  const cash = getSummary().cash;
  const movements = cashMovements.filter((m) => m.portfolioId === activePortfolioId).sort((a, b) => b.movementDate.localeCompare(a.movementDate));
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'deposit' | 'withdrawal'>('deposit');
  const [currency, setCurrency] = useState('TRY');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('1');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<CashMovement | null>(null);
  const { showToast } = useToast();
  const balance = cash?.balances.find((row) => row.currency === currency)?.amount || 0;
  return <section className="glass-card p-4 sm:p-5 space-y-4" aria-labelledby="cash-title">
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><h3 id="cash-title" className="text-base font-semibold">Nakit Hesabı</h3><p className="text-xs text-text-secondary">İşlemleriniz nakit bakiyesine otomatik yansır.</p></div><Button size="sm" className="w-full sm:w-auto" onClick={() => { setError(''); setOpen(true); }}>Para Yatır / Çek</Button></div>
    {cashError && <div role="alert" className="text-sm text-danger flex items-center justify-between gap-2">{cashError}<Button variant="secondary" onClick={() => void fetchPortfoliosAndTransactions()}>Tekrar Dene</Button></div>}
    {!cash?.configured ? <p className="text-sm text-text-secondary">Nakit takibini başlatmak için geçmiş para yatırma ve çekme hareketlerinizi girin. Başlangıç bakiyesi varsayılmaz.</p> : <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{cash.balances.map((row) => <div key={row.currency} className="p-3 rounded-xl bg-bg-tertiary"><p className="text-xs text-text-secondary">{row.currency} Bakiye</p><strong className={`text-lg tabular-nums ${row.amount < 0 ? 'text-danger' : 'text-text-primary'}`}>{row.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</strong><p className="text-xs text-text-muted">{row.value === null ? 'Güncel kur alınamadı' : `₺${row.value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`}</p></div>)}</div>}
    {cash?.configured && cash.hasDeficit && <p role="alert" className="p-3 rounded-xl bg-warning/10 text-warning text-sm">Nakit açığı var. Geçmiş para girişleri eksik olabilir; para yatırma/çekme kayıtlarını kontrol edin. Açık bakiyeler net portföy değerinden düşülür.</p>}
    {cash?.configured && cash.historicalDeficit && !cash.hasDeficit && <p role="alert" className="p-3 rounded-xl bg-warning/10 text-warning text-sm">Geçmişte nakit bakiyesi negatife düşmüş. Son bakiye pozitif olsa da eksik para yatırma veya döviz dönüşümü kayıtlarını kontrol edin.</p>}
    {!!cash?.missingRates.length && <p role="alert" className="text-warning text-sm">{cash.missingRates.join(', ')} kuru alınamadığı için nakit değerlemesi eksik.</p>}
    <details><summary className="min-h-11 flex items-center text-xs font-semibold text-accent cursor-pointer">Para Hareketleri ({movements.length})</summary><div className="space-y-2 max-h-80 overflow-y-auto overscroll-contain">{movements.length === 0 ? <p className="text-sm text-text-muted">Henüz para hareketi yok.</p> : movements.map((m) => <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-bg-tertiary text-xs"><div><p className="font-semibold">{m.movementType === 'deposit' ? '+' : '-'}{m.amount.toLocaleString('tr-TR')} {m.currency} · {m.movementType === 'deposit' ? 'Para Yatırma' : 'Para Çekme'}</p><p className="text-text-secondary">{m.movementDate} {m.notes && `· ${m.notes}`}</p></div><Button variant="ghost" size="sm" aria-label={`${m.movementDate} para hareketini sil`} onClick={() => setDeleting(m)}>Sil</Button></div>)}</div></details>
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title="Para Hareketi Ekle" description="Alım ve satımlar nakit bakiyesini kendiliğinden değiştirir; bunları tekrar para hareketi olarak eklemeyin.">
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setError(''); const value = Number(amount); const fx = currency === 'TRY' ? 1 : Number(rate); if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(fx) || fx <= 0 || date > today) { setError('Pozitif bir tutar, geçerli kur ve geçmiş ya da bugüne ait tarih girin.'); return; } if (kind === 'withdrawal' && value > balance + 0.000001) { setError('Bu para biriminde yeterli nakit bulunmuyor. Önce eksik para girişlerini kaydedin.'); return; } setBusy(true); try { const ok = await addCashMovement({ portfolioId: activePortfolioId, movementType: kind, amount: value, currency, exchangeRate: fx, movementDate: date, notes }); if (!ok) { setError('Para hareketi kaydedilemedi. Tekrar deneyin.'); return; } setOpen(false); setAmount(''); setNotes(''); void fetchLivePrices(); showToast({ type: 'success', title: 'Nakit Hareketi Kaydedildi', message: 'Bakiye ve portföy değeri güncellendi.' }); } finally { setBusy(false); } }}>
        <div className="grid grid-cols-2 gap-2"><Button variant={kind === 'deposit' ? 'primary' : 'secondary'} aria-pressed={kind === 'deposit'} onClick={() => setKind('deposit')}>Para Yatır</Button><Button variant={kind === 'withdrawal' ? 'primary' : 'secondary'} aria-pressed={kind === 'withdrawal'} onClick={() => setKind('withdrawal')}>Para Çek</Button></div>
        <label className="block space-y-1 text-xs text-text-secondary">Para Birimi<select value={currency} onChange={(e) => { const next = e.target.value; setCurrency(next); const quote = livePrices[`${next}TRY`]; setRate(next === 'TRY' ? '1' : quote ? String(typeof quote === 'number' ? quote : quote.price) : ''); }} className="block w-full p-3 bg-bg-input border border-border rounded-xl text-text-primary">{['TRY', 'USD', 'EUR'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <Input label="Tutar" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        {currency !== 'TRY' && <Input label={`İşlem Tarihindeki ${currency}/TRY Kuru`} type="number" min="0.000001" step="0.000001" required value={rate} onChange={(e) => setRate(e.target.value)} helperText="Net yatırılan sermaye bu kurla hesaplanır. Geçmiş kayıtlar için o tarihteki gerçek kuru girin." />}
        <Input label="Tarih" type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Açıklama" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p role="alert" className="text-danger text-sm">{error}</p>}<Button type="submit" isLoading={busy}>Kaydet</Button>
      </form>
    </Modal>
    {deleting && <ConfirmAction title="Para Hareketini Sil" description={`${deleting.amount} ${deleting.currency} hareketi silindiğinde nakit bakiyesi yeniden hesaplanacak.`} onClose={() => setDeleting(null)} onConfirm={() => deleteCashMovement(deleting.id)} />}
  </section>;
}
