import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hoverEffect?: boolean;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className = '',
  glass = true,
  hoverEffect = false,
  glow = false,
  children,
  ...props
}) => {
  const baseClasses = glass
    ? 'glass-card'
    : 'bg-bg-card border border-border rounded-2xl';

  const hoverClasses = hoverEffect
    ? 'transition-all duration-300 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-0.5'
    : '';

  const glowClasses = glow
    ? 'relative before:absolute before:-inset-0.5 before:bg-gradient-to-r before:from-accent before:to-accent-secondary before:rounded-2xl before:blur-md before:opacity-20 before:-z-10'
    : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${glowClasses} p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`flex items-center justify-between pb-4 mb-4 border-b border-border/60 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`text-base font-semibold text-text-primary ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`text-xs text-text-muted mt-0.5 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => <div className={className} {...props}>{children}</div>;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`pt-4 mt-4 border-t border-border/60 flex items-center justify-between ${className}`}
    {...props}
  >
    {children}
  </div>
);
