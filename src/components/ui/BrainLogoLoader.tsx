'use client';

import React from 'react';
import { StockMindMark } from './StockMindMark';
import { ANDROID_RELEASE_METADATA } from '@/lib/app/releaseMetadata';

interface BrainLogoLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  message?: string;
  subMessage?: string;
  className?: string;
}

const TELEMETRY_PILLS = ['BIST 100', 'NASDAQ', 'TEFAS', 'GVK FIFO'];

export function BrainLogoLoader({
  size = 'fullscreen',
  message = 'StockMind Yükleniyor...',
  subMessage = 'BIST, ABD & TEFAS piyasa verileri senkronize ediliyor',
  className = '',
}: BrainLogoLoaderProps) {
  const isFullscreen = size === 'fullscreen';

  const logoDimension = {
    sm: 'w-9 h-9',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
    fullscreen: 'w-16 h-16 sm:w-20 sm:h-20',
  }[size];

  const spinnerScale = {
    sm: 'scale-50',
    md: 'scale-75',
    lg: 'scale-100',
    fullscreen: 'scale-110 sm:scale-125',
  }[size];

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
    >
      {/* Ambient Radial Spotlight */}
      {(isFullscreen || size === 'lg') && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 h-56 w-56 rounded-full bg-gradient-to-tr from-accent/25 via-accent-secondary/20 to-accent/25 blur-3xl animate-aura-expand"
        />
      )}

      {/* Central Emblem + Semantic Indeterminate Spinner */}
      <div className="relative flex items-center justify-center">
        <div className={`pointer-events-none flex items-center justify-center ${spinnerScale}`}>
          <progress
            aria-label={message || 'StockMind Yükleniyor'}
            className="stockmind-loading-spinner"
          />
        </div>

        {/* Frosted Inner Medallion */}
        <div
          className={`absolute flex items-center justify-center rounded-2xl bg-bg-card/90 border border-accent/30 shadow-[0_8px_32px_var(--accent-glow)] backdrop-blur-md p-2.5 ${logoDimension}`}
        >
          <StockMindMark animated className="w-full h-full text-accent" />
        </div>
      </div>

      {/* Brand Wordmark, Status & Market Telemetry Strip */}
      {(isFullscreen || size === 'lg') && (
        <div className="mt-7 flex flex-col items-center text-center space-y-2 z-10 px-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight gradient-text animate-gradient-shift">
              StockMind
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-accent/15 text-accent border border-accent/30">
              AI v{ANDROID_RELEASE_METADATA.version}
            </span>
          </div>

          {message && (
            <p className="text-sm font-semibold text-text-primary tracking-wide">
              {message}
            </p>
          )}

          {subMessage && (
            <p className="text-xs text-text-muted max-w-xs leading-relaxed">
              {subMessage}
            </p>
          )}

          <div
            aria-hidden="true"
            className="pt-2 flex flex-wrap items-center justify-center gap-1.5"
          >
            {TELEMETRY_PILLS.map((label) => (
              <span
                key={label}
                className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium text-text-muted bg-bg-tertiary/70 border border-border/60"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/95 backdrop-blur-xl">
        {content}
      </div>
    );
  }

  return content;
}

export default BrainLogoLoader;
