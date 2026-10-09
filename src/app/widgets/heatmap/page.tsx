'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import HeatmapWidget from '@/components/widgets/HeatmapWidget';

function HeatmapWidgetInner() {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || 'dark';
  const metricParam = searchParams.get('metric') as 'daily' | 'total' | null;
  const defaultMetric = metricParam === 'total' ? 'total' : 'daily';
  const isTransparent = searchParams.get('bg') === 'transparent' || theme === 'transparent';

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-2 sm:p-4 transition-colors ${
        isTransparent ? 'bg-transparent' : theme === 'light' ? 'bg-[#f4f5f8]' : 'bg-[#0a0d16]'
      }`}
    >
      <div className="w-full max-w-2xl">
        <HeatmapWidget
          standalone
          defaultMetric={defaultMetric}
          transparent={isTransparent}
          height={320}
        />
      </div>
    </div>
  );
}

export default function HeatmapWidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0d16] text-white/50 text-xs">
          Yükleniyor...
        </div>
      }
    >
      <HeatmapWidgetInner />
    </Suspense>
  );
}
