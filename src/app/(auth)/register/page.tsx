'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = (() => {
    if (password.length === 0) return { level: 0, label: '', color: '' };
    if (password.length < 6) return { level: 1, label: 'Zayıf', color: 'bg-danger' };
    if (password.length < 8) return { level: 2, label: 'Orta', color: 'bg-warning' };
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (score >= 2 && password.length >= 8)
      return { level: 4, label: 'Güçlü', color: 'bg-success' };
    return { level: 3, label: 'İyi', color: 'bg-info' };
  })();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setLoading(true);

    const siteOrigin = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://stock-mind-bay.vercel.app');

    const emailRedirectTo = `${siteOrigin.replace(/\/$/, '')}/auth/callback?next=/dashboard`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data?.session) {
      window.location.href = '/dashboard';
    } else {
      setSuccessEmail(email);
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  async function handleGithubSignUp() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  return (
    <>
      {/* Mobile Logo */}
      <Link href="/" className="flex items-center justify-center mb-8 lg:hidden group">
        <img
          src="/logo-cropped.png"
          alt="StockMind"
          className="h-10 w-auto object-contain dark:hidden group-hover:scale-105 transition-transform"
        />
        <img
          src="/logo-white.png"
          alt="StockMind"
          className="h-10 w-auto object-contain hidden dark:block drop-shadow-[0_0_15px_rgba(139,92,246,0.35)] group-hover:scale-105 transition-transform"
        />
      </Link>

      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-text-primary mb-2 tracking-tight">
        {successEmail ? 'Doğrulama E-postası Gönderildi' : 'Hesap Oluşturun'}
      </h2>
      <p className="text-slate-600 dark:text-text-secondary mb-7 text-sm">
        {successEmail
          ? 'Lütfen e-posta adresinizi onaylayarak giriş yapın'
          : 'Yatırım yolculuğunuza başlayın'}
      </p>

      {successEmail ? (
        <div className="p-6 sm:p-7 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-4 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/10">
            📬
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-white">Son Bir Adım Kaldı!</h3>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              <strong className="text-emerald-400 font-semibold">{successEmail}</strong> adresinize bir aktivasyon bağlantısı ilettik.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 text-xs text-text-muted text-left space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">1.</span>
              <span>Gelen kutunuzdaki (ve gerekiyorsa <strong>Spam / Gereksiz</strong> klasöründeki) doğrulama butonuna tıklayın.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">2.</span>
              <span>Bağlantıya tıkladığınızda hesabınız onaylanacak ve doğrudan StockMind paneline aktarılacaksınız.</span>
            </div>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
            >
              <span>Giriş Yap Sayfasına Git</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Social Register: Google & GitHub */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {/* Google Sign Up */}
        <button
          onClick={handleGoogleSignUp}
          type="button"
          className="flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 shadow-xs dark:bg-bg-card dark:hover:bg-bg-hover dark:border-border dark:hover:border-border-hover dark:text-text-primary text-sm font-medium transition-all duration-200 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Google</span>
        </button>

        {/* GitHub Sign Up */}
        <button
          onClick={handleGithubSignUp}
          type="button"
          className="flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 shadow-xs dark:bg-bg-card dark:hover:bg-bg-hover dark:border-border dark:hover:border-border-hover dark:text-text-primary text-sm font-medium transition-all duration-200 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0 fill-current text-slate-800 dark:text-text-primary" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span>GitHub</span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-slate-200 dark:bg-border" />
        <span className="text-slate-400 dark:text-text-muted text-xs font-medium uppercase tracking-wider">veya</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-border" />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-danger-light dark:border-danger/20 dark:text-danger text-sm animate-fade-in-down">
          {error}
        </div>
      )}

      {/* Register Form */}
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-text-secondary mb-1.5">
            Ad Soyad
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Adınız Soyadınız"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-xs dark:bg-bg-input dark:border-border dark:text-text-primary dark:placeholder:text-text-muted focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:focus:border-accent dark:focus:ring-accent/30 transition-all duration-200 text-sm"
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 dark:text-text-secondary mb-1.5">
            E-posta
          </label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ornek@email.com"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-xs dark:bg-bg-input dark:border-border dark:text-text-primary dark:placeholder:text-text-muted focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:focus:border-accent dark:focus:ring-accent/30 transition-all duration-200 text-sm"
          />
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 dark:text-text-secondary mb-1.5">
            Şifre
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="En az 6 karakter"
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-xs dark:bg-bg-input dark:border-border dark:text-text-primary dark:placeholder:text-text-muted focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:focus:border-accent dark:focus:ring-accent/30 transition-all duration-200 pr-12 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-text-muted dark:hover:text-text-secondary transition-colors cursor-pointer"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
          {/* Password Strength */}
          {password.length > 0 && (
            <div className="mt-2 animate-fade-in">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      level <= passwordStrength.level
                        ? passwordStrength.color
                        : 'bg-slate-200 dark:bg-border'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500 dark:text-text-muted">{passwordStrength.label}</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-text-secondary mb-1.5">
            Şifre Tekrar
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Şifrenizi tekrar girin"
            className={`w-full px-4 py-3 rounded-xl bg-white border text-slate-900 placeholder:text-slate-400 shadow-xs dark:bg-bg-input dark:text-text-primary dark:placeholder:text-text-muted focus:outline-none focus:ring-2 transition-all duration-200 text-sm ${
              confirmPassword.length > 0 && password !== confirmPassword
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-200 dark:border-border focus:border-violet-500 focus:ring-violet-500/20 dark:focus:border-accent dark:focus:ring-accent/30'
            }`}
          />
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-danger animate-fade-in">Şifreler eşleşmiyor</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || (confirmPassword.length > 0 && password !== confirmPassword)}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-semibold shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 hover:opacity-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Kayıt Yapılıyor...
            </div>
          ) : (
            'Kayıt Ol'
          )}
        </button>
      </form>

      {/* Login Link */}
      <p className="mt-8 text-center text-slate-600 dark:text-text-secondary text-sm">
        Zaten hesabınız var mı?{' '}
        <Link
          href="/login"
          className="text-violet-600 hover:text-violet-700 dark:text-accent dark:hover:text-accent-hover font-semibold transition-colors"
        >
          Giriş Yapın
        </Link>
      </p>
        </>
      )}
    </>
  );
}
