'use client';

import { useEffect, useState } from 'react';

type ProRequest = { id: string; email: string; name: string; note: string; requestedAt?: string };

export function ProAdminRequests({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<ProRequest[]>([]);
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setVisible(false);
    setRequests([]);
    setMessage('');
    fetch(`/api/admin/pro-requests?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401 || response.status === 403) return;
        setVisible(true);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Talepler alınamadı.');
        setRequests(data.requests);
        setHasMore(data.hasMore);
      }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [userId, page, revision]);

  async function decide(userId: string, action: 'approve' | 'reject') {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/pro-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, action }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Karar kaydedilemedi.');
      setRequests(current => current.filter(item => item.id !== userId));
      setMessage(data.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Karar kaydedilemedi.'); }
    finally { setBusy(false); }
  }

  if (!visible) return null;
  return <section className="settings-panel p-4 sm:p-6 space-y-4" aria-label="Pro talepleri yönetimi">
    <div className="flex justify-between items-center gap-3">
      <h2 className="font-bold text-text-primary">Pro Talepleri · Yönetici</h2>
      <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Yenile</button>
    </div>
    <p className="text-sm text-text-muted">Bekleyen talepleri buradan onaylayabilir veya reddedebilirsiniz. Onay, kullanıcının Pro özelliklerini açar.</p>
    {message && <p role="status" className="text-sm text-text-primary">{message}</p>}
    {requests.length === 0 && <p className="text-sm text-text-muted">Bu sayfada bekleyen talep yok.</p>}
    {requests.map(item => <article key={item.id} className="rounded-xl border border-border p-4 space-y-2">
      <p className="font-semibold break-all">{item.name || item.email}</p>
      <p className="text-sm text-text-muted break-all">{item.email}</p>
      {item.requestedAt && <p className="text-xs text-text-muted">{new Date(item.requestedAt).toLocaleString('tr-TR')}</p>}
      {item.note && <p className="text-sm whitespace-pre-wrap break-words">{item.note}</p>}
      <div className="flex gap-3">
        <button type="button" disabled={busy} onClick={() => decide(item.id, 'approve')} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">Onayla</button>
        <button type="button" disabled={busy} onClick={() => decide(item.id, 'reject')} className="rounded-lg border border-border px-4 py-2 disabled:opacity-50">Reddet</button>
      </div>
    </article>)}
    <div className="flex items-center gap-4 text-sm">
      <button type="button" disabled={page === 1 || busy} onClick={() => setPage(value => value - 1)}>Önceki</button>
      <span>Sayfa {page}</span>
      <button type="button" disabled={!hasMore || busy} onClick={() => setPage(value => value + 1)}>Sonraki</button>
    </div>
  </section>;
}
