import { NextResponse, type NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // 1. In Node.js / local development environment, serve directly if fs is available
    if (typeof fs.existsSync === 'function') {
      let filePath = path.join(process.cwd(), 'public', 'StockMind.apk');
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), 'StockMind.apk');
      }

      if (fs.existsSync(filePath)) {
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
      }
    }
  } catch (_) {
    // Fall through to edge redirect
  }

  // 2. On Cloudflare Workers & Edge runtime: redirect directly to static CDN asset
  const targetUrl = new URL('/StockMind.apk', request.url);
  return NextResponse.redirect(targetUrl, 307);
}
