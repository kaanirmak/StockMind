'use client';

import React from 'react';
import { Badge } from './Badge';
import type { PriceStatusInfo } from '@/lib/market/priceStatus';

const trDateTime = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const trDayOnly = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatObservationTime(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) ? trDayOnly.format(parsed) : null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? trDateTime.format(parsed) : null;
}

export interface PriceStatusBadgeProps {
  statusInfo: PriceStatusInfo;
  size?: 'sm' | 'md';
  showMeta?: boolean;
  className?: string;
}

export const PriceStatusBadge: React.FC<PriceStatusBadgeProps> = ({
  statusInfo,
  size = 'sm',
  showMeta = false,
  className = '',
}) => {
  const formattedTime = formatObservationTime(statusInfo.observedAt);
  const metaLabel = statusInfo.asOf ? 'Veri' : 'Alındı';

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <Badge
        variant={statusInfo.badgeVariant}
        size={size}
        dot
        title={statusInfo.description}
        data-price-status={statusInfo.status}
      >
        {statusInfo.label}
      </Badge>
      {showMeta && statusInfo.source && (
        <span className="text-[11px] text-text-muted">
          {statusInfo.source}
          {formattedTime && (
            <>
              {' · '}
              {metaLabel}{' '}
              <time dateTime={statusInfo.observedAt ?? undefined}>{formattedTime}</time>
            </>
          )}
        </span>
      )}
    </span>
  );
};
