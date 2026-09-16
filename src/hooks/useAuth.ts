import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/types';

export function useAuth() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        const userProf: UserProfile = {
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          avatarUrl: data.avatar_url,
          preferredLanguage: data.preferred_language || 'tr',
          preferredCurrency: data.preferred_currency || 'TRY',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        setProfile(userProf);
        useAuthStore.getState().setUser(userProf);
        return userProf;
      }
    } catch (e) {
      console.warn('fetchProfile error:', e);
    }
    return null;
  }, [supabase]);

  const updateProfile = async (updates: {
    fullName?: string;
    preferredLanguage?: 'tr' | 'en';
    preferredCurrency?: string;
    avatarUrl?: string;
  }) => {
    if (!user) return false;
    try {
      const payload: any = {
        id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (updates.fullName !== undefined) payload.full_name = updates.fullName;
      if (updates.preferredLanguage !== undefined) payload.preferred_language = updates.preferredLanguage;
      if (updates.preferredCurrency !== undefined) payload.preferred_currency = updates.preferredCurrency;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      if (!error && data) {
        const updatedProf: UserProfile = {
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          avatarUrl: data.avatar_url,
          preferredLanguage: data.preferred_language || 'tr',
          preferredCurrency: data.preferred_currency || 'TRY',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        setProfile(updatedProf);
        useAuthStore.getState().setUser(updatedProf);
        return true;
      }
    } catch (e) {
      console.error('updateProfile error:', e);
    }
    return false;
  };

  useEffect(() => {
    let isMounted = true;

    const getUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id);
            useWatchlistStore.getState().loadUserWatchlist(currentUser.id);
          } else {
            setProfile(null);
            useAuthStore.getState().clearUser();
            useWatchlistStore.getState().loadUserWatchlist(null);
          }
          usePortfolioStore.getState().fetchPortfoliosAndTransactions();
        }
      } catch (err) {
        console.warn('getUser auth error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const authUser = session?.user ?? null;
        if (isMounted) {
          setUser(authUser);
          if (authUser) {
            await fetchProfile(authUser.id);
            useWatchlistStore.getState().loadUserWatchlist(authUser.id);
          } else {
            setProfile(null);
            useAuthStore.getState().clearUser();
            useWatchlistStore.getState().loadUserWatchlist(null);
          }
          usePortfolioStore.getState().fetchPortfoliosAndTransactions();
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut error:', e);
    }
    document.cookie = 'stockmind_guest=; path=/; max-age=0';
    setUser(null);
    setProfile(null);
    useAuthStore.getState().clearUser();
    usePortfolioStore.getState().resetStore();
    useWatchlistStore.getState().resetWatchlist();
    window.location.href = '/login';
  };

  return {
    user,
    profile,
    loading,
    signOut,
    updateProfile,
    isAuthenticated: !!user,
  };
}
