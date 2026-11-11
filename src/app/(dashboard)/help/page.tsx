'use client';

import Link from 'next/link';
import {
  LANGUAGE_SCOPE_DECISION,
  SUPPORTED_LANGUAGES,
} from '@/lib/help/languageScope';
import { DATA_AND_PRIVACY_SECTIONS } from '@/lib/help/privacyAndDataGuide';

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black text-text-primary tracking-tight">
          Yardım, Dil Kapsamı &amp; Şeffaflık Merkezi
        </h1>
        <p className="text-sm text-text-muted">
          StockMind platformunun desteklenen dilleri, veri politikaları ve kullanıcı tercihlerine dair güncel rehber.
        </p>
      </div>

      {/* Supported Languages & Language Scope Decision (HSP-08) */}
      <section
        data-testid="help-language-scope"
        className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/70">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text-primary">
              Desteklenen Diller ve Dil Kapsamı
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {LANGUAGE_SCOPE_DECISION.decisionSummary}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent/15 border border-accent/30 text-accent">
            Aktif Dil: {LANGUAGE_SCOPE_DECISION.primaryLocale}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <div
              key={lang.code}
              data-testid={`supported-language-${lang.code}`}
              className="p-4 rounded-xl bg-bg-secondary/50 border border-border/80 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-text-primary">
                  {lang.nativeName} ({lang.locale})
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  Tam Destekli
                </span>
              </div>
              <p className="text-xs text-text-secondary">{lang.coverage}</p>
              <p className="text-[11px] text-text-muted">{lang.notes}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 text-xs text-text-muted">
          <span>
            Dil tercihlerinizi ve varsayılan para birimi ayarlarınızı hesap ayarlarından yönetebilirsiniz.
          </span>
          <Link
            href={LANGUAGE_SCOPE_DECISION.settingsLinkHref}
            className="px-3 py-1.5 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-border text-text-primary font-semibold shrink-0 transition-colors"
          >
            Ayarlara Git
          </Link>
        </div>
      </section>

      {/* Data & Privacy Help Guide (HSP-09) */}
      <section data-testid="help-privacy-guide" className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Veri Kaynakları, Gizlilik &amp; Kontrol Rehberi
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Piyasa verisinin kaynağı, yapay zekaya gönderilen bilgiler, widget paylaşımı ve hesap tercihleriniz.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DATA_AND_PRIVACY_SECTIONS.map((section) => (
            <article
              key={section.id}
              data-testid={`help-privacy-section-${section.id}`}
              className="glass-card p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <h3 className="text-sm sm:text-base font-bold text-text-primary">
                  {section.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {section.summary}
                </p>
                <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-text-muted leading-relaxed">
                  {section.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-border/60 flex justify-end">
                <Link
                  href={section.actionHref}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  {section.actionLabel} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
