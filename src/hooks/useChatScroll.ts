'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Follow new content only until the reader takes control of scrolling. */
export function useChatScroll(content: unknown, sessionId: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const touchingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const [showLatest, setShowLatest] = useState(false);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const scheduleFollow = useCallback(() => {
    cancelFrame();
    if (!followingRef.current || touchingRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const el = containerRef.current;
      if (el && followingRef.current && !touchingRef.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });
      }
    });
  }, [cancelFrame]);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
    followingRef.current = distance <= 8 && !touchingRef.current;
    setShowLatest(distance > 80);
  }, []);

  const stopFollowing = useCallback(() => {
    followingRef.current = false;
    cancelFrame();
    const el = containerRef.current;
    // Cancel a pending smooth "latest message" jump before native panning begins.
    if (el) el.scrollTo({ top: el.scrollTop, behavior: 'instant' });
  }, [cancelFrame]);

  const onTouchStart = useCallback(() => {
    touchingRef.current = true;
    stopFollowing();
  }, [stopFollowing]);

  const onTouchEnd = useCallback(() => {
    touchingRef.current = false;
    onScroll();
  }, [onScroll]);

  const followLatest = useCallback((behavior: ScrollBehavior = 'instant') => {
    cancelFrame();
    followingRef.current = true;
    touchingRef.current = false;
    setShowLatest(false);
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, [cancelFrame]);

  useEffect(scheduleFollow, [content, scheduleFollow]);
  useEffect(() => {
    followingRef.current = true;
    scheduleFollow();
  }, [sessionId, scheduleFollow]);

  useEffect(() => {
    const observer = new ResizeObserver(scheduleFollow);
    if (containerRef.current) observer.observe(containerRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => {
      observer.disconnect();
      cancelFrame();
    };
  }, [scheduleFollow, cancelFrame]);

  return { containerRef, contentRef, showLatest, followLatest, onScroll, onTouchStart, onTouchEnd, onWheel: stopFollowing };
}
