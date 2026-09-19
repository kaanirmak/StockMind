import React from 'react';
import { BrainLogoLoader } from '@/components/ui/BrainLogoLoader';

export default function Loading() {
  return (
    <BrainLogoLoader
      size="fullscreen"
      message="StockMind Yükleniyor..."
      subMessage="Piyasa ve portföy verileri hazırlanıyor"
    />
  );
}
