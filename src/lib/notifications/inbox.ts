export interface InboxItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  archived?: boolean;
  category: 'portfolio' | 'market' | 'ai' | 'system';
  link?: string;
}
export const INBOX_KEY = 'stockmind_notifications';
export function readInbox(): InboxItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(INBOX_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((n) => n && typeof n.id === 'string').map((n) => ({
      ...n, time: n.time || n.timestamp || '', category: n.category === 'price' ? 'market' : n.category,
      link: safeInboxLink(n.link || n.route),
    }));
  } catch { return []; }
}
export function safeInboxLink(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/(stocks\/|funds\/|portfolio|watchlist|dashboard|piyasalar|news|settings)/.test(value) && !value.includes('\\') ? value : undefined;
}
export function saveInbox(items: InboxItem[]) {
  try { localStorage.setItem(INBOX_KEY, JSON.stringify(items.slice(0, 200))); } catch { /* Storage may be unavailable in private browsing. */ }
  window.dispatchEvent(new Event('stockmind:inbox'));
}
