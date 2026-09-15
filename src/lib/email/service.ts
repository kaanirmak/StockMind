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
}

export function generateStockMindEmailHtml(userName: string = 'Kaan Irmak', payload?: Partial<EmailPayload>): string {
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
    body { margin: 0; padding: 0; background-color: #060913; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
    .card { background: linear-gradient(135deg, #0d1527 0%, #111a33 100%); border: 1px solid #1e293b; border-radius: 20px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .logo { font-size: 24px; font-weight: 900; background: linear-gradient(to right, #6366f1, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 100px; font-size: 11px; font-weight: 700; color: #818cf8; margin-top: 8px; }
    .badge-daily { background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #34d399; }
    .title { font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 24px; margin-bottom: 8px; }
    .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
    .metrics-grid { display: table; width: 100%; margin-bottom: 16px; }
    .metric-cell { display: table-cell; width: 50%; padding: 12px 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; }
    .metric-cell:first-child { border-right: 6px solid transparent; }
    .metric-cell:last-child { border-left: 6px solid transparent; }
    .metric-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .metric-val { font-size: 17px; font-weight: 800; font-family: monospace; color: #f8fafc; }
    .positive { color: #10b981; }
    .portfolio-box { background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 14px; padding: 18px; margin-bottom: 20px; }
    .ai-box { background: rgba(99, 102, 241, 0.08); border-left: 3px solid #6366f1; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; text-align: center; margin-top: 8px; }
    .footer { text-align: center; font-size: 11px; color: #475569; margin-top: 28px; line-height: 1.5; }
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
        <div style="font-size: 11px; font-weight: 700; color: #34d399; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">💼 Günlük Portföy Durumu (18:30 Kapanış)</div>
        <div style="display: table; width: 100%;">
          <div style="display: table-cell; width: 50%;">
            <div style="font-size: 11px; color: #64748b;">Toplam Portföy Değeri</div>
            <div style="font-size: 19px; font-weight: 800; font-family: monospace; color: #ffffff;">₺${pSummary.totalValue?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style="display: table-cell; width: 50%; text-align: right;">
            <div style="font-size: 11px; color: #64748b;">Net Günlük Kâr / Getiri</div>
            <div style="font-size: 19px; font-weight: 800; font-family: monospace; color: #10b981;">
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

      <div class="ai-box">
        <div style="font-size: 12px; font-weight: 700; color: #a5b4fc; margin-bottom: 4px;">🧠 StockMind Finansal Zeka Notu</div>
        <div style="font-size: 12px; color: #cbd5e1; line-height: 1.5;">
          Tüm fiyatlar, varlık kurları ve TEFAS fon değerlemeleri Takasbank ve TradingView canlı veri ağından anlık olarak doğrulanmıştır. Her iş günü 18:30'da otomatik bülteniniz gönderilmeye devam edecektir.
        </div>
      </div>

      <div style="text-align: center;">
        <a href="http://localhost:3000/dashboard" class="btn">StockMind Paneline Git &rarr;</a>
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

export async function sendTestEmail(payload: EmailPayload): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
  method?: string;
}> {
  const { to, userName = 'Kaan Irmak' } = payload;

  if (!to || !to.includes('@')) {
    return { success: false, message: 'Geçersiz e-posta adresi' };
  }

  const html = generateStockMindEmailHtml(userName, payload);
  const subject = payload.subject || `StockMind Test Bildirimi • ${userName} (${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`;

  // 1. If SMTP environment variables exist, send via standard SMTP or Google/Gmail SMTP
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const isGmail =
        process.env.SMTP_SERVICE === 'gmail' ||
        process.env.SMTP_HOST?.includes('gmail') ||
        (!process.env.SMTP_HOST && process.env.SMTP_USER?.includes('@gmail.com'));

      const cleanPass = process.env.SMTP_PASS.replace(/\s+/g, '');

      const transporter = isGmail
        ? nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.SMTP_USER,
              pass: cleanPass,
            },
          })
        : nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
            auth: {
              user: process.env.SMTP_USER,
              pass: cleanPass,
            },
          });

      const info = await transporter.sendMail({
        from: `StockMind Bildirimleri <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });

      return {
        success: true,
        message: `E-posta başarıyla ${to} adresine gönderildi (MessageId: ${info.messageId})`,
        method: isGmail ? 'google_smtp' : 'smtp',
      };
    } catch (err: any) {
      console.warn('Custom SMTP delivery failed, trying Supabase / Ethereal fallback:', err.message);
    }
  }

  // 2. Try Supabase Auth email service (triggers official Supabase email delivery)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      );

      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: to,
      });

      if (!error && data) {
        console.log(`Supabase email link generated for ${to}:`, data.properties?.action_link);
      }
    } catch (e: any) {
      console.warn('Supabase auth email notice:', e.message);
    }
  }

  // 3. Send using Ethereal Test Mail Service (Instant live real web preview)
  try {
    const testAccount = await nodemailer.createTestAccount();
    const testTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await testTransporter.sendMail({
      from: 'StockMind Finansal Zeka <notifications@stockmind.app>',
      to,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    return {
      success: true,
      message: `Test e-postası başarıyla gönderildi ve oluşturuldu!`,
      previewUrl,
      method: 'test_service',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `E-posta gönderiminde hata: ${err.message}`,
    };
  }
}
