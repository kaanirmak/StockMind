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

      const metaAvatar = currentUser?.user_metadata?.avatar_url;
      const safeMetaAvatar = metaAvatar && !metaAvatar.startsWith('data:') && metaAvatar.length < 500 ? metaAvatar : null;
      const pictureAvatar = currentUser?.user_metadata?.picture;
      const safePicture = pictureAvatar && !pictureAvatar.startsWith('data:') ? pictureAvatar : null;

      const userProf: UserProfile = {
        id: userId,
        username: data?.username || currentUser?.email?.split('@')[0] || 'kullanici',
        fullName: data?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || null,
        avatarUrl: data?.avatar_url || safeMetaAvatar || safePicture || null,
        preferredLanguage: data?.preferred_language || 'tr',
        preferredCurrency: data?.preferred_currency || 'TRY',
        isPro: true,
        plan: 'pro',
        createdAt: data?.created_at || new Date().toISOString(),
        updatedAt: data?.updated_at || new Date().toISOString(),
      };
      setProfile(userProf);
      useAuthStore.getState().setUser(userProf);
      return userProf;
    } catch (e) {
      console.warn('fetchProfile error:', e);
      if (currentUser) {
        const metaAvatar = currentUser?.user_metadata?.avatar_url;
        const safeMetaAvatar = metaAvatar && !metaAvatar.startsWith('data:') && metaAvatar.length < 500 ? metaAvatar : null;
        const pictureAvatar = currentUser?.user_metadata?.picture;
        const safePicture = pictureAvatar && !pictureAvatar.startsWith('data:') ? pictureAvatar : null;

        const fallbackProf: UserProfile = {
          id: userId,
          username: currentUser.email?.split('@')[0] || 'kullanici',
          fullName: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || null,
          avatarUrl: safeMetaAvatar || safePicture || null,
          preferredLanguage: 'tr',
          preferredCurrency: 'TRY',
          isPro: true,
          plan: 'pro',
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
        isPro: true,
        plan: 'pro',
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
      // CRITICAL: NEVER store base64/data URLs in Supabase auth user_metadata!
      // Auth user_metadata is encoded into the JWT, which @supabase/ssr writes into cookies.
      // If avatar_url is base64, cookies swell to >30KB-80KB, causing Vercel Edge 494 REQUEST_HEADER_TOO_LARGE.
      // Base64 avatars are stored strictly in the PostgreSQL 'profiles' table.
      try {
        const safeAuthAvatar = (updates.avatarUrl && !updates.avatarUrl.startsWith('data:') && updates.avatarUrl.length < 500)
          ? updates.avatarUrl
          : null;

        await supabase.auth.updateUser({
          data: {
            full_name: updates.fullName !== undefined ? updates.fullName : (user.user_metadata?.full_name || ''),
            avatar_url: safeAuthAvatar,
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
        isPro: true,
        plan: 'pro',
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
        isPro: true,
        plan: 'pro',
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

    const cleanupBloatedMetadata = async (u: User) => {
      const metaAvatar = u.user_metadata?.avatar_url;
      if (metaAvatar && (metaAvatar.startsWith('data:') || metaAvatar.length > 500)) {
        try {
          await supabase.auth.updateUser({
            data: { avatar_url: null },
          });
        } catch (e) {
          console.warn('Failed to purge bloated avatar from auth metadata:', e);
        }
      }
    };

    const getUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(currentUser);
          if (currentUser) {
            cleanupBloatedMetadata(currentUser);
            const metaKey = currentUser.user_metadata?.openrouter_api_key;
            if (metaKey && typeof window !== 'undefined' && !localStorage.getItem('stockmind_openrouter_api_key')) {
              localStorage.setItem('stockmind_openrouter_api_key', metaKey);
              window.dispatchEvent(new CustomEvent('stockmind_ai_key_updated', { detail: { key: metaKey } }));
            }
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
            cleanupBloatedMetadata(authUser);
            const metaKey = authUser.user_metadata?.openrouter_api_key;
            if (metaKey && typeof window !== 'undefined' && !localStorage.getItem('stockmind_openrouter_api_key')) {
              localStorage.setItem('stockmind_openrouter_api_key', metaKey);
              window.dispatchEvent(new CustomEvent('stockmind_ai_key_updated', { detail: { key: metaKey } }));
            }
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
