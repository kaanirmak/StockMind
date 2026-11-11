'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import HeatmapWidget from '@/components/widgets/HeatmapWidget';
import { isWidgetDemoQuery } from '@/lib/widgets/widgetStatus';
import { isWidgetPrivacyQuery } from '@/lib/widgets/widgetSharePolicy';

function HeatmapWidgetInner() {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || 'dark';
  const metricParam = searchParams.get('metric') as 'daily' | 'total' | null;
  const defaultMetric = metricParam === 'total' ? 'total' : 'daily';
  const isTransparent = searchParams.get('bg') === 'transparent' || theme === 'transparent';
  const forceDemo = isWidgetDemoQuery(searchParams);
  const forcePrivacy = isWidgetPrivacyQuery(searchParams);

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-2 sm:p-4 transition-colors ${
        isTransparent ? 'bg-transparent' : theme === 'light' ? 'bg-[var(--palette-colorf8fafc)]' : 'bg-[var(--palette-black)]'
      }`}
    >
      <div className="w-full max-w-2xl">
        <HeatmapWidget
          standalone
          theme={theme === 'light' ? 'light' : 'dark'}
          defaultMetric={defaultMetric}
          transparent={isTransparent}
          forceDemo={forceDemo}
          forcePrivacy={forcePrivacy}
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
        <div className="min-h-screen w-full flex items-center justify-center bg-[var(--palette-color0a0d16)] text-white/50 text-xs">
          Yükleniyor...
        </div>
      }
    >
      <HeatmapWidgetInner />
    </Suspense>
  );
}
