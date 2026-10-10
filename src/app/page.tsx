import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function LandingPage() {
  let shouldRedirect = false;

  try {
    const cookieStore = await cookies();
    const isGuest = cookieStore.get('stockmind_guest')?.value === 'true';

    if (isGuest) {
      shouldRedirect = true;
    } else {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        shouldRedirect = true;
      }
    }
  } catch {
    // If Supabase client fails, proceed with rendering landing page
  }

  if (shouldRedirect) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-[#0d1321] to-bg-primary" />
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-secondary/5 rounded-full blur-[130px]" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 h-20">
        <Link href="/" className="flex items-center group">
          <img
            src="/logo-white.png"
            alt="StockMind"
            className="h-9 sm:h-11 w-auto object-contain group-hover:scale-105 transition-transform drop-shadow-[0_0_18px_rgba(139,92,246,0.35)]"
          />
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors font-medium"
          >
            Giriş Yap
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold hover:opacity-90 transition-all duration-200"
          >
            Kayıt Ol
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 lg:pt-32 pb-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle text-sm text-text-secondary mb-8 animate-fade-in-down">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          BIST • NYSE • NASDAQ • TEFAS destekli
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-text-primary leading-tight max-w-4xl animate-fade-in-up">
          Yatırımlarınızı
          <br />
          <span className="gradient-text">Akıllıca</span> Yönetin
        </h1>

        <p className="mt-6 text-lg lg:text-xl text-text-secondary max-w-2xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          StockMind ile borsa hisselerini ve TEFAS fonlarını gerçek zamanlı takip edin. 
          AI destekli analizler, teknik göstergeler ve portföy yönetimi ile yatırım kararlarınızı güçlendirin.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <Link
            href="/register"
            className="px-8 py-3.5 rounded-xl gradient-accent text-white text-base font-semibold hover:opacity-90 transition-all duration-200 shadow-lg shadow-accent/25 animate-pulse-glow"
          >
            Ücretsiz Başlayın →
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl glass-card border border-border text-text-primary text-base font-medium hover:border-accent/30 transition-all duration-200"
          >
            Demo Görüntüle
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-8 lg:gap-12 mt-16 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {[
            { value: '4+', label: 'Borsa' },
            { value: '10K+', label: 'Hisse & Fon' },
            { value: '15+', label: 'Teknik Gösterge' },
            { value: '🤖', label: 'AI Destekli' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl lg:text-3xl font-bold gradient-text">{stat.value}</p>
              <p className="text-xs lg:text-sm text-text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>



      {/* Features */}
      <section className="relative z-10 px-6 lg:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-4">Neden StockMind?</h2>
          <p className="text-text-secondary text-center mb-12 max-w-xl mx-auto">
            Profesyonel yatırımcılar için tasarlanmış, kullanımı kolay bir platform
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {[
              {
                icon: '📊',
                title: 'Gerçek Zamanlı Veriler',
                desc: 'BIST, NYSE ve NASDAQ hisselerini anlık olarak takip edin.',
              },
              {
                icon: '📈',
                title: 'Teknik Analiz',
                desc: 'RSI, MACD, Bollinger Bands ve daha fazlası ile analiz yapın.',
              },
              {
                icon: '💼',
                title: 'Portföy Yönetimi',
                desc: 'Alım/satım kayıtları, maliyet hesaplama ve performans takibi.',
              },
              {
                icon: '🏦',
                title: 'TEFAS Fonları',
                desc: 'Yatırım fonlarını keşfedin, karşılaştırın ve portföyünüze ekleyin.',
              },
              {
                icon: '🤖',
                title: 'AI Asistan',
                desc: 'Yapay zeka destekli piyasa analizi ve yatırım önerileri alın.',
              },
              {
                icon: '🌍',
                title: 'Çoklu Dil & Borsa',
                desc: 'Türkçe ve İngilizce arayüz, global borsalar desteği.',
              },
            ].map((feature) => (
              <div key={feature.title} className="glass-card p-6 group">
                <span className="text-3xl mb-4 block">{feature.icon}</span>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-accent flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-text-secondary">StockMind</span>
          </div>
          <p className="text-xs text-text-muted">
            © 2026 StockMind. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}
