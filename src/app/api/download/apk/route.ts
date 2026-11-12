import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ANDROID_RELEASE_METADATA } from '@/lib/app/releaseMetadata';

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
        const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': `attachment; filename="${ANDROID_RELEASE_METADATA.apkFilename}"`,
            'Content-Length': stat.size.toString(),
            'Cache-Control': 'public, max-age=3600',
            'ETag': `"${sha256}"`,
            'X-StockMind-Version': ANDROID_RELEASE_METADATA.version,
            'X-StockMind-VersionCode': String(ANDROID_RELEASE_METADATA.versionCode),
            'X-StockMind-SHA256': sha256,
          },
        });
      }
    }
  } catch (_) {
    // Fall through to edge redirect
  }

  // 2. On Cloudflare Workers & Edge runtime: redirect directly to static CDN asset
  const targetUrl = new URL('/StockMind.apk', request.url);
  targetUrl.searchParams.set('release', String(ANDROID_RELEASE_METADATA.versionCode));
  return NextResponse.redirect(targetUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
