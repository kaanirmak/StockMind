'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PRIVACY_EVENT,
  PRIVACY_STORAGE_KEY,
  readPrivacyMode,
  writePrivacyMode,
} from '@/lib/privacy';

export function usePrivacyMode() {
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => setIsPrivacyMode(readPrivacyMode());
    sync();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === PRIVACY_STORAGE_KEY) {
        sync();
      }
    };

    window.addEventListener(PRIVACY_EVENT, sync);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(PRIVACY_EVENT, sync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setPrivacyMode = useCallback((next: boolean) => {
    const updated = writePrivacyMode(next);
    setIsPrivacyMode(updated);
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode((prev) => writePrivacyMode(!prev));
  }, []);

  return {
    isPrivacyMode,
    setPrivacyMode,
    togglePrivacyMode,
  };
}
