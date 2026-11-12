import { palette } from '@/theme/palette';
import { escapeHtml } from '@/lib/utils/html';
import { MONTE_CARLO_SIMULATIONS } from '@/lib/quant/constants';
import type { BulletinMarketDataPayload, BulletinMarketKey } from '@/lib/email/marketData';
import type { PersonalizedBulletinSection } from '@/lib/email/personalizedBulletin';
import nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject?: string;
  userName?: string;
  isDailyReport?: boolean;
  marketData?: BulletinMarketDataPayload;
  personalizedPortfolio?: PersonalizedBulletinSection | null;
  portfolioSummary?: {
    totalValue?: number;
    totalPnL?: number;
    totalPnLPercent?: number;
  };
  customSmtp?: {
    service?: string;
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
  };
}

function formatBulletinObservationTime(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const formatted = parsed.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${formatted} TSİ`;
}

export function generateStockMindEmailHtml(userName: string = 'Değerli Yatırımcı', payload?: Partial<EmailPayload>): string {
  if (payload?.isDailyReport === false) {
    return '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>StockMind test e-postası</title></head><body><h1>StockMind</h1><p>Bu bir test e-postasıdır. Doğrulanmış hesabınıza e-posta gönderimi başarılı oldu.</p><p>Bu mesaj piyasa verisi veya portföy raporu içermez.</p></body></html>';
  }
  const date = new Date().toLocaleDateString('tr-TR', { dateStyle: 'long', timeZone: 'Europe/Istanbul' });
  const market = payload?.marketData;
  const gram = market?.gramAltin ?? (market?.gold && market?.usdtry ? market.gold * market.usdtry / 31.1034768 : undefined);
  const candidateRows: Array<{
    key: BulletinMarketKey;
    label: string;
    value: number | undefined;
    unit: string;
  }> = [
    { key: 'bist100', label: 'BIST 100', value: market?.bist100, unit: 'puan' },
    { key: 'thyao', label: 'Türk Hava Yolları (THYAO)', value: market?.thyao, unit: 'TRY' },
    { key: 'usdtry', label: 'Dolar / TL', value: market?.usdtry, unit: 'TRY' },
    { key: 'gold', label: 'Ons Altın', value: market?.gold, unit: 'USD' },
    { key: 'gramAltin', label: 'Gram Altın (hesaplanan)', value: gram, unit: 'TRY' },
    { key: 'btc', label: 'Bitcoin', value: market?.btc, unit: 'USD' },
  ];
  const marketRows = candidateRows.filter(
    (row) => typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0
  );
  const formatValue = (value: number, unit: string) =>
    unit === 'puan'
      ? `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} puan`
      : value.toLocaleString('tr-TR', { style: 'currency', currency: unit });
  const overallObservationLabel =
    formatBulletinObservationTime(market?.observedAt) ??
    formatBulletinObservationTime(market?.fetchedAt);
  const missingFields = Array.isArray(market?.missingFields)
    ? market.missingFields.map((item) => escapeHtml(String(item)))
    : [];
  const portfolio = payload?.portfolioSummary;
  const appUrl = escapeHtml(process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev');

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><title>StockMind 18:30 Piyasa Bülteni</title></head>
<body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif">
  <div style="max-width:580px;margin:24px auto;padding:28px;background:#fff;border-radius:16px">
    <p style="font-weight:bold;color:#4f46e5">StockMind · ${date}</p>
    <h1 style="font-size:24px">18:30 Piyasa Bülteni</h1>
    <p>Merhaba ${escapeHtml(userName)},</p>
    ${overallObservationLabel ? `<p style="font-size:13px;color:#475569;margin-top:4px">Veri gözlem zamanı: <strong>${escapeHtml(overallObservationLabel)}</strong></p>` : ''}
    ${marketRows.length ? `
    <p>Bülten hazırlanırken alınabilen son piyasa fiyatları</p>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th scope="col" style="text-align:left;border-bottom:2px solid #cbd5e1;padding:8px;font-size:12px;color:#475569">Enstrüman</th>
          <th scope="col" style="text-align:right;border-bottom:2px solid #cbd5e1;padding:8px;font-size:12px;color:#475569">Fiyat</th>
          <th scope="col" style="text-align:right;border-bottom:2px solid #cbd5e1;padding:8px;font-size:12px;color:#475569">Gözlem Zamanı</th>
        </tr>
      </thead>
      <tbody>${marketRows.map(({ key, label, value, unit }) => {
        const obsMeta = market?.observations?.[key];
        const rowObsText =
          formatBulletinObservationTime(obsMeta?.observedAt) ??
          overallObservationLabel ??
          'Zaman bilgisi yok';
        const obsSuffix = obsMeta?.source ? ` (${escapeHtml(obsMeta.source)})` : '';
        return `
        <tr>
          <th scope="row" style="text-align:left;border-bottom:1px solid #e2e8f0;padding:8px">${label}</th>
          <td style="text-align:right;border-bottom:1px solid #e2e8f0;padding:8px">${formatValue(value!, unit)}</td>
          <td style="text-align:right;border-bottom:1px solid #e2e8f0;padding:8px;font-size:12px;color:#475569">${escapeHtml(rowObsText)}${obsSuffix}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>` : '<div style="padding:12px 14px;border-radius:10px;background:#fef3c7;color:#92400e;border:1px solid #fde68a;margin-top:12px"><strong>Boş Veri Durumu:</strong> Bu gönderim için piyasa kaynaklarından güncel fiyat alınamadı. Tahmini veya örnek veri eklenmedi.</div>'}
    ${missingFields.length > 0 ? `
    <div style="margin-top:16px;padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:13px;color:#334155">
      <strong>Eksik / Alınamayan Kaynaklar (Boş Veri):</strong>
      <ul style="margin:6px 0 0 18px;padding:0">
        ${missingFields.map((field) => `<li>${field} — kaynak verisi yok</li>`).join('')}
      </ul>
    </div>` : ''}
    ${payload?.personalizedPortfolio?.enabled ? (() => {
      const pSection = payload.personalizedPortfolio;
      const summary = pSection.allowedSummary;
      const summaryParts: string[] = [];
      if (typeof summary.totalValue === 'number') {
        summaryParts.push(`Toplam Değer: <strong>${escapeHtml(formatValue(summary.totalValue, 'TRY'))}</strong>`);
      }
      if (typeof summary.dailyChangePct === 'number') {
        const sign = summary.dailyChangePct >= 0 ? '+' : '';
        summaryParts.push(`Günlük Değişim: <strong>${escapeHtml(`${sign}${summary.dailyChangePct.toFixed(2)}%`)}</strong>`);
      }
      const eventsHtml = pSection.events.length > 0
        ? `<ul style="margin:8px 0 0 18px;padding:0">
            ${pSection.events.map((ev) => `<li style="margin-bottom:4px"><strong>${escapeHtml(ev.symbol)}</strong>: ${escapeHtml(ev.title)} <span style="color:#64748b">(${escapeHtml(ev.source)})</span></li>`).join('')}
          </ul>`
        : '<p style="margin:6px 0 0;color:#64748b">Portföy varlıklarınızla eşleşen yeni olay bulunmuyor.</p>';
      return `
    <div style="margin-top:18px;padding:14px 16px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;font-size:13px;color:#1e293b">
      <p style="margin:0 0 6px;font-weight:bold;color:#3730a3">Kişiselleştirilmiş Portföy Özeti</p>
      <p style="margin:0 0 8px;font-size:12px;color:#475569">İzin verilen alanlar: ${escapeHtml(pSection.allowedFieldLabels.join(', ') || 'Yalnızca izinli özet')}</p>
      ${summaryParts.length > 0 ? `<p style="margin:0 0 8px">${summaryParts.join(' · ')}</p>` : ''}
      ${eventsHtml}
    </div>`;
    })() : ''}
    ${typeof portfolio?.totalValue === 'number' && Number.isFinite(portfolio.totalValue)
      ? `<p>Portföy değeri ${formatValue(portfolio.totalValue, 'TRY')}</p>`
      : ''}
    <p style="margin-top:24px"><a href="${appUrl}/dashboard" style="color:#4f46e5">StockMind panelini aç</a></p>
  </div>
</body>
</html>`;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  previewUrl?: string;
  method?: string;
  from?: string;
  senderAddress?: string;
  accepted?: string[];
  messageId?: string;
  requiresSmtpConfig?: boolean;
  error?: string;
}

export interface EmailTransportDiagnostics {
  mode: 'gmail' | 'resend' | 'brevo' | 'smtp' | 'unconfigured';
  gmailOnly: boolean;
  configured: boolean;
  senderAddress: string;
  expectedGmailSender: string;
  senderMatchesExpectedGmail: boolean;
}

export function getEmailTransportDiagnostics(): EmailTransportDiagnostics {
  const gmailOnly = process.env.EMAIL_TRANSPORT?.trim() === 'gmail';
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpService = (process.env.SMTP_SERVICE || '').trim();
  const smtpHost = (process.env.SMTP_HOST || '').trim().toLowerCase();
  const resendApiKey = gmailOnly ? '' : (process.env.RESEND_API_KEY || '').trim();
  const brevoApiKey = gmailOnly ? '' : (process.env.BREVO_API_KEY || '').trim();
  const expectedGmailSender = (process.env.ADMIN_EMAIL || 'kaanrmak7@gmail.com').trim().toLowerCase();

  if (gmailOnly || (!resendApiKey && !brevoApiKey && (smtpService === 'gmail' || smtpHost === 'smtp.gmail.com'))) {
    const configured = Boolean(smtpUser && smtpPass);
    return {
      mode: 'gmail',
      gmailOnly,
      configured,
      senderAddress: smtpUser,
      expectedGmailSender,
      senderMatchesExpectedGmail: Boolean(smtpUser && smtpUser.toLowerCase() === expectedGmailSender),
    };
  }
  if (resendApiKey) {
    const resendFrom = (process.env.RESEND_FROM || process.env.SMTP_FROM || '').trim();
    return {
      mode: 'resend',
      gmailOnly: false,
      configured: true,
      senderAddress: resendFrom,
      expectedGmailSender,
      senderMatchesExpectedGmail: false,
    };
  }
  if (brevoApiKey) {
    const brevoSender = (process.env.BREVO_SENDER || smtpUser || '').trim();
    return {
      mode: 'brevo',
      gmailOnly: false,
      configured: true,
      senderAddress: brevoSender,
      expectedGmailSender,
      senderMatchesExpectedGmail: false,
    };
  }
  if (smtpUser && smtpPass) {
    return {
      mode: 'smtp',
      gmailOnly: false,
      configured: true,
      senderAddress: smtpUser,
      expectedGmailSender,
      senderMatchesExpectedGmail: smtpUser.toLowerCase() === expectedGmailSender,
    };
  }
  return {
    mode: 'unconfigured',
    gmailOnly,
    configured: false,
    senderAddress: '',
    expectedGmailSender,
    senderMatchesExpectedGmail: false,
  };
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  customSmtp?: EmailPayload['customSmtp'];
}

/** Explicit Gmail configuration uses the authenticated mailbox for all outgoing mail. */
export async function sendEmailTransport(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, from, customSmtp } = options;

  if (!to || !to.includes('@')) {
    return { success: false, message: 'Geçersiz e-posta adresi' };
  }

  const gmailOnly = process.env.EMAIL_TRANSPORT?.trim() === 'gmail';
  const resendApiKey = gmailOnly ? '' : (process.env.RESEND_API_KEY || '').trim();
  let senderVerificationFailed = false;
  if (resendApiKey) {
    try {
      const resendFrom =
        from ||
        process.env.RESEND_FROM?.trim() ||
        process.env.SMTP_FROM?.trim() ||
        'StockMind <onboarding@resend.dev>';

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(8_000),
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom.includes('<') ? resendFrom : `StockMind <${resendFrom}>`,
          to: [to],
          subject,
          html,
        }),
      });

      const data: any = await res.json().catch(() => null);

      if (res.ok && data?.id) {
        const formattedFrom = resendFrom.includes('<') ? resendFrom : `StockMind <${resendFrom}>`;
        return {
          success: true,
          message: 'E-posta, gönderim için servis sağlayıcısı tarafından kabul edildi.',
          method: 'resend_api',
          from: formattedFrom,
          senderAddress: resendFrom,
          messageId: String(data.id),
          accepted: [to],
        };
      } else {
        senderVerificationFailed = res.status === 403 &&
          (/@resend\.dev\b/i.test(resendFrom) || /verify|verified|verification/i.test(String(data?.message || '')));
        console.warn('Resend API rejected email', { status: res.status, code: data?.name });
      }
    } catch (err: any) {
      console.warn('Resend API delivery failed', { name: err?.name });
    }
  }

  const brevoApiKey = gmailOnly ? '' : (process.env.BREVO_API_KEY || '').trim();
  if (brevoApiKey) {
    try {
      const senderEmail = (process.env.BREVO_SENDER || process.env.SMTP_USER || 'noreply@stockmind.app').trim();
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        signal: AbortSignal.timeout(8_000),
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: 'StockMind' },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      const data: any = await res.json().catch(() => null);
      if (res.ok && (data?.messageId || data?.id)) {
        return {
          success: true,
          message: 'E-posta, gönderim için servis sağlayıcısı tarafından kabul edildi.',
          method: 'brevo_api',
          from: `StockMind <${senderEmail}>`,
          senderAddress: senderEmail,
          messageId: String(data.messageId || data.id),
          accepted: [to],
        };
      }
      console.warn('Brevo API rejected email', { status: res.status, code: data?.code });
    } catch (err: any) {
      console.warn('Brevo API delivery failed', { name: err?.name });
    }
  }

  const smtpOverride = gmailOnly ? undefined : customSmtp;
  const smtpUser = (smtpOverride?.user || process.env.SMTP_USER || '').trim();
  const smtpPass = (smtpOverride?.pass || process.env.SMTP_PASS || '').trim();
  const smtpHost = (smtpOverride?.host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpService = smtpOverride?.service || process.env.SMTP_SERVICE;
  const smtpFrom = (!gmailOnly && (from || smtpOverride?.from || process.env.SMTP_FROM)?.trim()) ||
    `StockMind <${smtpUser}>`;
  let gmailAuthFailed = false;

  if (smtpUser && smtpPass) {
    try {
      const isGmail = gmailOnly || smtpService === 'gmail' || smtpHost.toLowerCase() === 'smtp.gmail.com';
      const configuredPort = smtpOverride?.port || Number(process.env.SMTP_PORT) || 587;
      const port = gmailOnly || (isGmail && configuredPort !== 587) ? 465 : configuredPort;
      const transporter = nodemailer.createTransport({
        host: isGmail ? 'smtp.gmail.com' : smtpHost,
        port,
        secure: port === 465,
        requireTLS: isGmail,
        auth: { user: smtpUser, pass: isGmail ? smtpPass.replace(/\s+/g, '') : smtpPass },
        connectionTimeout: 6_000,
        greetingTimeout: 6_000,
        socketTimeout: 8_000,
        tls: { rejectUnauthorized: true },
      });

      const normalizedFrom = smtpFrom.includes('<') ? smtpFrom : `StockMind Bildirimleri <${smtpFrom}>`;
      const info = await transporter.sendMail({
        from: normalizedFrom,
        to,
        subject,
        html,
      });

      if (info.accepted?.length === 0) throw new Error('SMTP recipient rejected');
      return {
        success: true,
        message: 'E-posta, gönderim için servis sağlayıcısı tarafından kabul edildi.',
        method: isGmail ? 'google_smtp' : 'custom_smtp',
        from: normalizedFrom,
        senderAddress: smtpUser,
        accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [to],
        messageId: info.messageId ? String(info.messageId) : undefined,
      };
    } catch (err: any) {
      gmailAuthFailed = gmailOnly && err?.code === 'EAUTH';
      console.warn('SMTP transport attempt failed', { code: err?.code, responseCode: err?.responseCode });
    }
  }

  // 4. Webhook Notification fallback for Admin alerts
  const adminWebhookUrl = (process.env.ADMIN_WEBHOOK_URL || '').trim();
  if (adminWebhookUrl) {
    try {
      await fetch(adminWebhookUrl, {
        method: 'POST',
        signal: AbortSignal.timeout(3_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🔔 **StockMind Bildirimi**\n**Alıcı:** ${to}\n**Konu:** ${subject}`,
        }),
      });
    } catch {
      // Non-fatal
    }
  }

  const hasProvider = Boolean(resendApiKey || brevoApiKey || (smtpUser && smtpPass));
  let errorDetails = 'E-posta sağlayıcısı gönderimi tamamlayamadı. Lütfen daha sonra tekrar deneyin.';
  if (gmailAuthFailed) {
    errorDetails = 'Gmail gönderici hesabının uygulama parolasını kabul etmedi.';
  } else if (gmailOnly && !hasProvider) {
    errorDetails = 'Gmail gönderici hesabı veya uygulama parolası sunucuda eksik.';
  } else if (senderVerificationFailed) {
    errorDetails = 'Resend gönderici adresi doğrulanamadı. Sunucuda doğrulanmış bir alan adına ait gönderici adresi kullanılmalı.';
  } else if (!hasProvider) {
    errorDetails = 'Sunucuda e-posta sağlayıcısı yapılandırılmamış.';
  }

  return {
    success: false,
    error: 'EMAIL_DISPATCH_FAILED',
    message: `E-posta gönderilemedi: ${errorDetails}`,
    method: 'failed',
  };
}

