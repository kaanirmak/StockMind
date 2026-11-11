export type RovingKey = 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End';

export function getNextRovingTabIndex(
  currentIndex: number,
  key: string,
  total: number
): number | null {
  if (total <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  if (key === 'ArrowRight') return (currentIndex + 1) % total;
  if (key === 'ArrowLeft') return (currentIndex - 1 + total) % total;
  return null;
}
