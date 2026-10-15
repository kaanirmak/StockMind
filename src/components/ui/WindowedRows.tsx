'use client';
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';

/** Window-scroll table virtualization. Keeps native table and link semantics. */
export function WindowedRows({ children, columns, rowHeight = 76 }: { children: ReactNode; columns: number; rowHeight?: number }) {
  const rows = Children.toArray(children);
  const anchor = useRef<HTMLTableRowElement>(null);
  const [range, setRange] = useState({ start: 0, end: 40 });
  const [height, setHeight] = useState(rowHeight);
  const enabled = rows.length > 80;
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const marker = anchor.current;
        if (!marker || !marker.getClientRects().length) return;
        const top = marker.getBoundingClientRect().top;
        const start = Math.max(0, Math.min(rows.length - 1, Math.floor(-top / height) - 10));
        const end = Math.min(rows.length, start + Math.ceil(window.innerHeight / height) + 20);
        setRange((old) => old.start === start && old.end === end ? old : { start, end });
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [enabled, rows.length, height]);
  useEffect(() => {
    if (!enabled) return;
    const first = anchor.current?.nextElementSibling?.nextElementSibling;
    const measured = first?.getBoundingClientRect().height;
    if (measured && Math.abs(measured - height) > 1) setHeight(measured);
  }, [enabled, range, height]);
  if (!enabled) return <>{rows}</>;
  const start = Math.min(range.start, rows.length);
  const end = Math.max(start, Math.min(range.end, rows.length));
  return <><tr ref={anchor} aria-hidden="true" style={{ height: 0 }}><td colSpan={columns} style={{ padding: 0, border: 0 }} /></tr><tr aria-hidden="true" style={{ height: start * height }}><td colSpan={columns} style={{ padding: 0, border: 0 }} /></tr>{rows.slice(start, end)}<tr aria-hidden="true" style={{ height: (rows.length - end) * height }}><td colSpan={columns} style={{ padding: 0, border: 0 }} /></tr></>;
}
