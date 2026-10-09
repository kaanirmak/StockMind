'use client';

import { useState, useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';

const GLOBAL_KEY_STORAGE = 'stockmind_openrouter_api_key';
const GLOBAL_MODEL_STORAGE = 'stockmind_openrouter_model';

/**
 * Retrieves the stored OpenRouter API key from any available local storage locations.
 * Infallible multi-strategy lookup ensures keys saved in Settings, Assistant, or Quant are always found.
 */
export function getStoredOpenRouterKey(userId?: string | null): string {
  if (typeof window === 'undefined') return '';

  try {
    // 1. Direct dedicated global key
    const directKey = localStorage.getItem(GLOBAL_KEY_STORAGE);
    if (directKey && directKey.trim()) {
      return directKey.trim();
    }

    // 2. User specific settings (with user_ prefix)
    if (userId && userId !== 'guest') {
      const userKey1 = localStorage.getItem(`stockmind_settings_user_${userId}`);
      if (userKey1) {
        const parsed = JSON.parse(userKey1);
        const key = parsed.openRouterKey || parsed.openRouterApiKey || parsed.apiKey;
        if (key && typeof key === 'string' && key.trim()) return key.trim();
      }

      // User specific settings (without user_ prefix)
      const userKey2 = localStorage.getItem(`stockmind_settings_${userId}`);
      if (userKey2) {
        const parsed = JSON.parse(userKey2);
        const key = parsed.openRouterKey || parsed.openRouterApiKey || parsed.apiKey;
        if (key && typeof key === 'string' && key.trim()) return key.trim();
      }
    }

    // 3. Guest settings
    const guestSettings = localStorage.getItem('stockmind_settings_guest');
    if (guestSettings) {
      const parsed = JSON.parse(guestSettings);
      const key = parsed.openRouterKey || parsed.openRouterApiKey || parsed.apiKey;
      if (key && typeof key === 'string' && key.trim()) return key.trim();
    }

    // 4. Exhaustive search across any settings or keys stored in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      const raw = localStorage.getItem(k);
      if (!raw) continue;

      // If the raw item value itself is directly an API key
      if (raw.trim().startsWith('sk-or-') || (raw.trim().startsWith('sk-') && raw.trim().length > 20)) {
        return raw.trim();
      }

      if (k.startsWith('stockmind_settings_') || k.includes('openrouter') || k.includes('ai')) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const key = parsed.openRouterKey || parsed.openRouterApiKey || parsed.apiKey;
            if (key && typeof key === 'string' && key.trim().length > 5) {
              return key.trim();
            }
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('Error retrieving OpenRouter API key:', err);
  }

  return '';
}

/**
 * Retrieves the preferred AI model.
 */
export function getStoredDefaultModel(userId?: string | null): string {
  if (typeof window === 'undefined') return 'openrouter/free';

  try {
    const globalModel = localStorage.getItem(GLOBAL_MODEL_STORAGE);
    if (globalModel) return globalModel;

    const userKey = userId && userId !== 'guest' ? `user_${userId}` : 'guest';
    const settings = localStorage.getItem(`stockmind_settings_${userKey}`);
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.defaultModel) return parsed.defaultModel;
    }
  } catch (_) {}

  return 'openrouter/free';
}

/**
 * Universally saves the OpenRouter API key across all storage locations and fires a sync event.
 */
export function saveStoredOpenRouterKey(
  key: string,
  userId?: string | null,
  model?: string
): void {
  if (typeof window === 'undefined') return;

  const cleanKey = (key || '').trim();

  try {
    // 1. Save to global keys
    if (cleanKey) {
      localStorage.setItem(GLOBAL_KEY_STORAGE, cleanKey);
    } else {
      localStorage.removeItem(GLOBAL_KEY_STORAGE);
    }

    if (model) {
      localStorage.setItem(GLOBAL_MODEL_STORAGE, model);
    }

    // 2. Sync to user and guest settings dictionaries
    const targets = ['guest'];
    if (userId && userId !== 'guest') {
      targets.push(`user_${userId}`);
      targets.push(userId);
    }

    for (const t of targets) {
      const storageKey = `stockmind_settings_${t}`;
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.openRouterKey = cleanKey;
      parsed.openRouterApiKey = cleanKey;
      if (model) parsed.defaultModel = model;
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    }

    // 3. Dispatch custom window event so all components update instantaneously
    window.dispatchEvent(
      new CustomEvent('stockmind_ai_key_updated', {
        detail: { key: cleanKey, model: model || 'openrouter/free' },
      })
    );
    window.dispatchEvent(new Event('storage'));

    // 4. Background cloud sync to Supabase auth metadata so the key is available across all user devices
    if (userId && userId !== 'guest') {
      try {
        const supabase = createClient();
        supabase.auth.updateUser({
          data: { openrouter_api_key: cleanKey },
        }).catch((e: any) => console.warn('Supabase key sync warning:', e));
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Error saving OpenRouter API key:', err);
  }
}

/**
 * React hook to access and synchronize OpenRouter key across the application.
 */
export function useOpenRouterKey(userId?: string | null) {
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>('openrouter/free');

  useEffect(() => {
    const sync = () => {
      setApiKey(getStoredOpenRouterKey(userId));
      setModel(getStoredDefaultModel(userId));
    };

    sync();

    const handleUpdate = () => sync();
    window.addEventListener('stockmind_ai_key_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('stockmind_ai_key_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [userId]);

  const updateKey = (newKey: string, newModel?: string) => {
    saveStoredOpenRouterKey(newKey, userId, newModel || model);
    setApiKey(newKey.trim());
    if (newModel) setModel(newModel);
  };

  return {
    apiKey,
    setApiKey: updateKey,
    model,
    setModel: (m: string) => updateKey(apiKey, m),
    hasKey: Boolean(apiKey && apiKey.trim().length > 0),
  };
}
