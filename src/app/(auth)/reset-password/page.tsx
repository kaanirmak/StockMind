'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || 'Şifre güncellenemedi. Lütfen tekrar deneyin.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          Yeni Şifre Belirleyin
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Hesabınız için güçlü ve yeni bir şifre girin.
        </p>
      </div>

      {error && (
        <div
          className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-start gap-3 animate-fade-in"
          role="alert"
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 text-xs sm:text-sm font-medium">{error}</div>
        </div>
      )}

      {success ? (
        <div className="p-6 rounded-2xl bg-success/10 border border-success/20 text-center animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text-primary">Şifreniz Başarıyla Değiştirildi</h2>
          <p className="mt-2 text-sm text-text-muted">
            Yeni şifreniz kaydedildi. Panele yönlendiriliyorsunuz...
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-colors"
            >
              Hemen Panele Git
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Yeni Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Yeni Şifre (Tekrar)
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-bg-card border border-border text-text-primary placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-accent to-fuchsia-600 hover:opacity-95 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <span>Yeni Şifreyi Kaydet</span>
            )}
          </button>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-border text-center">
        <Link
          href="/login"
          className="text-xs text-text-muted hover:text-text-primary font-medium transition-colors"
        >
          ← Giriş Sayfasına Dön
        </Link>
      </div>
    </div>
  );
}
