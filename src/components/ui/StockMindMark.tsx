export function StockMindMark({ className = 'w-8 h-8' }: { className?: string }) {
  return <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>
    <img src="/icon-brain-light.png" alt="StockMind" className="w-full h-full object-contain dark:hidden" />
    <img src="/icon-brain-dark.png" alt="StockMind" className="hidden w-full h-full object-contain dark:block" />
  </span>;
}
