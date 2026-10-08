'use client';

import Link from 'next/link';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-bg-primary text-text-primary transition-colors duration-300 relative">
      {/* Top Floating Controls (Ana Sayfa & Tema Değiştirici) */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-8 z-30 flex items-center gap-2.5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/80 shadow-xs dark:bg-bg-card/80 dark:hover:bg-bg-card dark:text-text-secondary dark:hover:text-text-primary dark:border-border transition-all duration-200 backdrop-blur-md"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Ana Sayfa</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/80 shadow-xs dark:bg-bg-card/80 dark:hover:bg-bg-card dark:text-text-secondary dark:hover:text-text-primary dark:border-border transition-all duration-200 cursor-pointer flex items-center justify-center backdrop-blur-md"
          title={resolvedTheme === 'dark' ? 'Beyaz Plana Geç (Açık Tema)' : 'Siyah Plana Geç (Koyu Tema)'}
          aria-label="Tema Değiştir"
        >
          {resolvedTheme === 'dark' ? (
            <svg className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-transform duration-300 hover:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-violet-600 hover:text-violet-700 transition-transform duration-300 hover:-rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>
      </div>

      {/* Left Side — Branding Hero Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center border-r border-slate-200/80 dark:border-white/5 bg-gradient-to-br from-violet-50/90 via-slate-50 to-indigo-50/80 dark:from-[#0a0e1a] dark:via-[#0f1a2e] dark:to-[#1a1040]">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-400/20 dark:bg-accent/15 rounded-full blur-[120px] animate-float pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-fuchsia-400/20 dark:bg-accent-secondary/15 rounded-full blur-[100px] animate-float pointer-events-none" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-400/15 dark:bg-success/5 rounded-full blur-[90px] pointer-events-none" />
        
        {/* Subtle Decorative Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Content Container */}
        <div className="relative z-10 px-12 max-w-lg">
          <Link href="/" className="inline-block mb-8 group">
            {/* Light Mode Logo */}
            <img
              src="/logo-cropped.png"
              alt="StockMind"
              className="h-12 lg:h-14 w-auto object-contain dark:hidden group-hover:scale-105 transition-transform drop-shadow-sm"
            />
            {/* Dark Mode Logo */}
            <img
              src="/logo-white.png"
              alt="StockMind"
              className="h-12 lg:h-14 w-auto object-contain hidden dark:block group-hover:scale-105 transition-transform drop-shadow-[0_0_24px_rgba(139,92,246,0.35)]"
            />
          </Link>
          
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-4 tracking-tight">
            Akıllı Yatırım
            <br />
            <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-300 bg-clip-text text-transparent">
              Kararları
            </span>{' '}
            Alın
          </h1>
          
          <p className="text-slate-600 dark:text-slate-300 text-base lg:text-lg leading-relaxed mb-8">
            BIST, NYSE, NASDAQ ve TEFAS fonlarını tek platformdan takip edin. 
            AI destekli analizlerle portföyünüzü optimize edin.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2.5 mb-10">
            {[
              { icon: '📊', label: 'Gerçek Zamanlı Veriler' },
              { icon: '🤖', label: 'AI Analizler' },
              { icon: '💼', label: 'Portföy Yönetimi' },
              { icon: '📈', label: 'Teknik Analiz' },
            ].map(({ icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/90 border border-slate-200/90 text-slate-700 shadow-xs hover:border-violet-300 hover:bg-white dark:bg-white/5 dark:border-white/10 dark:text-white/90 dark:hover:bg-white/10 dark:hover:border-white/20 transition-all backdrop-blur-md"
              >
                <span>{icon}</span>
                <span>{label}</span>
              </span>
            ))}
          </div>

          {/* Bottom Live Metrics Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>500+ BIST Hissesi & 400+ TEFAS Fonu Canlı İzleniyor</span>
          </div>
        </div>
      </div>

      {/* Right Side — Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-white dark:bg-bg-primary">
        <div className="w-full max-w-md animate-fade-in-up">
          {children}
        </div>
      </div>
    </div>
  );
}
