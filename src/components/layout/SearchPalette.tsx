'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, InstrumentLogo, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui/Icon';
import { useTheme } from '@/components/theme/ThemeProvider';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { describeSearchResult } from '@/lib/market/searchResultDescriptor';
import { THEME_PRESETS } from '@/lib/theme/themeConfig';

type Result = {
  symbol: string;
  name: string;
  path: string;
  price: number | null;
  currency: string;
  kind: string;
  exchange: string;
};

type QuickCommand = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string;
  badge: string;
  icon: IconName;
  run: () => void;
};

export function SearchPalette() {
  const router = useRouter();
  const { resolvedPreset, density, setTheme, setDensity } = useTheme();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const resultsRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery('');
      setResults([]);
      setError(false);
      setLoading(false);
      router.push(path);
    },
    [router]
  );

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      setActive(0);
      try {
        const [stocks, funds] = await Promise.all([
          fetch(`/api/stocks?search=${encodeURIComponent(trimmed)}`, { signal: controller.signal }).then((r) => {
            if (!r.ok) throw new Error();
            return r.json();
          }),
          fetch(`/api/funds?search=${encodeURIComponent(trimmed)}`, { signal: controller.signal }).then((r) => {
            if (!r.ok) throw new Error();
            return r.json();
          }),
        ]);
        if (controller.signal.aborted) return;
        setResults([
          ...(stocks.success ? stocks.data.slice(0, 6) : []).map(
            (s: { symbol: string; name: string; price: number; currency?: string; exchange?: string; assetType?: string; isIndex?: boolean }) => {
              const desc = describeSearchResult(s);
              return {
                ...s,
                symbol: desc.symbol,
                name: desc.name,
                currency: desc.currency,
                exchange: desc.exchange,
                kind: desc.assetTypeLabel,
                path: `/stocks/${s.symbol}`,
              };
            }
          ),
          ...(funds.success ? funds.data.slice(0, 6) : []).map(
            (f: { code: string; name: string; price: number | null }) => {
              const desc = describeSearchResult({
                code: f.code,
                name: f.name,
                exchange: 'TEFAS',
                assetType: 'fund',
                currency: 'TRY',
              });
              return {
                symbol: desc.symbol,
                name: desc.name,
                price: f.price,
                currency: desc.currency,
                exchange: desc.exchange,
                kind: desc.assetTypeLabel,
                path: `/funds/${f.code}`,
              };
            }
          ),
        ]);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const allQuickCommands = useMemo<QuickCommand[]>(() => {
    const themeCommands: QuickCommand[] = THEME_PRESETS.map((preset) => ({
      id: `theme-${preset.id}`,
      title: `Tema: ${preset.name}`,
      subtitle: preset.subtitle,
      keywords: `tema theme gorunum tasarım tasarim ${preset.name.toLowerCase()} ${preset.id}`,
      badge: resolvedPreset === preset.id ? 'Aktif' : 'Tema',
      icon: 'sparkles',
      run: () => {
        setTheme(preset.id, { syncAccent: true });
        close();
        setQuery('');
      },
    }));

    return [
      {
        id: 'toggle-privacy',
        title: isPrivacyMode ? 'Gizlilik Modunu Kapat (Bakiyeleri Göster)' : 'Gizlilik Modunu Aç (Bakiyeleri Gizle)',
        subtitle: 'Portföy ve kâr/zarar tutarlarını maskeler',
        keywords: 'gizlilik privacy maskele bakiye sakla goster',
        badge: isPrivacyMode ? 'Açık' : 'Hızlı',
        icon: 'wallet',
        run: () => {
          togglePrivacyMode();
          close();
          setQuery('');
        },
      },
      {
        id: 'toggle-density',
        title: density === 'compact' ? 'Yoğunluk: Rahat Görünüme Geç' : 'Yoğunluk: Sıkı (Terminal) Görünüme Geç',
        subtitle: 'Kart boşluklarını ve satır aralığını daraltır',
        keywords: 'yogunluk yoğunluk compact sıkı terminal rahat',
        badge: density === 'compact' ? 'Sıkı' : 'Komut',
        icon: 'layers',
        run: () => {
          setDensity(density === 'compact' ? 'comfortable' : 'compact');
          close();
          setQuery('');
        },
      },
      {
        id: 'go-portfolio',
        title: 'Portföy Özeti & Varlık Dağılımı',
        subtitle: 'Açık pozisyonlar, performans ve kart paylaşımı',
        keywords: 'portfoy portföy varlik bakiye hisse',
        badge: 'Sayfa',
        icon: 'chart',
        run: () => navigate('/portfolio'),
      },
      {
        id: 'go-alerts',
        title: 'Fiyat & Portföy Alarmları',
        subtitle: 'Hedef fiyat ve yüzde değişim kuralları',
        keywords: 'alarm alarmlar uyari bildirim',
        badge: 'Sayfa',
        icon: 'bell',
        run: () => navigate('/alerts'),
      },
      {
        id: 'go-activity',
        title: 'Bildirim Merkezi & Hareketler',
        subtitle: 'Son alarm tetiklemeleri ve sistem akışı',
        keywords: 'aktivite activity bildirim hareket gecmis',
        badge: 'Sayfa',
        icon: 'history',
        run: () => navigate('/activity'),
      },
      {
        id: 'go-design-studio',
        title: 'Tasarım Stüdyosu & Tema Ayarları',
        subtitle: '5 tema paleti, vurgu rengi ve P&L modu',
        keywords: 'ayarlar settings tasarim tasarım tema studio',
        badge: 'Ayarlar',
        icon: 'settings',
        run: () => navigate('/settings#appearance'),
      },
      ...themeCommands,
    ];
  }, [resolvedPreset, density, isPrivacyMode, setTheme, setDensity, togglePrivacyMode, close, navigate]);

  const matchingCommands = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return allQuickCommands;
    return allQuickCommands.filter(
      (cmd) =>
        cmd.title.toLocaleLowerCase('tr-TR').includes(q) ||
        cmd.subtitle.toLocaleLowerCase('tr-TR').includes(q) ||
        cmd.keywords.includes(q)
    );
  }, [allQuickCommands, query]);

  const visibleResults = query.trim() ? results : [];
  const visibleLoading = Boolean(query.trim()) && loading;
  const visibleError = Boolean(query.trim()) && error;
  const totalItems = visibleResults.length + matchingCommands.length;
  const activeIndex = totalItems > 0 ? Math.min(active, totalItems - 1) : 0;

  useEffect(() => {
    resultsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const executeItemAt = (index: number) => {
    if (index < visibleResults.length) {
      const target = visibleResults[index];
      if (target) navigate(target.path);
      return;
    }
    const command = matchingCommands[index - visibleResults.length];
    if (command) command.run();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Hisse veya fon ara"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex-1 min-w-0 flex items-center gap-2 min-h-11 px-3 rounded-xl border border-border bg-bg-input text-text-muted text-sm text-left hover:border-border-hover transition-colors"
      >
        <Icon name="search" className="w-4 h-4 shrink-0" />
        <span className="truncate">Hisse, fon veya komut ara</span>
        <kbd className="hidden lg:block ml-auto text-xs shrink-0 px-1.5 py-0.5 rounded bg-bg-tertiary border border-border/70">⌘K</kbd>
      </button>
      <Modal
        isOpen={open}
        onClose={close}
        title="Hızlı arama ve komutlar"
        size="lg"
        presentation="spotlight"
        showCloseButton={false}
      >
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <Icon name="search" className="w-5 h-5 text-accent shrink-0" />
          <input
            autoFocus
            style={{ outline: 'none' }}
            role="combobox"
            aria-label="Hisse veya fon ara"
            aria-expanded={true}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={totalItems > 0 ? `${listId}-${activeIndex}` : undefined}
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              setActive(0);
              if (!next.trim()) {
                setResults([]);
                setLoading(false);
                setError(false);
              }
            }}
            placeholder="Hisse/fon kodu yazın ya da tema & komut arayın"
            className="w-full min-w-0 bg-transparent text-base sm:text-xl text-text-primary placeholder:text-text-muted outline-none"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) =>
                  totalItems ? (index + (event.key === 'ArrowDown' ? 1 : -1) + totalItems) % totalItems : 0
                );
              }
              if (event.key === 'Enter' && totalItems > 0 && !visibleLoading) {
                event.preventDefault();
                executeItemAt(activeIndex);
              }
            }}
          />
          <button
            type="button"
            aria-label="Aramayı kapat"
            onClick={close}
            className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-hover"
          >
            ✕
          </button>
        </div>

        <div
          ref={resultsRef}
          id={listId}
          role="listbox"
          aria-label="Arama sonuçları ve hızlı komutlar"
          aria-busy={visibleLoading}
          className="max-h-[52dvh] overflow-y-auto overscroll-contain pt-2 space-y-1"
        >
          {visibleLoading && <p role="status" className="p-4 text-sm text-text-muted">Aranıyor…</p>}
          {!visibleLoading && visibleError && (
            <p role="status" className="p-4 text-sm text-danger">Arama yüklenemedi. Tekrar deneyin.</p>
          )}

          {!visibleLoading &&
            !visibleError &&
            visibleResults.map((result, index) => (
              <button
                key={result.path}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onClick={() => navigate(result.path)}
                className={`w-full min-w-0 flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                  activeIndex === index ? 'bg-accent/10' : 'hover:bg-bg-hover'
                }`}
              >
                <InstrumentLogo symbol={result.symbol} name={result.name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <span>{result.symbol}</span>
                    <span className="px-1.5 py-0.5 rounded bg-bg-tertiary border border-border/70 text-[10px] font-mono text-text-secondary">
                      {result.exchange}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-accent/10 text-[10px] font-medium text-accent">
                      {result.kind}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-bg-tertiary/70 text-[10px] font-mono text-text-muted">
                      {result.currency}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-text-secondary">{result.name}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-text-primary">
                  {result.price == null
                    ? 'Fiyat yok'
                    : result.price.toLocaleString('tr-TR', {
                        style: 'currency',
                        currency: result.currency || 'TRY',
                        maximumFractionDigits: result.kind === 'Fon' ? 4 : 2,
                      })}
                </span>
              </button>
            ))}

          {matchingCommands.length > 0 && (
            <div className={visibleResults.length > 0 ? 'pt-2 mt-2 border-t border-border/60 space-y-1' : 'space-y-1'}>
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Hızlı Komutlar
              </p>
              {matchingCommands.map((command, cmdIdx) => {
                const flatIndex = visibleResults.length + cmdIdx;
                return (
                  <button
                    key={command.id}
                    id={`${listId}-${flatIndex}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === flatIndex}
                    onClick={command.run}
                    className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      activeIndex === flatIndex ? 'bg-accent/10' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-bg-tertiary border border-border/70 flex items-center justify-center text-accent shrink-0">
                      <Icon name={command.icon} className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text-primary">{command.title}</span>
                      <span className="block truncate text-xs text-text-muted">{command.subtitle}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg-tertiary border border-border/70 text-text-secondary">
                      {command.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!visibleLoading && !visibleError && totalItems === 0 && (
            <p role="status" className="p-4 text-sm text-text-muted">
              Eşleşen varlık veya komut bulunamadı.
            </p>
          )}
        </div>
        <p className="hidden sm:block border-t border-border mt-3 pt-3 text-xs text-text-muted">
          ↑ ↓ Seç · Enter Uygula · Esc Kapat
        </p>
      </Modal>
    </>
  );
}
