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

  const fetchProfile = useCallback(async (userId: string, currentUser?: User | null) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const userProf: UserProfile = {
        id: userId,
        username: data?.username || currentUser?.email?.split('@')[0] || 'kullanici',
        fullName: data?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || null,
        avatarUrl: data?.avatar_url || currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture || null,
        preferredLanguage: data?.preferred_language || 'tr',
        preferredCurrency: data?.preferred_currency || 'TRY',
        createdAt: data?.created_at || new Date().toISOString(),
        updatedAt: data?.updated_at || new Date().toISOString(),
      };
      setProfile(userProf);
      useAuthStore.getState().setUser(userProf);
      return userProf;
    } catch (e) {
      console.warn('fetchProfile error:', e);
      if (currentUser) {
        const fallbackProf: UserProfile = {
          id: userId,
          username: currentUser.email?.split('@')[0] || 'kullanici',
          fullName: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || null,
          avatarUrl: currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || null,
          preferredLanguage: 'tr',
          preferredCurrency: 'TRY',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setProfile(fallbackProf);
        useAuthStore.getState().setUser(fallbackProf);
        return fallbackProf;
      }
    }
    return null;
  }, [supabase]);

  const updateProfile = async (updates: {
    fullName?: string;
    preferredLanguage?: 'tr' | 'en';
    preferredCurrency?: string;
    avatarUrl?: string | null;
  }) => {
    if (!user) {
      // Guest profile update
      const guestProf: UserProfile = {
        id: 'guest',
        username: 'guest',
        fullName: updates.fullName !== undefined ? updates.fullName : (profile?.fullName || 'Misafir Kullanıcı'),
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : (profile?.avatarUrl || null),
        preferredLanguage: updates.preferredLanguage || profile?.preferredLanguage || 'tr',
        preferredCurrency: updates.preferredCurrency || profile?.preferredCurrency || 'TRY',
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProfile(guestProf);
      useAuthStore.getState().setUser(guestProf);
      try {
        localStorage.setItem('stockmind_guest_profile', JSON.stringify(guestProf));
      } catch (e) {}
      return true;
    }

    try {
      const payload: any = {
        id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (updates.fullName !== undefined) payload.full_name = updates.fullName;
      if (updates.preferredLanguage !== undefined) payload.preferred_language = updates.preferredLanguage;
      if (updates.preferredCurrency !== undefined) payload.preferred_currency = updates.preferredCurrency;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

      // Update Supabase auth user metadata as well
      try {
        await supabase.auth.updateUser({
          data: {
            full_name: updates.fullName !== undefined ? updates.fullName : (user.user_metadata?.full_name || ''),
            avatar_url: updates.avatarUrl !== undefined ? updates.avatarUrl : (user.user_metadata?.avatar_url || null),
          },
        });
      } catch (authMetaErr) {
        console.warn('Failed to update auth metadata:', authMetaErr);
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      const updatedProf: UserProfile = {
        id: user.id,
        username: data?.username || profile?.username || user.email?.split('@')[0] || 'kullanici',
        fullName: updates.fullName !== undefined ? updates.fullName : (data?.full_name || profile?.fullName || null),
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : (data?.avatar_url || profile?.avatarUrl || null),
        preferredLanguage: updates.preferredLanguage || data?.preferred_language || profile?.preferredLanguage || 'tr',
        preferredCurrency: updates.preferredCurrency || data?.preferred_currency || profile?.preferredCurrency || 'TRY',
        createdAt: data?.created_at || profile?.createdAt || new Date().toISOString(),
        updatedAt: data?.updated_at || new Date().toISOString(),
      };
      setProfile(updatedProf);
      useAuthStore.getState().setUser(updatedProf);
      return true;
    } catch (e) {
      console.error('updateProfile error:', e);
      // Fallback local update
      const fallbackProf: UserProfile = {
        id: user.id,
        username: profile?.username || user.email?.split('@')[0] || 'kullanici',
        fullName: updates.fullName !== undefined ? updates.fullName : (profile?.fullName || null),
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : (profile?.avatarUrl || null),
        preferredLanguage: updates.preferredLanguage || profile?.preferredLanguage || 'tr',
        preferredCurrency: updates.preferredCurrency || profile?.preferredCurrency || 'TRY',
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProfile(fallbackProf);
      useAuthStore.getState().setUser(fallbackProf);
      return true;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadGuestProfile = () => {
      try {
        const savedGuest = localStorage.getItem('stockmind_guest_profile');
        if (savedGuest) {
          const parsed = JSON.parse(savedGuest);
          setProfile(parsed);
          useAuthStore.getState().setUser(parsed);
          return;
        }
      } catch (e) {}
      setProfile(null);
      useAuthStore.getState().clearUser();
    };

    const getUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id, currentUser);
            useWatchlistStore.getState().loadUserWatchlist(currentUser.id);
          } else {
            loadGuestProfile();
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
            await fetchProfile(authUser.id, authUser);
            useWatchlistStore.getState().loadUserWatchlist(authUser.id);
          } else {
            loadGuestProfile();
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
