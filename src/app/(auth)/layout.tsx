import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left Side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-bg-primary via-[#0f1a2e] to-[#1a1040]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-secondary/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-success/5 rounded-full blur-[80px]" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        {/* Content */}
        <div className="relative z-10 px-12 max-w-lg">
          <Link href="/" className="inline-block mb-8 group">
            <img
              src="/logo-white.png"
              alt="StockMind"
              className="h-12 lg:h-14 w-auto object-contain group-hover:scale-105 transition-transform drop-shadow-[0_0_24px_rgba(139,92,246,0.35)]"
            />
          </Link>
          
          <h1 className="text-4xl font-bold text-text-primary leading-tight mb-4">
            Akıllı Yatırım
            <br />
            <span className="gradient-text">Kararları</span> Alın
          </h1>
          
          <p className="text-text-secondary text-lg leading-relaxed mb-8">
            BIST, NYSE, NASDAQ ve TEFAS fonlarını tek platformdan takip edin. 
            AI destekli analizlerle portföyünüzü optimize edin.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {[
              '📊 Gerçek Zamanlı Veriler',
              '🤖 AI Analizler',
              '💼 Portföy Yönetimi',
              '📈 Teknik Analiz',
            ].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full text-sm font-medium glass-subtle text-text-secondary"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-fade-in-up">
          {children}
        </div>
      </div>
    </div>
  );
}
