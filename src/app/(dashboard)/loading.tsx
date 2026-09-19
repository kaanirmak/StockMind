import React from 'react';
import { BrainLogoLoader } from '@/components/ui/BrainLogoLoader';

export default function DashboardLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12">
      <BrainLogoLoader
        size="lg"
        message="Sayfa Yükleniyor..."
        subMessage="Canlı veriler güncelleniyor"
      />
    </div>
  );
}
