'use client';

import React from 'react';

interface BrainLogoLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  message?: string;
  subMessage?: string;
  className?: string;
}

export function BrainLogoLoader({
  size = 'fullscreen',
  message = 'StockMind Yükleniyor...',
  subMessage = 'BIST & TEFAS piyasa verileri senkronize ediliyor',
  className = '',
}: BrainLogoLoaderProps) {
  const isFullscreen = size === 'fullscreen';

  const logoDimension = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    fullscreen: 'w-20 h-20 sm:w-24 sm:h-24',
  }[size];

  const content = (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Central Animated Brain Logo Container */}
      <div className="relative flex items-center justify-center">
        {/* Expanding Ring Waves */}
        <div className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-violet-500/40 animate-ring-wave-1 pointer-events-none" />
        <div className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-fuchsia-500/30 animate-ring-wave-2 pointer-events-none" />

        {/* Dynamic Gradient Breathing Aura */}
        <div className="absolute -inset-4 sm:-inset-6 rounded-full bg-gradient-to-tr from-violet-600/40 via-fuchsia-500/35 to-indigo-600/40 blur-2xl animate-aura-expand pointer-events-none" />

        {/* Gradient Shimmer Disc */}
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-indigo-500/20 border border-violet-500/30 backdrop-blur-md animate-pulse-glow" />

        {/* The Brain Logo with Pulse Animation */}
        <div className={`relative ${logoDimension} flex items-center justify-center p-2.5 z-10 animate-brain-pulse`}>
          <img
            src="/icon-brain-light.png"
            alt="StockMind"
            className="w-full h-full object-contain dark:hidden"
          />
          <img
            src="/icon-brain-dark.png"
            alt="StockMind"
            className="w-full h-full object-contain hidden dark:block"
          />
        </div>
      </div>

      {/* Brand Title with Gradient Shift Animation */}
      {(isFullscreen || size === 'lg') && (
        <div className="mt-6 flex flex-col items-center text-center space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent animate-gradient-shift">
              StockMind
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-violet-500/15 text-violet-300 border border-violet-500/30">
              AI
            </span>
          </div>

          {message && (
            <p className="text-sm font-semibold text-text-primary tracking-wide">
              {message}
            </p>
          )}

          {subMessage && (
            <p className="text-xs text-text-muted max-w-xs px-4">
              {subMessage}
            </p>
          )}

          {/* Animated Gradient Progress Line */}
          <div className="w-36 sm:w-44 h-1 mt-3 rounded-full bg-bg-tertiary overflow-hidden border border-border/40 relative">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-indigo-500 animate-gradient-shift shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
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
