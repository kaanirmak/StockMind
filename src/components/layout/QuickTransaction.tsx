'use client';
import { useEffect, useState } from 'react';
import { TransactionModal } from '@/components/portfolio/TransactionModal';
import { Icon } from '@/components/ui/Icon';
import {
  TRANSACTION_RECORD_ACTION_LABEL,
  TRANSACTION_RECORD_DEFAULT_MODE,
} from '@/lib/portfolio/transactionActionLabel';
export function QuickTransaction() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyA') { e.preventDefault(); show(); } };
    window.addEventListener('stockmind:add-transaction', show);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('stockmind:add-transaction', show); window.removeEventListener('keydown', key); };
  }, []);
  return <><button type="button" onClick={() => setOpen(true)} title={`${TRANSACTION_RECORD_ACTION_LABEL} (Ctrl/⌘ + Shift + A)`} className="hidden xl:flex fixed right-5 bottom-5 z-30 items-center gap-2 rounded-xl bg-accent text-white px-4 py-3 shadow-elevated font-semibold hover:opacity-95 transition-all cursor-pointer"><Icon name="plus" />{TRANSACTION_RECORD_ACTION_LABEL}</button><TransactionModal presentation="drawer" isOpen={open} onClose={() => setOpen(false)} initialMode={TRANSACTION_RECORD_DEFAULT_MODE} /></>;
}
