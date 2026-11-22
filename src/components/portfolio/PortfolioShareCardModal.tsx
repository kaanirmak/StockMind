'use client';

import React, { useMemo, useState } from 'react';
import { Modal, Button, StockMindLogo, useToast } from '@/components/ui';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getThemePresetDefinition } from '@/lib/theme/themeConfig';
import {
  buildPortfolioShareCardModel,
  formatShareCardClipboardSummary,
  type PortfolioShareCardModel,
} from '@/lib/portfolio/shareCardModel';
import type { Holding } from '@/types/portfolio';

interface PortfolioShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioName: string;
  periodLabel: string;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
  pnlAvailable: boolean;
  allocation: Array<{ label: string; value: number; percentage: number; color: string }>;
  holdings: Holding[];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadBrandLogoImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(null), 2000);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
  });
}

async function renderShareCardCanvas(
  model: PortfolioShareCardModel,
  palette: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    positive: string;
    negative: string;
    isLight: boolean;
  }
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
  bgGrad.addColorStop(0, palette.bg);
  bgGrad.addColorStop(1, palette.surface);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 630);

  // Subtle accent aura
  const aura = ctx.createRadialGradient(960, 110, 20, 960, 110, 420);
  aura.addColorStop(0, `${palette.accent}38`);
  aura.addColorStop(1, `${palette.accent}00`);
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, 1200, 630);

  // Inner frame
  drawRoundedRect(ctx, 44, 40, 1112, 550, 28);
  ctx.fillStyle = palette.isLight ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.58)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)';
  ctx.stroke();

  // Brand logo (authentic StockMind PNG, fallback to fixed brand purple pill)
  const logoImg = await loadBrandLogoImage(palette.isLight ? '/logo-cropped.png' : '/logo-white.png');
  if (logoImg && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
    const logoHeight = 44;
    const logoWidth = Math.round(logoHeight * (logoImg.naturalWidth / logoImg.naturalHeight));
    ctx.drawImage(logoImg, 82, 76, logoWidth, logoHeight);
  } else {
    drawRoundedRect(ctx, 82, 76, 46, 46, 12);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(92, 108);
    ctx.lineTo(101, 98);
    ctx.lineTo(107, 103);
    ctx.lineTo(118, 90);
    ctx.stroke();

    ctx.fillStyle = palette.text;
    ctx.font = '700 28px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('StockMind', 142, 106);
  }

  ctx.fillStyle = palette.muted;
  ctx.font = '600 18px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`${model.portfolioName} · ${model.periodLabel}`, 82, 152);

  // Date badge on top right
  drawRoundedRect(ctx, 920, 78, 198, 40, 20);
  ctx.fillStyle = `${palette.accent}24`;
  ctx.fill();
  ctx.fillStyle = palette.text;
  ctx.font = '600 16px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(model.generatedAtLabel, 1019, 104);
  ctx.textAlign = 'left';

  // Main KPI block
  ctx.fillStyle = palette.muted;
  ctx.font = '600 17px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('TOPLAM PORTFÖY DEĞERİ', 82, 204);

  ctx.fillStyle = palette.text;
  ctx.font = '800 58px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(model.totalValueText, 82, 268);

  const pnlColor = !model.pnlAvailable
    ? palette.muted
    : model.isPositive
      ? palette.positive
      : palette.negative;

  drawRoundedRect(ctx, 82, 290, 420, 48, 14);
  ctx.fillStyle = `${pnlColor}22`;
  ctx.fill();
  ctx.fillStyle = pnlColor;
  ctx.font = '700 24px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(
    model.pnlAvailable ? `${model.pnlPercentText}   (${model.pnlAmountText})` : model.pnlPercentText,
    102,
    322
  );

  // Top holdings grid
  ctx.fillStyle = palette.muted;
  ctx.font = '600 16px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('EN BÜYÜK POZİSYONLAR', 82, 384);

  const holdingsToDraw = model.topHoldings.slice(0, 4);
  holdingsToDraw.forEach((h, idx) => {
    const x = 82 + idx * 262;
    const y = 402;
    drawRoundedRect(ctx, x, y, 244, 106, 16);
    ctx.fillStyle = palette.isLight ? 'rgba(241,245,249,0.9)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = palette.isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = palette.text;
    ctx.font = '700 22px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(h.symbol, x + 18, y + 36);

    ctx.fillStyle = palette.muted;
    ctx.font = '600 15px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`Ağırlık %${h.weightPercent.toFixed(1).replace('.', ',')}`, x + 18, y + 64);

    ctx.fillStyle = h.isPositive ? palette.positive : palette.negative;
    ctx.font = '700 18px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(h.pnlPercentText, x + 18, y + 90);
  });

  // Footer disclaimer
  ctx.fillStyle = palette.muted;
  ctx.font = '500 15px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(model.disclaimer, 82, 558);

  return canvas;
}

