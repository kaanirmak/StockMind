import { StockMindMark } from './StockMindMark';

export interface StockMindLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showProBadge?: boolean;
  inverted?: boolean;
  animated?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { mark: 'w-6 h-6', text: 'text-base', pro: 'text-[9px] px-1.5 py-0.5' },
  md: { mark: 'w-8 h-8', text: 'text-lg', pro: 'text-[9px] px-1.5 py-0.5' },
  lg: { mark: 'w-11 h-11', text: 'text-2xl', pro: 'text-[10px] px-2 py-0.5' },
} as const;

export function StockMindLogo({
  size = 'md',
  showProBadge = false,
  inverted = false,
  animated = false,
  className = '',
}: StockMindLogoProps) {
  const cfg = SIZE_MAP[size];

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <StockMindMark
        className={`${cfg.mark} ${inverted ? 'text-accent-secondary drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]' : 'text-accent'}`}
        animated={animated}
      />
      <span
        className={`${cfg.text} tracking-tight leading-none ${
          inverted ? 'text-white' : 'text-text-primary'
        }`}
      >
        <strong className="font-extrabold">Stock</strong>
        <span className={inverted ? 'font-normal text-white/80' : 'font-normal text-text-secondary'}>
          Mind
        </span>
      </span>
      {showProBadge && (
        <span
          className={`${cfg.pro} rounded-md font-black uppercase tracking-wider bg-accent text-white shadow-xs`}
        >
          PRO
        </span>
      )}
    </span>
  );
}

export default StockMindLogo;
