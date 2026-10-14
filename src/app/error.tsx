'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled runtime error caught by error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 glass-card p-8 sm:p-10 rounded-3xl border border-rose-500/20 shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-primary">
            Beklenmeyen Bir Hata Oluştu
          </h2>
          <p className="text-xs text-text-muted leading-relaxed">
            İşlem sırasında geçici bir sorun meydana geldi. Lütfen yeniden deneyin veya ana sayfaya dönün.
          </p>
          {error.digest && (
            <p className="text-[10px] text-text-muted/60 font-mono">
              Hata referansı: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-sm transition-all shadow-md shadow-accent/20 cursor-pointer"
          >
            Yeniden Dene
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border font-medium text-sm transition-all cursor-pointer"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
