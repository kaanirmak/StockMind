export interface StockMindMarkProps {
  className?: string;
  animated?: boolean;
  inverted?: boolean;
}

export function StockMindMark({ className = 'w-8 h-8', animated = false, inverted = false }: StockMindMarkProps) {
  const motion = animated ? ' animate-pulse' : '';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>
      {inverted ? (
        <img
          src="/icon-brain-dark.png"
          alt="StockMind"
          className={`w-full h-full object-contain drop-shadow-[0_0_10px_rgba(139,92,246,0.35)]${motion}`}
        />
      ) : (
        <>
          <img
            src="/icon-brain-light.png"
            alt="StockMind"
            className={`w-full h-full object-contain dark:hidden${motion}`}
          />
          <img
            src="/icon-brain-dark.png"
            alt="StockMind"
            className={`hidden w-full h-full object-contain dark:block drop-shadow-[0_0_10px_rgba(139,92,246,0.35)]${motion}`}
          />
        </>
      )}
    </span>
  );
}
