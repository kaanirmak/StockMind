'use client';

import { useState, useEffect } from 'react';

const USER_KEY_PREFIX = 'stockmind_user_ai_key_';
const USER_MODEL_PREFIX = 'stockmind_user_ai_model_';

/**
 * Retrieves the stored OpenRouter API key strictly for the specified authenticated user.
 * Keys are isolated per user account and never shared with guest or other accounts.
 */
export function getStoredOpenRouterKey(userId?: string | null): string {
  if (typeof window === 'undefined' || !userId || userId === 'guest') return '';

  try {
    const scopedKey = localStorage.getItem(`${USER_KEY_PREFIX}${userId}`);
    if (scopedKey && scopedKey.trim()) {
      return scopedKey.trim();
    }
  } catch (err) {
    console.warn('Error retrieving OpenRouter API key:', err);
  }

  return '';
}

/**
 * Retrieves the preferred AI model for the specified user.
 */
export function getStoredDefaultModel(userId?: string | null): string {
  if (typeof window === 'undefined') return 'openrouter/free';

  try {
    if (userId && userId !== 'guest') {
      const scopedModel = localStorage.getItem(`${USER_MODEL_PREFIX}${userId}`);
      if (scopedModel) return scopedModel;
      const legacy = JSON.parse(localStorage.getItem(`stockmind_settings_${userId}`) || '{}');
      if (typeof legacy.defaultModel === 'string' && legacy.defaultModel.trim()) return legacy.defaultModel.trim();
    }
  } catch (_) {}

  return 'openrouter/free';
}

/** Model changes must never rewrite or remove a separately saved API key. */
export function saveStoredDefaultModel(model: string, userId?: string | null): void {
  if (typeof window === 'undefined' || !userId || userId === 'guest' || !model.trim()) return;
  try {
    localStorage.setItem(`${USER_MODEL_PREFIX}${userId}`, model.trim());
    window.dispatchEvent(new Event('stockmind_ai_key_updated'));
  } catch (error) { console.warn('AI model tercihi kaydedilemedi:', error); }
}

/**
 * Saves the OpenRouter API key strictly scoped to the active authenticated user.
 * Never writes to global localStorage, guest storage, or Supabase JWT auth metadata.
 */
export function saveStoredOpenRouterKey(
  key: string,
  userId?: string | null,
  model?: string
): void {
  if (typeof window === 'undefined') return;

  const cleanKey = (key || '').trim();

  try {
    // 1. Scoped user storage only (guest cannot persist shared API keys)
    if (userId && userId !== 'guest') {
      const storageKey = `${USER_KEY_PREFIX}${userId}`;
      const modelKey = `${USER_MODEL_PREFIX}${userId}`;

      if (cleanKey) {
        localStorage.setItem(storageKey, cleanKey);
      } else {
        localStorage.removeItem(storageKey);
      }

      if (model) {
        localStorage.setItem(modelKey, model);
      }
    }

    // 2. Clean legacy global/guest keys if present to prevent cross-account pollution
    try {
      localStorage.removeItem('stockmind_openrouter_api_key');
      localStorage.removeItem('stockmind_openrouter_model');
      const guestRaw = localStorage.getItem('stockmind_settings_guest');
      if (guestRaw) {
        const parsed = JSON.parse(guestRaw);
        if (parsed.openRouterKey || parsed.openRouterApiKey || parsed.apiKey) {
          delete parsed.openRouterKey;
          delete parsed.openRouterApiKey;
          delete parsed.apiKey;
          localStorage.setItem('stockmind_settings_guest', JSON.stringify(parsed));
        }
      }
    } catch (_) {}

    // 3. Dispatch event strictly for active window
    window.dispatchEvent(
      new CustomEvent('stockmind_ai_key_updated', {
        detail: { key: cleanKey, model: model || 'openrouter/free' },
      })
    );
    window.dispatchEvent(new Event('storage'));
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
    setModel: (m: string) => {
      saveStoredDefaultModel(m, userId);
      setModel(m);
    },
    hasKey: Boolean(apiKey && apiKey.trim().length > 0),
  };
}