export async function sendTestEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const { to, userName = 'Değerli Yatırımcı' } = payload;
  if (!to || !to.includes('@')) {
    return { success: false, message: 'Geçersiz e-posta adresi' };
  }

  const html = generateStockMindEmailHtml(userName, payload);
  const subject =
    payload.subject ||
    `StockMind Test Bildirimi • ${userName} (${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`;

  return sendEmailTransport({
    to,
    subject,
    html,
    customSmtp: payload.customSmtp,
  });
}

export interface ProRequestEmailParams {
  adminEmail: string;
  userName: string;
  userEmail: string;
  userId: string;
  requestNote?: string;
  reviewUrl: string;
}

export async function sendProRequestAdminEmail(params: ProRequestEmailParams): Promise<SendEmailResult> {
  const { adminEmail, userName, userEmail, userId, requestNote, reviewUrl } = params;
  const dateStr = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

  const safeUserName = escapeHtml(userName);
  const safeUserEmail = escapeHtml(userEmail);
  const safeUserId = escapeHtml(userId);
  const safeRequestNote = requestNote ? escapeHtml(requestNote) : undefined;

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>StockMind Yeni Pro Hesap Talebi</title>
  <style>
    body { margin: 0; padding: 0; background-color: #060913; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
    .card { background: linear-gradient(135deg, #0d1527 0%, #111a33 100%); border: 1px solid #1e293b; border-radius: 20px; padding: 32px; }
    .logo { font-size: 22px; font-weight: 900; color: #6366f1; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 100px; font-size: 11px; font-weight: 700; color: #fbbf24; }
    .title { font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 20px; margin-bottom: 12px; }
    .info-box { background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #94a3b8; font-weight: 600; }
    .info-val { color: #f8fafc; font-weight: 700; }
    .btn-approve { display: block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 15px; font-weight: 800; text-align: center; margin: 24px 0 12px; }
    .btn-reject { display: block; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
        <span class="logo">⚡ StockMind Yönetici Bildirimi</span>
        <span class="badge">PRO TALEBİ</span>
      </div>

      <div class="title">Yeni Bir Kullanıcı Pro Hesap İstiyor!</div>
      <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">
        Aşağıdaki kullanıcı hesabını StockMind Pro'ya yükseltmek için talepte bulundu. Talebi incelemek için yönetim konsoluna gidin ve ikinci faktörle doğrulayın:
      </p>

      <div class="info-box">
        <div class="info-row"><span class="info-label">Ad Soyad:</span><span class="info-val">${safeUserName}</span></div>
        <div class="info-row"><span class="info-label">E-posta:</span><span class="info-val">${safeUserEmail}</span></div>
        <div class="info-row"><span class="info-label">Kullanıcı ID:</span><span class="info-val" style="font-family: monospace; font-size: 11px;">${safeUserId}</span></div>
        <div class="info-row"><span class="info-label">Talep Tarihi:</span><span class="info-val">${dateStr}</span></div>
        ${safeRequestNote ? `<div class="info-row" style="flex-direction: column; gap: 4px;"><span class="info-label">Kullanıcı Notu:</span><span class="info-val" style="font-style: italic; color: #cbd5e1;">"${safeRequestNote}"</span></div>` : ''}
      </div>

      <a href="${escapeHtml(reviewUrl)}" class="btn-approve">Yönetim Konsolunda İncele</a>

      <p style="text-align: center; font-size: 11px; color: #64748b; margin-top: 24px;">
        Bu e-posta sadece StockMind yöneticisine iletilmiştir. Bağlantıyı açmak talep durumunu değiştirmez.
      </p>
    </div>
  </div>
</body>
</html>`;

  return sendEmailTransport({
    to: adminEmail,
    subject: `🔔 Yeni StockMind Pro Talebi: ${safeUserName} (${safeUserEmail})`,
    html,
  });
}

export async function sendProApprovedUserEmail(params: { to: string; userName: string; appUrl: string }): Promise<SendEmailResult> {
  const { to, userName, appUrl } = params;
  const safeUserName = escapeHtml(userName);

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Tebrikler! StockMind Pro Hesabınız Aktif</title>
  <style>
    body { margin: 0; padding: 0; background-color: #060913; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
    .card { background: linear-gradient(135deg, #0d1527 0%, #111a33 100%); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 20px; padding: 32px; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.1); }
    .logo { font-size: 22px; font-weight: 900; color: #6366f1; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 100px; font-size: 11px; font-weight: 700; color: #fbbf24; }
    .title { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 20px; margin-bottom: 12px; }
    .feature-list { background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; margin: 20px 0; }
    .feature-item { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; color: #cbd5e1; }
    .feature-item:last-child { border-bottom: none; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 800; text-align: center; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
        <span class="logo">⚡ StockMind</span>
        <span class="badge">⭐ PRO ÜYELİK AKTİF</span>
      </div>

      <div class="title">Tebrikler ${safeUserName}, Hesabınız Pro'ya Yükseltildi! 🎉</div>
      <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
        StockMind Pro talebiniz yönetici tarafından incelendi ve onaylandı. Artık en gelişmiş kantitatif analiz ve çoklu yapay zeka araçları hesabınızda sınırsız olarak açık!
      </p>

      <div class="feature-list">
        <div class="feature-item">✨ <strong>Yatırım Komitesi:</strong> 4 uzman AI ajanının konsensüs ve çoklu analiz motoru</div>
        <div class="feature-item">✨ <strong>Gelişmiş AI Modelleri:</strong> GPT-4o, Claude 3.5 Sonnet ve premium modeller</div>
        <div class="feature-item">✨ <strong>Otomatik DCF & Monte Carlo:</strong> ${MONTE_CARLO_SIMULATIONS.toLocaleString('tr-TR')} simülasyonlu risk ve adil değerleme</div>
        <div class="feature-item">✨ <strong>Öncelikli Piyasa Analizi:</strong> Günlük 18:30 VIP kapanış bülteni ve limitsiz takip</div>
      </div>

      <div style="text-align: center;">
        <a href="${appUrl}/dashboard" class="btn">StockMind Pro'yu Keşfet &rarr;</a>
      </div>

      <p style="text-align: center; font-size: 11px; color: #64748b; margin-top: 28px;">
        StockMind Teknoloji A.Ş. • İyi yatırımlar dileriz.
      </p>
    </div>
  </div>
</body>
</html>`;

  return sendEmailTransport({
    to,
    subject: `🎉 Tebrikler! StockMind Pro Hesabınız Onaylandı`,
    html,
  });
}


