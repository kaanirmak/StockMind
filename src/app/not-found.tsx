import Link from 'next/link';

export const metadata = {
  title: '404 - Sayfa Bulunamadı | StockMind',
  description: 'Aradığınız sayfa mevcut değil veya taşınmış olabilir.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 glass-card p-8 sm:p-10 rounded-3xl border border-border/80 shadow-2xl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-lg shadow-accent/10">
          <span className="text-3xl font-black">404</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-text-primary">
            Sayfa Bulunamadı
          </h1>
          <p className="text-sm text-text-muted leading-relaxed">
            Aradığınız sayfa taşınmış, silinmiş veya geçici olarak kullanım dışı kalmış olabilir.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-sm transition-all shadow-md shadow-accent/20 cursor-pointer"
          >
            Ana Sayfaya Dön
          </Link>
          <Link
            href="/portfolio"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border font-medium text-sm transition-all cursor-pointer"
          >
            Portföyüm
          </Link>
          <Link
            href="/piyasalar"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border font-medium text-sm transition-all cursor-pointer"
          >
            Piyasalar
          </Link>
        </div>
      </div>
    </div>
  );
}
