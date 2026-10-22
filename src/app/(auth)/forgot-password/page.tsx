'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (resetError) {
        setError(resetError.message || 'Şifre sıfırlama bağlantısı gönderilemedi.');
      } else {
        setSuccess(true);
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
          Şifrenizi mi Unuttunuz?
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Hesabınıza kayıtlı e-posta adresinizi girin. Size güvenli şifre sıfırlama bağlantısı gönderelim.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-start gap-3 animate-fade-in" role="alert">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 text-xs sm:text-sm font-medium">{error}</div>
        </div>
      )}

      {success ? (
        <div className="space-y-6 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">E-posta Gönderildi</h2>
            <p className="mt-2 text-xs sm:text-sm text-text-muted leading-relaxed">
              <span className="font-semibold text-text-primary">{email}</span> adresine şifre sıfırlama bağlantısı gönderildi.
              Gelen kutunuzu ve gereksiz (spam) klasörünüzü kontrol edin.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-secondary transition"
            >
              Giriş Sayfasına Dön
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleReset} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-text-secondary mb-1.5">
              E-posta Adresi
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                autoFocus
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-xs dark:bg-bg-input dark:border-border dark:text-text-primary dark:placeholder:text-text-muted focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:focus:border-accent dark:focus:ring-accent/30 transition-all duration-200 text-base sm:text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-bold text-sm sm:text-base shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 hover:opacity-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Gönderiliyor...</span>
              </>
            ) : (
              <span>Şifre Sıfırlama Bağlantısı Gönder</span>
            )}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-xs font-semibold text-text-secondary hover:text-accent transition inline-flex items-center gap-1.5"
            >
              <span>&larr; Giriş sayfasına dön</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
