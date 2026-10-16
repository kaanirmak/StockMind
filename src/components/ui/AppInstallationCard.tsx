'use client';
import { useEffect, useState } from 'react';
import { useAppPlatform } from '@/hooks/useAppPlatform';
import { Button } from './Button';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function AppInstallationCard() {
  const { os, installed } = useAppPlatform();
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    const handle = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    window.addEventListener('beforeinstallprompt', handle);
    return () => window.removeEventListener('beforeinstallprompt', handle);
  }, []);
  if (os === 'unknown') return null;
  if (installed) return <section className="settings-panel p-4 sm:p-6"><h2 className="font-semibold text-text-primary">Uygulama kurulu</h2><p className="text-sm text-text-secondary mt-1">Web uygulaması yenilikleri otomatik olarak alır.</p></section>;
  const title = os === 'android' ? 'Android uygulaması' : os === 'ios' ? 'iPhone ve iPad’de kullan' : os === 'mac' ? 'Mac’te kullan' : os === 'windows' ? 'Windows’ta kullan' : 'Masaüstünde kullan';
  return <section id="mobile" className="settings-panel p-4 sm:p-6 space-y-3">
    <h2 className="text-base font-semibold text-text-primary">{title}</h2>
    <p className="text-sm text-text-secondary">{os === 'android' ? 'Android uygulamasını indirip cihazınıza kurabilirsiniz.' : 'StockMind’ı tarayıcıdan ayrı bir uygulama penceresinde açın.'}</p>
    {os === 'android' ? <a href="/api/download/apk" download="StockMind.apk" className="inline-flex min-h-11 items-center px-4 rounded-xl bg-accent text-white text-sm font-semibold">Android APK İndir</a> : <Button size="sm" onClick={async () => {
      if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null); } else setShowGuide(value => !value);
    }}>{prompt ? 'Uygulamayı Yükle' : 'Kurulum adımları'}</Button>}
    {showGuide && <p className="text-sm text-text-secondary rounded-xl bg-bg-secondary p-3">{os === 'ios' ? 'Safari’de Paylaş menüsünü açıp “Ana Ekrana Ekle”yi seçin.' : os === 'mac' ? 'Safari’de Dosya → Dock’a Ekle seçeneğini kullanın. Chrome’da adres çubuğundaki uygulama yükleme simgesini kullanabilirsiniz.' : 'Chrome veya Edge’de adres çubuğundaki uygulama yükleme simgesini seçin. Bu simge görünmüyorsa tarayıcı menüsündeki uygulama yükleme seçeneğini kontrol edin.'}</p>}
    {showGuide && os !== 'ios' && <a href={os === 'mac' ? 'https://support.apple.com/tr-tr/104996' : 'https://support.google.com/chrome/answer/9658361'} target="_blank" rel="noopener noreferrer" className="inline-flex text-xs text-accent underline">Kurulum rehberi</a>}
  </section>;
}
