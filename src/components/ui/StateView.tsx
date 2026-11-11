import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { resolveUnifiedStateMeta, type UnifiedStateKind } from '@/lib/ui/stateDescriptor';

export interface StateViewProps {
  kind?: UnifiedStateKind;
  statusLabel?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function StateView({
  kind = 'empty',
  statusLabel,
  title,
  description,
  action,
  compact = false,
  className = '',
}: StateViewProps) {
  const meta = resolveUnifiedStateMeta(kind, statusLabel);

  const badgeTone =
    kind === 'error'
      ? 'bg-danger/15 text-danger border-danger/30'
      : kind === 'success'
      ? 'bg-success/15 text-success border-success/30'
      : kind === 'loading'
      ? 'bg-accent/15 text-accent border-accent/30'
      : 'bg-bg-tertiary text-text-secondary border-border';

  const iconTone =
    kind === 'error'
      ? 'bg-danger/10 text-danger'
      : kind === 'success'
      ? 'bg-success/10 text-success'
      : 'bg-accent/10 text-accent';

  return (
    <div
      role={meta.role}
      aria-live={meta.ariaLive}
      aria-busy={meta.ariaBusy || undefined}
      data-state-kind={kind}
      className={`glass-card ${compact ? 'p-4 sm:p-5' : 'p-6 sm:p-10'} text-center space-y-2.5 ${className}`}
    >
      <div className="flex flex-col items-center gap-2">
        <span className={`inline-flex ${compact ? 'p-2' : 'p-3'} rounded-full ${iconTone}`}>
          {kind === 'loading' ? (
            <span
              aria-hidden="true"
              className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"
            />
          ) : (
            <Icon name={kind === 'error' ? 'warning' : kind === 'success' ? 'check' : 'layers'} />
          )}
        </span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeTone}`}>
          {meta.statusLabel}
        </span>
      </div>
      <h3 className={`${compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} font-semibold text-text-primary`}>
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="pt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
