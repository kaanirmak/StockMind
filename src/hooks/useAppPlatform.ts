'use client';
import { useEffect, useState } from 'react';
import { detectAppPlatform } from '@/lib/utils/appPlatform';

export function useAppPlatform() {
  const [platform, setPlatform] = useState(() => detectAppPlatform({ userAgent: '' }));
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () => setPlatform(detectAppPlatform({
      userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
      standalone: media.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      nativeAndroid: !!(window as Window & { StockMindAndroid?: unknown }).StockMindAndroid,
    }));
    update(); media.addEventListener('change', update); window.addEventListener('appinstalled', update);
    return () => { media.removeEventListener('change', update); window.removeEventListener('appinstalled', update); };
  }, []);
  return platform;
}
