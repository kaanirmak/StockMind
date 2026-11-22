export interface StockMindLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showProBadge?: boolean;
  inverted?: boolean;
  animated?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { img: 'h-6 sm:h-7', pro: 'text-[9px] px-1.5 py-0.5' },
  md: { img: 'h-8 sm:h-9 max-w-[190px]', pro: 'text-[9px] px-1.5 py-0.5' },
  lg: { img: 'h-11 sm:h-12', pro: 'text-[10px] px-2 py-0.5' },
} as const;

export function StockMindLogo({
  size = 'md',
  showProBadge = false,
  inverted = false,
  className = '',
}: StockMindLogoProps) {
  const cfg = SIZE_MAP[size];
  const base = `${cfg.img} w-auto max-w-full object-contain`;

  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      {inverted ? (
        <img
          src="/logo-white.png"
          alt="StockMind"
          className={`${base} drop-shadow-[0_0_14px_rgba(168,85,247,0.4)]`}
        />
      ) : (
        <>
          <img src="/logo-cropped.png" alt="StockMind" className={`${base} dark:hidden`} />
          <img
            src="/logo-white.png"
            alt="StockMind"
            className={`${base} hidden dark:block drop-shadow-[0_0_14px_rgba(168,85,247,0.35)]`}
          />
        </>
      )}
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
