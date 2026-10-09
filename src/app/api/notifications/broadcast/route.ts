import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BROADCAST_FILE = path.join(process.cwd(), 'public', 'latest_broadcast.json');

export async function GET() {
  try {
    if (fs.existsSync(BROADCAST_FILE)) {
      const data = fs.readFileSync(BROADCAST_FILE, 'utf-8');
      return NextResponse.json({ success: true, broadcast: JSON.parse(data) });
    }
  } catch (err: any) {
    console.warn('Error reading broadcast file:', err);
  }
  return NextResponse.json({ success: true, broadcast: null });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    // Ensure directory exists and write
    const dir = path.dirname(BROADCAST_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(BROADCAST_FILE, JSON.stringify(broadcast, null, 2), 'utf-8');

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
