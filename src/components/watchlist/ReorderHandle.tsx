'use client';
import { useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useWatchlistStore } from '@/store/useWatchlistStore';
export function ReorderHandle({ id, symbol }: { id: string; symbol: string }) {
  const dragging = useRef(false);
  const targetId = useRef<string | null>(null);
  const reorder = useWatchlistStore((s) => s.reorderItems);
  return <button type="button" aria-label={`${symbol} sırasını değiştir; ok tuşlarını kullanabilir veya sürükleyebilirsiniz`} className="shrink-0 min-h-11 min-w-11 flex items-center justify-center touch-none text-text-muted hover:text-accent cursor-grab active:cursor-grabbing"
    onPointerDown={(e) => { dragging.current = true; targetId.current = null; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={(e) => { if (!dragging.current) return; const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-watchlist-id]'); if (target?.dataset.watchlistId && target.dataset.watchlistId !== id) targetId.current = target.dataset.watchlistId; }}
    onPointerUp={() => { dragging.current = false; if (targetId.current) reorder(id, targetId.current); targetId.current = null; }} onPointerCancel={() => { dragging.current = false; }}
    onKeyDown={(e) => { if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault(); const items = useWatchlistStore.getState().items; const index = items.findIndex((i) => i.id === id); const next = items[index + (e.key === 'ArrowUp' ? -1 : 1)]; if (next) reorder(id, next.id); }}><Icon name="grip" /></button>;
}
