import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'purple' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded-full font-medium',
    md: 'text-xs px-2.5 py-1 rounded-full font-medium',
    lg: 'text-sm px-3 py-1.5 rounded-full font-semibold',
  };

  const variantStyles = {
    default: 'bg-bg-tertiary text-text-secondary border border-border',
    success: 'bg-success/15 text-success border border-success/30',
    danger: 'bg-danger/15 text-danger border border-danger/30',
    warning: 'bg-warning/15 text-warning border border-warning/30',
    info: 'bg-info/15 text-info border border-info/30',
    accent: 'bg-accent/15 text-accent border border-accent/30',
    purple: 'bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/30',
    outline: 'bg-transparent text-text-primary border border-border',
  };

  const dotColor = {
    default: 'bg-text-muted',
    success: 'bg-success',
    danger: 'bg-danger',
    warning: 'bg-warning',
    info: 'bg-info',
    accent: 'bg-accent',
    purple: 'bg-accent-secondary',
    outline: 'bg-text-secondary',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor[variant]}`} />}
      {children}
    </span>
  );
};
