import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function StateView({ kind = 'empty', title, description, action }: { kind?: 'empty' | 'error' | 'success'; title: string; description?: string; action?: ReactNode }) {
  return <div role={kind === 'error' ? 'alert' : 'status'} className="glass-card p-6 sm:p-10 text-center space-y-3">
    <span className={`inline-flex p-3 rounded-full ${kind === 'error' ? 'bg-danger/10 text-danger' : kind === 'success' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'}`}><Icon name={kind === 'error' ? 'warning' : kind === 'success' ? 'check' : 'layers'} /></span>
    <h3 className="text-base font-semibold text-text-primary">{title}</h3>
    {description && <p className="text-sm text-text-secondary">{description}</p>}{action}
  </div>;
}
