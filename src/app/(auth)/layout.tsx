'use client';

import Link from 'next/link';
import { Icon, StockMindLogo } from '@/components/ui';
import type { IconName } from '@/components/ui/Icon';
import { QuickThemeButton } from '@/components/theme/QuickThemeButton';

const AUTH_FEATURE_PILLS: ReadonlyArray<{ icon: IconName; label: string }> = [
  { icon: 'chart', label: 'Gerçek Zamanlı Veriler' },
  { icon: 'sparkles', label: 'AI Analizler' },
  { icon: 'wallet', label: 'Portföy Yönetimi' },
  { icon: 'layers', label: 'Teknik Analiz' },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-bg-primary text-text-primary transition-colors duration-300 relative">
      {/* Top Floating Controls (Ana Sayfa & Tema Değiştirici) */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-8 z-30 flex items-center gap-2.5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-card/85 hover:bg-bg-card border border-border shadow-xs transition-all duration-200 backdrop-blur-md"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Ana Sayfa</span>
        </Link>

        <QuickThemeButton />
      </div>

      {/* Left Side — Branding Hero Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center border-r border-border bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-tertiary">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/15 rounded-full blur-[120px] animate-float pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-secondary/15 rounded-full blur-[100px] animate-float pointer-events-none" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-success/10 rounded-full blur-[90px] pointer-events-none" />

        {/* Subtle Decorative Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Content Container */}
        <div className="relative z-10 px-12 max-w-lg">
          <Link href="/" className="inline-block mb-8 group">
            <StockMindLogo size="lg" className="group-hover:scale-[1.03] transition-transform" />
          </Link>

          <h1 className="text-4xl font-bold text-text-primary leading-tight mb-4 tracking-tight">
            Akıllı Yatırım
            <br />
            <span className="gradient-text">
              Kararları
            </span>{' '}
            Alın
          </h1>

          <p className="text-text-secondary text-base lg:text-lg leading-relaxed mb-8">
            BIST, NYSE, NASDAQ ve TEFAS fonlarını tek platformdan takip edin.
            AI destekli analizlerle portföyünüzü optimize edin.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2.5 mb-10">
            {AUTH_FEATURE_PILLS.map(({ icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-bg-card/80 border border-border text-text-primary shadow-xs hover:border-border-hover transition-all backdrop-blur-md"
              >
                <Icon name={icon} className="w-4 h-4 text-accent" />
                <span>{label}</span>
              </span>
            ))}
          </div>

          {/* Bottom Live Metrics Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium bg-emerald-500/10 text-success border border-emerald-500/25">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>500+ BIST Hissesi &amp; 400+ TEFAS Fonu Canlı İzleniyor</span>
          </div>
        </div>
      </div>

      {/* Right Side — Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-5 sm:px-10 pt-16 sm:pt-12 pb-8 sm:pb-12 relative bg-bg-secondary min-h-screen">
        <div className="w-full max-w-md animate-fade-in-up">
          {children}
        </div>
      </div>
    </div>
  );
}
