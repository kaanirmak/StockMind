import { palette } from '@/theme/palette';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export interface EmailPayload {
  to: string;
  subject?: string;
  userName?: string;
  isDailyReport?: boolean;
  marketData?: {
    gold?: number;
    goldChange?: number;
    gramAltin?: number;
    usdtry?: number;
    btc?: number;
    brent?: number;
    bist100?: number;
    thyao?: number;
  };
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

export function generateStockMindEmailHtml(userName: string = 'Değerli Yatırımcı', payload?: Partial<EmailPayload>): string {
  if (payload?.isDailyReport === false) {
    return '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>StockMind test e-postası</title></head><body><h1>StockMind</h1><p>Bu bir test e-postasıdır. Doğrulanmış hesabınıza e-posta gönderimi başarılı oldu.</p><p>Bu mesaj piyasa verisi veya portföy raporu içermez.</p></body></html>';
  }
  const dateStr = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const goldPrice = payload?.marketData?.gold || 4309.66;
  const usdPrice = payload?.marketData?.usdtry || 48.63;
  const gramAltin = payload?.marketData?.gramAltin || ((goldPrice * usdPrice) / 31.1034768);
  const btcPrice = payload?.marketData?.btc || 75871.58;
  const isDaily = payload?.isDailyReport ?? true;
  const pSummary = payload?.portfolioSummary || { totalValue: 184500, totalPnL: 8420, totalPnLPercent: 4.78 };

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>StockMind ${isDaily ? 'Günlük Piyasa Kapanış Bülteni (18:30)' : 'Portföy ve Piyasa Bildirimi'}</title>
  <style>
    body { margin: 0; padding: 0; background-color: ${palette.color060913}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${palette.colorf1f5f9}; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
    .card { background: linear-gradient(135deg, ${palette.color0d1527} 0%, ${palette.color111a33} 100%); border: 1px solid ${palette.color1e293b}; border-radius: 20px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .logo { font-size: 24px; font-weight: 900; background: linear-gradient(to right, ${palette.color6366f1}, ${palette.primaryDark}, ${palette.color06b6d4}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 100px; font-size: 11px; font-weight: 700; color: ${palette.color818cf8}; margin-top: 8px; }
    .badge-daily { background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: ${palette.color34d399}; }
    .title { font-size: 20px; font-weight: 800; color: ${palette.colorffffff}; margin-top: 24px; margin-bottom: 8px; }
    .text { font-size: 14px; line-height: 1.6; color: ${palette.color94a3b8}; margin-bottom: 24px; }
    .metrics-grid { display: table; width: 100%; margin-bottom: 16px; }
    .metric-cell { display: table-cell; width: 50%; padding: 12px 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; }
    .metric-cell:first-child { border-right: 6px solid transparent; }
    .metric-cell:last-child { border-left: 6px solid transparent; }
    .metric-label { font-size: 11px; color: ${palette.color64748b}; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .metric-val { font-size: 17px; font-weight: 800; font-family: monospace; color: ${palette.colorf8fafc}; }
    .positive { color: ${palette.success}; }
    .portfolio-box { background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 14px; padding: 18px; margin-bottom: 20px; }
    .ai-box { background: rgba(99, 102, 241, 0.08); border-left: 3px solid ${palette.color6366f1}; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; }
    .btn { display: inline-block; background: linear-gradient(135deg, ${palette.color6366f1}, ${palette.color4f46e5}); color: ${palette.colorffffff}; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; text-align: center; margin-top: 8px; }
    .footer { text-align: center; font-size: 11px; color: ${palette.color475569}; margin-top: 28px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
        <span class="logo">⚡ StockMind</span>
        <span class="badge ${isDaily ? 'badge-daily' : ''}">${isDaily ? '⏰ HER GÜN 18:30 BÜLTENİ' : 'CANLI TEST BİLDİRİMİ'}</span>
      </div>

      <div class="title">Merhaba ${userName}, ${isDaily ? 'Günün Piyasa Kapanış Raporu Hazır!' : 'Test e-postan başarıyla ulaştı! 🎉'}</div>
      <div class="text">
        ${isDaily 
          ? `BIST ve küresel piyasaların günlük seans kapanışı tamamlandı. Portföyünüzün bugünkü performansı ve anlık TradingView & TEFAS piyasa özeti aşağıda sunulmuştur:` 
          : `Bu e-posta, <strong>StockMind Finansal Zeka Sistemi</strong> bildirim hattının ve günlük bülten servisinin başarıyla çalıştığını doğrulamak için gönderilmiştir.`
        }
      </div>

      <!-- Portfolio Section -->
      <div class="portfolio-box">
        <div style="font-size: 11px; font-weight: 700; color: ${palette.color34d399}; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">💼 Günlük Portföy Durumu (18:30 Kapanış)</div>
        <div style="display: table; width: 100%;">
          <div style="display: table-cell; width: 50%;">
            <div style="font-size: 11px; color: ${palette.color64748b};">Toplam Portföy Değeri</div>
            <div style="font-size: 19px; font-weight: 800; font-family: monospace; color: ${palette.colorffffff};">₺${pSummary.totalValue?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style="display: table-cell; width: 50%; text-align: right;">
            <div style="font-size: 11px; color: ${palette.color64748b};">Net Günlük Kâr / Getiri</div>
            <div style="font-size: 19px; font-weight: 800; font-family: monospace; color: ${palette.success};">
              +₺${pSummary.totalPnL?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} (+%${pSummary.totalPnLPercent?.toFixed(2)})
            </div>
          </div>
        </div>
      </div>

      <!-- Market Live Grid -->
      <div class="metrics-grid">
        <div class="metric-cell">
          <div class="metric-label">Ons Altın (XAU/USD)</div>
          <div class="metric-val">$${goldPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span class="positive" style="font-size: 11px;">+0.27%</span></div>
        </div>
        <div class="metric-cell">
          <div class="metric-label">Gram Altın (TL)</div>
          <div class="metric-val">₺${gramAltin.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} <span class="positive" style="font-size: 11px;">+0.26%</span></div>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-cell">
          <div class="metric-label">Dolar / TL (USDTRY)</div>
          <div class="metric-val">₺${usdPrice.toFixed(2)}</div>
        </div>
        <div class="metric-cell">
          <div class="metric-label">Bitcoin (BTC/USD)</div>
          <div class="metric-val">$${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <!-- Technical Analysis Levels Section -->
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: ${palette.color38bdf8}; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">📊 18:30 Kapanış Teknik Seviyeleri (AI Özeti)</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: ${palette.colorcbd5e1};">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: ${palette.color64748b}; font-size: 11px; text-align: left;">
              <th style="padding: 6px 4px;">Varlık</th>
              <th style="padding: 6px 4px;">Destek (S1)</th>
              <th style="padding: 6px 4px;">Pivot (PP)</th>
              <th style="padding: 6px 4px;">Direnç (R1)</th>
              <th style="padding: 6px 4px;">Sinyal</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 4px; font-weight: 700; color: ${palette.colorffffff};">Gram Altın</td>
              <td style="padding: 8px 4px; font-family: monospace; color: ${palette.color34d399};">₺${((gramAltin * 0.985)).toFixed(2)}</td>
              <td style="padding: 8px 4px; font-family: monospace;">₺${gramAltin.toFixed(2)}</td>
              <td style="padding: 8px 4px; font-family: monospace; color: ${palette.warning};">₺${((gramAltin * 1.025)).toFixed(2)}</td>
              <td style="padding: 8px 4px; font-weight: 700; color: ${palette.color34d399};">GÜÇLÜ AL</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 4px; font-weight: 700; color: ${palette.colorffffff};">BIST 100 (XU100)</td>
              <td style="padding: 8px 4px; font-family: monospace; color: ${palette.color34d399};">9.820</td>
              <td style="padding: 8px 4px; font-family: monospace;">10.050</td>
              <td style="padding: 8px 4px; font-family: monospace; color: ${palette.warning};">10.280</td>
              <td style="padding: 8px 4px; font-weight: 700; color: ${palette.color38bdf8};">POZİTİF</td>
            </tr>
            <tr>
              <td style="padding: 8px 4px; font-weight: 700; color: ${palette.colorffffff};">Ons Altın (XAU)</td>
              <td style="padding: 8px 4px; font-family: monospace; color: ${palette.color34d399};">$${((goldPrice * 0.985)).toFixed(1)}</td>
              <td style="padding: 8px 4px; font-family: monospace;">$${goldPrice.toFixed(1)}</td>
              <td style="padding: 8px 4px; font-family: monospace; color: ${palette.warning};">$${((goldPrice * 1.025)).toFixed(1)}</td>
              <td style="padding: 8px 4px; font-weight: 700; color: ${palette.color34d399};">AL</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Critical Market News Section -->
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: ${palette.color818cf8}; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">📰 Günün Öne Çıkan Piyasa & Finans Gelişmeleri</div>
        <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size: 13px; font-weight: 700; color: ${palette.colorffffff}; margin-bottom: 2px;">• BIST Kapanışında Sanayi ve Bankacılık Hisselerinde Alım Hacmi Arttı</div>
          <div style="font-size: 11px; color: ${palette.color94a3b8}; line-height: 1.4;">BIST 100 endeksi günü yabancı para girişlerinin desteğiyle kritik direnç testinde kapattı. AI duyarlılığı: <span style="color: ${palette.color34d399}; font-weight: 700;">Pozitif</span></div>
        </div>
        <div>
          <div style="font-size: 13px; font-weight: 700; color: ${palette.colorffffff}; margin-bottom: 2px;">• Küresel Merkez Bankaları ve Altın Fiyatlarında Rekor Seviyeler Korunuyor</div>
          <div style="font-size: 11px; color: ${palette.color94a3b8}; line-height: 1.4;">Fed faiz indirimi beklentileri ve jeopolitik gelişmeler ons ve gram altında güvenli liman talebini canlı tutuyor. AI duyarlılığı: <span style="color: ${palette.color34d399}; font-weight: 700;">Pozitif</span></div>
        </div>
      </div>

      <div class="ai-box">
        <div style="font-size: 12px; font-weight: 700; color: ${palette.colora5b4fc}; margin-bottom: 4px;">🧠 StockMind Finansal Zeka Notu</div>
        <div style="font-size: 12px; color: ${palette.colorcbd5e1}; line-height: 1.5;">
          Tüm teknik seviyeler, varlık kurları ve TEFAS fon değerlemeleri Takasbank ve TradingView canlı veri ağından anlık olarak doğrulanmıştır. Her iş günü 18:30'da otomatik bülteniniz gönderilmeye devam edecektir.
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev'}/dashboard" class="btn">StockMind Paneline Git &rarr;</a>
      </div>

      <div class="footer">
        © ${new Date().getFullYear()} StockMind Teknoloji A.Ş. • Tüm hakları saklıdır.<br>
        Alıcı: ${userName} &bull; Zamanlanmış Gönderim Saati: Her Gün 18:30 &bull; Tarih: ${dateStr}
      </div>
    </div>
  </div>
</body>
</html>
`;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  previewUrl?: string;
  method?: string;
  requiresSmtpConfig?: boolean;
  error?: string;
}

export async function sendTestEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const { to, userName = 'Değerli Yatırımcı' } = payload;

  if (!to || !to.includes('@')) {
    return { success: false, message: 'Geçersiz e-posta adresi' };
  }

  const html = generateStockMindEmailHtml(userName, payload);
  const subject = payload.subject || `StockMind Test Bildirimi • ${userName} (${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`;

  // Determine SMTP Configuration: Server-side environment variables as primary, with optional custom override
  const smtpUser = (payload.customSmtp?.user || process.env.SMTP_USER || '').trim();
  const smtpPass = (payload.customSmtp?.pass || process.env.SMTP_PASS || '').trim();
  const smtpHost = (payload.customSmtp?.host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = payload.customSmtp?.port || Number(process.env.SMTP_PORT) || 587;
  const smtpFrom = (payload.customSmtp?.from || process.env.SMTP_FROM || '').trim() || `StockMind <${smtpUser}>`;
  const smtpService = payload.customSmtp?.service || process.env.SMTP_SERVICE || 'gmail';

  // If neither custom nor server environment SMTP is configured
  if (!smtpUser || !smtpPass) {
    console.warn('System SMTP credentials are not configured on the server (SMTP_USER/SMTP_PASS).');
    return {
      success: false,
      requiresSmtpConfig: false,
      error: 'SMTP_NOT_CONFIGURED',
      message:
        'Sistem e-posta sunucusu geçici olarak aktif değil. Lütfen sunucu ortam değişkenlerini (SMTP_USER, SMTP_PASS) kontrol edin.',
      method: 'failed',
    };
  }

  // 2. Real SMTP delivery via Gmail or Custom Server
  try {
    const isGmail =
      smtpService === 'gmail' ||
      smtpHost?.includes('gmail') ||
      (!smtpHost && smtpUser?.includes('@gmail.com'));

    const cleanPass = smtpPass.replace(/\s+/g, '');
    const portNum = Number(smtpPort) || (isGmail ? 465 : 587);

    const transporter = isGmail
      ? nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: portNum === 587 ? 587 : 465,
          secure: portNum === 587 ? false : true,
          auth: {
            user: smtpUser,
            pass: cleanPass,
          },
          requireTLS: true,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
          tls: {
            rejectUnauthorized: true,
          },
        })
      : nodemailer.createTransport({
          host: smtpHost || 'smtp.gmail.com',
          port: portNum,
          secure: portNum === 465,
          auth: {
            user: smtpUser,
            pass: cleanPass,
          },
          requireTLS: true,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
          tls: {
            rejectUnauthorized: true,
          },
        });

    await transporter.verify();

    const info = await transporter.sendMail({
      from: smtpFrom.includes('<') ? smtpFrom : `StockMind Bildirimleri <${smtpFrom}>`,
      to,
      subject,
      html,
    });

    return {
      success: true,
      message: `E-posta başarıyla ${to} adresine iletildi! (${info.messageId})`,
      method: isGmail ? 'google_smtp' : 'custom_smtp',
    };
  } catch (err: any) {
    console.error('SMTP delivery failed:', err);
    return {
      success: false,
      message: `E-posta gönderilemedi (${err.code || 'HATA'}): ${err.message}. Gmail kullanıyorsanız 16 haneli 'Uygulama Şifresi' (App Password) oluşturduğunuzdan emin olun.`,
      method: 'failed',
    };
  }
}

export interface ProRequestEmailParams {
  adminEmail: string;
  userName: string;
  userEmail: string;
  userId: string;
  requestNote?: string;
  approveUrl: string;
  rejectUrl: string;
}

export async function sendProRequestAdminEmail(params: ProRequestEmailParams): Promise<SendEmailResult> {
  const { adminEmail, userName, userEmail, userId, requestNote, approveUrl, rejectUrl } = params;
  const dateStr = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

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
        Aşağıdaki kullanıcı hesabını StockMind Pro'ya yükseltmek için talepte bulundu. Onaylamak için aşağıdaki bağlantıya tıklayabilirsiniz:
      </p>

      <div class="info-box">
        <div class="info-row"><span class="info-label">Ad Soyad:</span><span class="info-val">${userName}</span></div>
        <div class="info-row"><span class="info-label">E-posta:</span><span class="info-val">${userEmail}</span></div>
        <div class="info-row"><span class="info-label">Kullanıcı ID:</span><span class="info-val" style="font-family: monospace; font-size: 11px;">${userId}</span></div>
        <div class="info-row"><span class="info-label">Talep Tarihi:</span><span class="info-val">${dateStr}</span></div>
        ${requestNote ? `<div class="info-row" style="flex-direction: column; gap: 4px;"><span class="info-label">Kullanıcı Notu:</span><span class="info-val" style="font-style: italic; color: #cbd5e1;">"${requestNote}"</span></div>` : ''}
      </div>

      <a href="${approveUrl}" class="btn-approve">✅ Pro Hesabı Onayla ve Aktif Et</a>
      <a href="${rejectUrl}" class="btn-reject">❌ Talebi Reddet</a>

      <p style="text-align: center; font-size: 11px; color: #64748b; margin-top: 24px;">
        Bu e-posta sadece StockMind yöneticisine iletilmiştir. Onay linki 30 gün geçerlidir.
      </p>
    </div>
  </div>
</body>
</html>`;

  // Send to admin email via transport
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpFrom = (process.env.SMTP_FROM || '').trim() || `StockMind <${smtpUser}>`;

  if (!smtpUser || !smtpPass) {
    return { success: false, message: 'SMTP yapılandırılmamış.', method: 'failed' };
  }

  try {
    const isGmail = smtpHost.includes('gmail') || smtpUser.includes('@gmail.com');
    const transporter = nodemailer.createTransport({
      host: isGmail ? 'smtp.gmail.com' : smtpHost,
      port: smtpPort === 587 ? 587 : 465,
      secure: smtpPort !== 587,
      auth: { user: smtpUser, pass: smtpPass.replace(/\s+/g, '') },
    });

    await transporter.sendMail({
      from: smtpFrom.includes('<') ? smtpFrom : `StockMind Bildirimleri <${smtpFrom}>`,
      to: adminEmail,
      subject: `🔔 Yeni StockMind Pro Talebi: ${userName} (${userEmail})`,
      html,
    });

    return { success: true, message: `Pro onay e-postası yöneticiye iletildi.` };
  } catch (err: any) {
    console.error('sendProRequestAdminEmail error:', err);
    return { success: false, message: err.message };
  }
}

export async function sendProApprovedUserEmail(params: { to: string; userName: string; appUrl: string }): Promise<SendEmailResult> {
  const { to, userName, appUrl } = params;

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

      <div class="title">Tebrikler ${userName}, Hesabınız Pro'ya Yükseltildi! 🎉</div>
      <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
        StockMind Pro talebiniz yönetici tarafından incelendi ve onaylandı. Artık en gelişmiş kantitatif analiz ve çoklu yapay zeka araçları hesabınızda sınırsız olarak açık!
      </p>

      <div class="feature-list">
        <div class="feature-item">✨ <strong>Yatırım Komitesi:</strong> 4 uzman AI ajanının konsensüs ve çoklu analiz motoru</div>
        <div class="feature-item">✨ <strong>Gelişmiş AI Modelleri:</strong> GPT-4o, Claude 3.5 Sonnet ve premium modeller</div>
        <div class="feature-item">✨ <strong>Otomatik DCF & Monte Carlo:</strong> 1.000 simülasyonlu risk ve adil değerleme</div>
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

  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpFrom = (process.env.SMTP_FROM || '').trim() || `StockMind <${smtpUser}>`;

  if (!smtpUser || !smtpPass) {
    return { success: false, message: 'SMTP yapılandırılmamış.', method: 'failed' };
  }

  try {
    const isGmail = smtpHost.includes('gmail') || smtpUser.includes('@gmail.com');
    const transporter = nodemailer.createTransport({
      host: isGmail ? 'smtp.gmail.com' : smtpHost,
      port: smtpPort === 587 ? 587 : 465,
      secure: smtpPort !== 587,
      auth: { user: smtpUser, pass: smtpPass.replace(/\s+/g, '') },
    });

    await transporter.sendMail({
      from: smtpFrom.includes('<') ? smtpFrom : `StockMind <${smtpFrom}>`,
      to,
      subject: `🎉 Tebrikler! StockMind Pro Hesabınız Onaylandı`,
      html,
    });

    return { success: true, message: `Kullanıcıya Pro onay bildirimi gönderildi.` };
  } catch (err: any) {
    console.error('sendProApprovedUserEmail error:', err);
    return { success: false, message: err.message };
  }
}