export function PortfolioShareCardModal({
  isOpen,
  onClose,
  portfolioName,
  periodLabel,
  totalValue,
  pnl,
  pnlPercent,
  pnlAvailable,
  allocation,
  holdings,
}: PortfolioShareCardModalProps) {
  const { showToast } = useToast();
  const { resolvedPreset, pnlMode } = useTheme();
  const [maskValues, setMaskValues] = useState(true);
  const [exporting, setExporting] = useState(false);

  const presetDef = getThemePresetDefinition(resolvedPreset);
  const model = useMemo(
    () =>
      buildPortfolioShareCardModel({
        portfolioName,
        periodLabel,
        totalValue,
        pnl,
        pnlPercent,
        pnlAvailable,
        maskValues,
        allocation,
        holdings,
      }),
    [portfolioName, periodLabel, totalValue, pnl, pnlPercent, pnlAvailable, maskValues, allocation, holdings]
  );

  const handleDownloadPng = async () => {
    setExporting(true);
    try {
      const positiveColor =
        pnlMode === 'colorblind'
          ? presetDef.mode === 'light'
            ? '#1d4ed8'
            : '#60a5fa'
          : presetDef.previewPositive;
      const negativeColor =
        pnlMode === 'colorblind'
          ? presetDef.mode === 'light'
            ? '#c2410c'
            : '#fb923c'
          : presetDef.previewNegative;

      const canvas = await renderShareCardCanvas(model, {
        bg: presetDef.previewBg,
        surface: presetDef.previewSurface,
        text: presetDef.previewText,
        muted: presetDef.mode === 'light' ? '#475569' : '#94a3b8',
        accent: presetDef.previewAccent,
        positive: positiveColor,
        negative: negativeColor,
        isLight: presetDef.mode === 'light',
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `stockmind-${portfolioName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-karti.png`;
      link.href = dataUrl;
      link.click();

      showToast({
        type: 'success',
        title: 'Portföy Kartı İndirildi',
        message: maskValues
          ? 'Tutarlar gizlenmiş şekilde PNG görseli kaydedildi.'
          : 'Portföy performans kartı PNG olarak indirildi.',
      });
    } catch {
      showToast({
        type: 'danger',
        title: 'Görsel Oluşturulamadı',
        message: 'Tarayıcı tuval dışa aktarımını desteklemiyor olabilir.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(formatShareCardClipboardSummary(model));
      showToast({
        type: 'success',
        title: 'Özet Kopyalandı',
        message: maskValues ? 'Gizlilik korumalı metin özeti panoya kopyalandı.' : 'Portföy özeti panoya kopyalandı.',
      });
    } catch {
      showToast({
        type: 'danger',
        title: 'Kopyalama Başarısız',
        message: 'Pano erişimine izin verilmedi.',
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Portföy Paylaşım Kartı" size="lg">
      <div className="space-y-5">
        {/* Privacy Mask Switch (Default ON) */}
        <label className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-bg-tertiary/70 border border-border cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-text-primary">Tutarları Gizle (Önerilen)</p>
            <p className="text-xs text-text-muted">
              ₺ toplamları gizler; yalnızca yüzde getiriyi ve portföy ağırlıklarını paylaşır.
            </p>
          </div>
          <input
            type="checkbox"
            checked={maskValues}
            onChange={(e) => setMaskValues(e.target.checked)}
            className="w-5 h-5 accent-accent cursor-pointer shrink-0"
          />
        </label>

        {/* Live Share Card Preview */}
        <div
          data-testid="portfolio-share-card-preview"
          className="relative overflow-hidden rounded-2xl border border-border p-5 sm:p-6 shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${presetDef.previewBg} 0%, ${presetDef.previewSurface} 100%)`,
            color: presetDef.previewText,
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <StockMindLogo size="sm" inverted={presetDef.mode === 'dark'} />
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${presetDef.previewAccent}26` }}
            >
              {model.periodLabel} · {model.generatedAtLabel}
            </span>
          </div>

          <p className="text-xs uppercase tracking-wider opacity-75 mb-1">{model.portfolioName}</p>
          <div className="flex flex-wrap items-baseline gap-3 mb-5">
            <span className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight">
              {model.totalValueText}
            </span>
            <span
              className={`text-sm sm:text-base font-bold px-2.5 py-1 rounded-xl tabular-nums ${
                !model.pnlAvailable
                  ? 'pnl-neutral bg-bg-tertiary/50'
                  : model.isPositive
                    ? 'pnl-positive pnl-bg-positive'
                    : 'pnl-negative pnl-bg-negative'
              }`}
            >
              {model.pnlAvailable ? `${model.pnlPercentText} (${model.pnlAmountText})` : model.pnlPercentText}
            </span>
          </div>

          {model.allocation.length > 0 && (
            <div className="mb-4">
              <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-black/15">
                {model.allocation.map((slice) => (
                  <div
                    key={slice.label}
                    style={{ width: `${slice.percentage}%`, backgroundColor: slice.color }}
                    title={`${slice.label}: %${slice.percentage}`}
                  />
                ))}
              </div>
            </div>
          )}

          {model.topHoldings.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {model.topHoldings.map((item) => (
                <div
                  key={item.symbol}
                  className="rounded-xl p-2.5 border border-white/10"
                  style={{
                    backgroundColor: presetDef.mode === 'light' ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <p className="text-xs font-bold">{item.symbol}</p>
                  <p className="text-[11px] opacity-75 tabular-nums">Ağırlık %{item.weightPercent.toFixed(1).replace('.', ',')}</p>
                  <p
                    className={`text-xs font-semibold tabular-nums mt-0.5 ${
                      item.isPositive ? 'pnl-positive' : 'pnl-negative'
                    }`}
                  >
                    {item.pnlPercentText}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] opacity-70">{model.disclaimer}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          <Button variant="secondary" size="sm" onClick={handleCopySummary}>
            Özeti Kopyala
          </Button>
          <Button variant="primary" size="sm" onClick={handleDownloadPng} disabled={exporting}>
            {exporting ? 'Hazırlanıyor...' : 'PNG İndir'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
