export interface StockMindMarkProps {
  className?: string;
  animated?: boolean;
}

export function StockMindMark({ className = 'w-8 h-8', animated = false }: StockMindMarkProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center text-accent ${className}`}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-full h-full"
      >
        <path
          d="M22 10a6.5 6.5 0 0 0-11 4.8 6 6 0 0 0-3 10.6 6.5 6.5 0 0 0 4.2 11.4 6 6 0 0 0 9.8 1.5"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 10v11m0 9v9"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M26 10a6.5 6.5 0 0 1 11 4.8 6 6 0 0 1 3 10.6 6.5 6.5 0 0 1-4.2 11.4 6 6 0 0 1-9.8 1.5"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 32 L21 21 L27 26 L41 11 M33 11 H41 V19"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animated ? 'stockmind-arrow-draw' : undefined}
        />
      </svg>
    </span>
  );
}
