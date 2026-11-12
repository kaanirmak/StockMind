'use client';

import { useEffect, useState } from 'react';

type LogItem = { id: string | number; created_at: string; level: string; area: string; event: string; message: string; request_id: string | null; context: unknown };

export function ApplicationLogsPanel() {
  const [level, setLevel] = useState('');
  const [area, setArea] = useState('');
  const [before, setBefore] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<LogItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams();
    if (level) query.set('level', level);
    if (area) query.set('area', area);
    if (before) query.set('before', before);
    fetch(`/api/admin/logs?${query}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.success !== true) throw new Error(data?.error || 'Loglar yüklenemedi.');
        setItems(data.items);
        setNext(data.next);
      })
      .catch(err => { if (!controller.signal.aborted) { setError(err.message); setItems([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [level, area, before, revision]);

  return <section className="space-y-4 rounded-2xl border border-white/10 bg-[#070b16] p-5" aria-label="Uygulama logları">
    <h2 className="text-lg font-bold text-white">Uygulama Logları</h2>
    <p className="text-xs text-slate-400">E-posta, bülten, yönetici işlemleri ve sunucu hatalarının kalıcı kayıtları. Yeni kayıtlar bu sürümden itibaren toplanır; eski Cloudflare logları burada aktarılmış sayılmaz. Anahtarlar, çerezler ve alıcı adresleri maskelenir.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm text-slate-300">Seviye
        <select value={level} onChange={e => { setLevel(e.target.value); setBefore(null); }} className="ml-2 rounded-lg bg-slate-800 p-2">
          <option value="">Tümü</option><option value="info">Bilgi</option><option value="warn">Uyarı</option><option value="error">Hata</option>
        </select>
      </label>
      <label className="text-sm text-slate-300">Alan
        <select value={area} onChange={e => { setArea(e.target.value); setBefore(null); }} className="ml-2 rounded-lg bg-slate-800 p-2">
          <option value="">Tümü</option><option value="email">E-posta</option><option value="bulletin">Bülten</option><option value="admin">Yönetici</option><option value="api">API</option>
        </select>
      </label>
      <button disabled={loading} onClick={() => setRevision(r => r + 1)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">Yenile</button>
      {before && <button onClick={() => setBefore(null)} className="px-3 py-2 text-sm underline">En yeni kayıtlar</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {loading ? <p role="status" className="text-sm text-slate-400">Loglar yükleniyor...</p> : !error && items.length === 0 ? <p className="text-sm text-slate-400">Bu filtrede kayıt yok.</p> : null}
    <div className="space-y-2">
      {!loading && items.map(item => <article key={item.id} className="rounded-xl border border-slate-700 p-3 text-sm">
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</time>
          <span className={item.level === 'error' ? 'text-red-300' : item.level === 'warn' ? 'text-amber-300' : 'text-sky-300'}>{item.level}</span>
          <span>{item.area} / {item.event}</span>
        </div>
        <p className="mt-2 break-words text-slate-200">{item.message}</p>
        <details className="mt-2 text-xs text-slate-400"><summary className="cursor-pointer">Teknik ayrıntı</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(item.context, null, 2)}</pre>
        </details>
      </article>)}
    </div>
    {next && <button disabled={loading} onClick={() => setBefore(next)} className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-white">Daha eski kayıtlar</button>}
  </section>;
}
