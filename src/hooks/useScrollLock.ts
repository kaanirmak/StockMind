'use client';

import { useEffect } from 'react';

const locks = new Set<symbol>();
let restore: (() => void) | undefined;

/** Shared by all overlays; closing one must never unlock another. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const token = Symbol('overlay');
    if (locks.size === 0) {
      const body = document.body;
      const html = document.documentElement;
      const y = window.scrollY;
      const previous = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow, paddingRight: body.style.paddingRight, htmlOverflow: html.style.overflow };
      const gap = window.innerWidth - html.clientWidth;
      body.style.position = 'fixed';
      body.style.top = `-${y}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      html.dataset.scrollLocked = 'true';
      if (gap > 0) body.style.paddingRight = `${gap}px`;
      restore = () => {
        Object.assign(body.style, { position: previous.position, top: previous.top, width: previous.width, overflow: previous.overflow, paddingRight: previous.paddingRight });
        html.style.overflow = previous.htmlOverflow;
        delete html.dataset.scrollLocked;
        window.scrollTo({ top: y, behavior: 'instant' });
      };
    }
    locks.add(token);
    return () => {
      locks.delete(token);
      if (locks.size === 0) { restore?.(); restore = undefined; }
    };
  }, [active]);
}
