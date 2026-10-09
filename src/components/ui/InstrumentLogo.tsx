'use client';

import React, { useState } from 'react';
import { getInstrumentLogoUrl, getInstrumentBrandStyle } from '@/lib/utils/instrumentLogo';

export interface InstrumentLogoProps {
  symbol: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  rounded?: 'lg' | 'xl' | '2xl' | 'full';
  showBorder?: boolean;
}

const SIZE_CONFIGS = {
  xs: {
    container: 'w-6 h-6',
    img: 'w-4 h-4',
    text: 'text-[10px]',
  },
  sm: {
    container: 'w-7 h-7 sm:w-8 sm:h-8',
    img: 'w-4.5 h-4.5 sm:w-5 sm:h-5',
    text: 'text-[11px] sm:text-xs',
  },
  md: {
    container: 'w-9 h-9',
    img: 'w-6 h-6',
    text: 'text-xs',
  },
  lg: {
    container: 'w-11 h-11',
    img: 'w-7 h-7',
    text: 'text-sm',
  },
  xl: {
    container: 'w-14 h-14',
    img: 'w-9 h-9',
    text: 'text-base font-black',
  },
  '2xl': {
    container: 'w-16 h-16',
    img: 'w-10 h-10',
    text: 'text-lg font-black',
  },
};

const ROUNDED_CONFIGS = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

export function InstrumentLogo({
  symbol,
  name,
  size = 'md',
  className = '',
  rounded = 'xl',
  showBorder = true,
}: InstrumentLogoProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const cleanSymbol = (symbol || '')
    .toUpperCase()
    .replace(/^(BIST|NASDAQ|NYSE):/, '')
    .trim();

  const logoUrl = getInstrumentLogoUrl(cleanSymbol);
  const brandStyle = getInstrumentBrandStyle(cleanSymbol);
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;
  const roundedClass = ROUNDED_CONFIGS[rounded] || ROUNDED_CONFIGS.xl;

  const initials = cleanSymbol.substring(0, 2);

  // If no logoUrl exists or failed to load
  const showFallback = !logoUrl || hasError;

  return (
    <div
      className={`relative ${sizeConfig.container} ${roundedClass} shrink-0 flex items-center justify-center overflow-hidden transition-all duration-200 ${
        showBorder ? 'border shadow-sm' : ''
      } ${
        showFallback
          ? `${brandStyle.bg} ${brandStyle.text} ${brandStyle.border}`
          : 'bg-white/95 dark:bg-[#151D2F] border-border/60 hover:border-accent/40'
      } ${className}`}
      title={name || cleanSymbol}
    >
      {/* 1. Official Corporate SVG Logo */}
      {!hasError && logoUrl && (
        <img
          src={logoUrl}
          alt={cleanSymbol}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`${sizeConfig.img} object-contain transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 2. Sleek Fallback Monogram Badge (Visible while loading or if no logo) */}
      {(!isLoaded || showFallback) && (
        <span
          className={`font-black select-none tracking-tight ${sizeConfig.text} ${
            !showFallback ? 'absolute inset-0 flex items-center justify-center text-text-primary/70' : ''
          }`}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

export default InstrumentLogo;
