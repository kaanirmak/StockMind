import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    let filePath = path.join(process.cwd(), 'public', 'StockMind.apk');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'StockMind.apk');
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, message: 'APK dosyası bulunamadı.' },
        { status: 404 }
      );
    }

    const stat = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="StockMind.apk"',
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('APK indirme hatası:', error);
    return NextResponse.json(
      { success: false, message: 'İndirme işlemi sırasında bir hata oluştu.' },
      { status: 500 }
    );
  }
}
