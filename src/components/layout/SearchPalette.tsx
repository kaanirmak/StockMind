'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, InstrumentLogo, Icon } from '@/components/ui';

type Result = { symbol: string; name: string; path: string; price: number; currency: string; kind: string };

export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const resultsRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const navigate = (path: string) => { close(); setQuery(''); router.push(path); };

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setOpen(value => !value);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(false); setActive(0);
    const timer = setTimeout(async () => {
      try {
        const [stocks, funds] = await Promise.all([
          fetch(`/api/stocks?search=${encodeURIComponent(query.trim())}`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
          fetch(`/api/funds?search=${encodeURIComponent(query.trim())}`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        ]);
        if (controller.signal.aborted) return;
        setResults([
          ...(stocks.success ? stocks.data.slice(0, 6) : []).map((s: { symbol: string; name: string; price: number; currency: string }) => ({ ...s, path: `/stocks/${s.symbol}`, kind: 'Hisse' })),
          ...(funds.success ? funds.data.slice(0, 6) : []).map((f: { code: string; name: string; price: number }) => ({ symbol: f.code, name: f.name, price: f.price, currency: 'TRY', path: `/funds/${f.code}`, kind: 'Fon' })),
        ]);
      } catch { if (!controller.signal.aborted) { setError(true); setResults([]); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open]);

  useEffect(() => {
    resultsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return <>
    <button type="button" aria-label="Hisse veya fon ara" aria-haspopup="dialog" onClick={() => setOpen(true)} className="flex-1 min-w-0 flex items-center gap-2 min-h-11 px-3 rounded-xl border border-border bg-bg-input text-text-muted text-sm text-left">
      <Icon name="search" className="w-4 h-4 shrink-0" /><span className="truncate">Hisse veya fon ara</span><kbd className="hidden lg:block ml-auto text-xs shrink-0">⌘K</kbd>
    </button>
    <Modal isOpen={open} onClose={close} title="Piyasalarda ara" size="lg" presentation="spotlight" showCloseButton={false}>
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Icon name="search" className="w-5 h-5 text-accent shrink-0" />
        <input autoFocus style={{ outline: 'none' }} role="combobox" aria-label="Hisse veya fon ara" aria-expanded={true} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={results[active] ? `${listId}-${active}` : undefined} value={query} onChange={event => setQuery(event.target.value)} placeholder="Şirket adı, hisse veya fon kodu" className="w-full min-w-0 bg-transparent text-base sm:text-xl text-text-primary placeholder:text-text-muted outline-none" onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(index => results.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0); }
          if (event.key === 'Enter' && results[active] && !loading) { event.preventDefault(); navigate(results[active].path); }
        }} />
        <button type="button" aria-label="Aramayı kapat" onClick={close} className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-hover">✕</button>
      </div>
      <div ref={resultsRef} id={listId} role="listbox" aria-label="Arama sonuçları" aria-busy={loading} className="max-h-[48dvh] overflow-y-auto overscroll-contain pt-2 space-y-1">
        {loading ? <p role="status" className="p-4 text-sm text-text-muted">Aranıyor…</p> : error ? <p role="status" className="p-4 text-sm text-danger">Arama yüklenemedi. Tekrar deneyin.</p> : results.map((result, index) => <button key={result.path} id={`${listId}-${index}`} role="option" aria-selected={active === index} onClick={() => navigate(result.path)} className={`w-full min-w-0 flex items-center gap-3 p-3 rounded-xl text-left ${active === index ? 'bg-accent/10' : 'hover:bg-bg-hover'}`}>
          <InstrumentLogo symbol={result.symbol} name={result.name} size="md" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">{result.symbol}<span className="ml-2 text-xs font-normal text-text-muted">{result.kind}</span></span><span className="block truncate text-xs text-text-secondary">{result.name}</span></span>
          <span className="shrink-0 text-xs tabular-nums text-text-primary">{Number(result.price || 0).toLocaleString('tr-TR', { style: 'currency', currency: result.currency || 'TRY', maximumFractionDigits: result.kind === 'Fon' ? 4 : 2 })}</span>
        </button>)}
        {!loading && !error && !results.length && <p role="status" className="p-4 text-sm text-text-muted">{query.trim() ? 'Eşleşen varlık bulunamadı.' : 'Aramaya başlamak için bir şirket adı veya kod yazın.'}</p>}
      </div>
      <p className="hidden sm:block border-t border-border mt-3 pt-3 text-xs text-text-muted">↑ ↓ Seç · Enter Aç · Esc Kapat</p>
    </Modal>
  </>;
}
