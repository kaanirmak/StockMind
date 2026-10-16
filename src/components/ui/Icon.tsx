import type { SVGProps } from 'react';

// Heroicons outline geometry, shared stroke and sizing across product controls.
const paths = {
  history: 'M3 11a9 9 0 1 1 2.5 7M3 4v7h7m2-4v5l3 2',
  search: 'M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  home: 'M3 10.5 12 3l9 7.5M5 9v12h5v-6h4v6h5V9',
  chart: 'M3 3v18h18M7 15l4-5 4 3 5-8',
  wallet: 'M3 7h18v14H3V7Zm0 0V4h15v3m-2 6h5m-4 0v3h4',
  star: 'm12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.5 6.4 20.4l1.1-6.3L3 9.6l6.2-.9L12 3Z',
  sparkles: 'm12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  plus: 'M12 4v16M4 12h16',
  menu: 'M4 6h16M4 12h16M4 18h16',
  phone: 'M7 2h10v20H7V2Zm4 17h2',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  warning: 'm12 3 10 18H2L12 3Zm0 6v5m0 3v1',
  check: 'm5 12 4 4L19 6',
  grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  layers: 'm12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 4l3 1 2-3h6l2 3 3-1 2 5-2 3 2 3-2 5-3-1-2 3H9l-2-3-3 1-2-5 2-3-2-3 2-5Z',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, className = 'h-5 w-5', ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}><path d={paths[name]} /></svg>;
}
