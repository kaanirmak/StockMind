'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PortfolioStatusWidget from '@/components/widgets/PortfolioStatusWidget';

function PortfolioWidgetInner() {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || 'dark';
  const periodParam = searchParams.get('period') as 'daily' | 'monthly' | 'total' | null;
  const initialPeriod = periodParam === 'monthly' ? 'monthly' : periodParam === 'total' ? 'total' : 'daily';
  const isTransparent = searchParams.get('bg') === 'transparent' || theme === 'transparent';

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-2 sm:p-4 transition-colors ${
        isTransparent ? 'bg-transparent' : theme === 'light' ? 'bg-[#f4f5f8]' : 'bg-[#0a0d16]'
      }`}
    >
      <div className="w-full max-w-md">
        <PortfolioStatusWidget
          standalone
          initialPeriod={initialPeriod}
          transparent={isTransparent}
        />
      </div>
    </div>
  );
}

export default function PortfolioWidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0d16] text-white/50 text-xs">
          Yükleniyor...
        </div>
      }
    >
      <PortfolioWidgetInner />
    </Suspense>
  );
}
