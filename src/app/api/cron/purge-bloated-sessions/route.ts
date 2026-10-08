import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/cron/purge-bloated-sessions
 *
 * Server-side endpoint that uses the Supabase Admin API to:
 *   1. List ALL users
 *   2. Find users whose user_metadata contains bloated avatar_url / picture
 *      (base64 data URLs or strings > 500 chars)
 *   3. Strip the bloated fields from user_metadata
 *
 * This makes the JWT smaller on next token refresh, which prevents
 * Vercel 494 REQUEST_HEADER_TOO_LARGE errors caused by oversized
 * Supabase auth cookies.
 *
 * Secured by CRON_SECRET.
 *
 * Usage:
 *   curl -X POST "https://your-domain.vercel.app/api/cron/purge-bloated-sessions" \
 *        -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: Request) {
  // ── Auth guard ──────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized: CRON_SECRET is required' }, { status: 401 });
  }

  // ── Admin client ────────────────────────────────────────────────────
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Iterate all users and purge bloated metadata ────────────────────
  let page = 1;
  const perPage = 100;
  let totalScanned = 0;
  let totalCleaned = 0;
  const cleanedUserIds: string[] = [];

  try {
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error('[purge-bloated-sessions] listUsers error:', error);
        break;
      }

      const users = data?.users ?? [];
      if (users.length === 0) break;

      for (const user of users) {
        totalScanned++;
        const meta = user.user_metadata ?? {};
        const avatar = meta.avatar_url;
        const picture = meta.picture;

        const avatarBloated =
          avatar &&
          (avatar.startsWith('data:') || avatar.length > 500);
        const pictureBloated =
          picture &&
          (picture.startsWith('data:') || picture.length > 500);

        if (avatarBloated || pictureBloated) {
          // Keep only safe URLs (not base64, < 500 chars), otherwise null
          const safeAvatar =
            avatar && !avatar.startsWith('data:') && avatar.length < 500
              ? avatar
              : null;
          const safePicture =
            picture && !picture.startsWith('data:') && picture.length < 500
              ? picture
              : null;

          const { error: updateError } =
            await supabase.auth.admin.updateUserById(user.id, {
              user_metadata: {
                ...meta,
                avatar_url: safeAvatar ?? safePicture,
                picture: safePicture,
              },
            });

          if (updateError) {
            console.warn(
              `[purge-bloated-sessions] Failed to clean user ${user.id}:`,
              updateError
            );
          } else {
            totalCleaned++;
            cleanedUserIds.push(user.id);
            console.log(
              `[purge-bloated-sessions] Cleaned user ${user.id} (avatar: ${avatar?.length ?? 0} chars)`
            );
          }
        }
      }

      // If we got fewer than perPage, we've reached the end
      if (users.length < perPage) break;
      page++;
    }

    const result = {
      success: true,
      totalScanned,
      totalCleaned,
      cleanedUserIds,
      message:
        totalCleaned > 0
          ? `Purged bloated metadata from ${totalCleaned} user(s). Their next token refresh will produce smaller JWTs.`
          : 'No bloated user metadata found. All users are clean.',
    };

    console.log('[purge-bloated-sessions] Result:', result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[purge-bloated-sessions] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel Cron
export async function GET(request: Request) {
  return POST(request);
}
