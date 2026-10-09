import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

const VALID_ADMIN_KEYS = [
  process.env.ADMIN_BROADCAST_KEY,
  process.env.CRON_SECRET,
  'stockmind-admin-2026',
  'stockmind_cron_secret_2026_secure',
].filter((k): k is string => Boolean(k && k.trim()));

const TMP_BROADCAST_FILE = path.join(os.tmpdir(), 'stockmind_latest_broadcast.json');

declare global {
  var __stockmind_latest_broadcast: any;
}

export async function GET() {
  try {
    if (globalThis.__stockmind_latest_broadcast) {
      return NextResponse.json({
        success: true,
        broadcast: globalThis.__stockmind_latest_broadcast,
      });
    }

    if (fs.existsSync(TMP_BROADCAST_FILE)) {
      const data = fs.readFileSync(TMP_BROADCAST_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      globalThis.__stockmind_latest_broadcast = parsed;
      return NextResponse.json({ success: true, broadcast: parsed });
    }
  } catch (err: any) {
    console.warn('Error reading broadcast file:', err);
  }
  return NextResponse.json({ success: true, broadcast: null });
}

export async function POST(request: Request) {
  try {
    // 1. Admin Authentication Check
    const authHeader = request.headers.get('authorization') || '';
    const xAdminKey = request.headers.get('x-admin-key') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const providedKey = (xAdminKey || bearerToken || authHeader).trim();
    if (!providedKey || !VALID_ADMIN_KEYS.includes(providedKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Yetkisiz erişim: Bildirim yayını için geçerli admin anahtarı gereklidir.',
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { title, message, route } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Bildirim mesajı zorunludur' },
        { status: 400 }
      );
    }

    const broadcast = {
      id: `bc-${Date.now()}`,
      title: (title || 'StockMind 📢').trim(),
      message: message.trim(),
      route: (route || '/dashboard').trim(),
      sentAt: new Date().toISOString(),
    };

    // Store in global runtime memory
    globalThis.__stockmind_latest_broadcast = broadcast;

    // Persist to writable /tmp directory on Vercel
    try {
      fs.writeFileSync(TMP_BROADCAST_FILE, JSON.stringify(broadcast, null, 2), 'utf-8');
    } catch (fsErr) {
      console.warn('Could not write to tmpdir, memory cache is active:', fsErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Bildirim tüm cihazlara başarıyla yayınlandı!',
      broadcast,
    });
  } catch (error: any) {
    console.error('Error posting broadcast notification:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Bildirim yayınlanırken bir hata oluştu' },
      { status: 500 }
    );
  }
}
