import { NextResponse } from 'next/server';
import { requireProAdmin } from '@/lib/pro/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, apiErrorResponse, readJsonObject } from '@/lib/api/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireProAdmin();
    const page = Number(new URL(request.url).searchParams.get('page') || 1);
    if (!Number.isSafeInteger(page) || page < 1) throw new ApiError(400, 'Geçersiz sayfa.');
    const { data, error } = await createAdminClient().auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    return NextResponse.json({
      success: true,
      requests: data.users.filter(user => user.user_metadata?.pro_request_status === 'pending').map(user => ({
        id: user.id, email: user.email,
        name: String(user.user_metadata?.full_name || user.user_metadata?.name || ''),
        note: String(user.user_metadata?.pro_request_note || ''),
        requestedAt: user.user_metadata?.pro_requested_at,
      })),
      page, hasMore: data.users.length === 100,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new ApiError(403, 'Geçersiz istek kaynağı.');
    const actor = await requireProAdmin();
    const body = await readJsonObject(request, 4096);
    if (typeof body.userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.userId) ||
        (body.action !== 'approve' && body.action !== 'reject')) throw new ApiError(400, 'Geçersiz karar.');
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(body.userId);
    if (error || !data.user) throw new ApiError(404, 'Kullanıcı bulunamadı.');
    const target = data.user;
    if (target.user_metadata?.pro_request_status !== 'pending') throw new ApiError(409, 'Bu talep artık beklemiyor. Listeyi yenileyin.');
    const approved = body.action === 'approve';
    const { error: updateError } = await admin.auth.admin.updateUserById(target.id, {
      ...(approved ? { app_metadata: { ...target.app_metadata, plan: 'pro', is_pro: true } } : {}),
      user_metadata: {
        ...target.user_metadata,
        pro_request_status: approved ? 'approved' : 'rejected',
        pro_decided_at: new Date().toISOString(),
        pro_decided_by: actor.id,
      },
    });
    if (updateError) throw updateError;

    // Sync profiles table if present
    try {
      await admin.from('profiles').update({ is_pro: approved, plan: approved ? 'pro' : 'standard' }).eq('id', target.id);
    } catch {
      // profiles table is secondary
    }

    // If approved, send celebratory email to user
    if (approved && target.email) {
      const targetName =
        target.user_metadata?.full_name ||
        target.user_metadata?.name ||
        target.email.split('@')[0] ||
        'Değerli Yatırımcı';
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
      import('@/lib/email/service')
        .then((m) =>
          m.sendProApprovedUserEmail({
            to: target.email!,
            userName: targetName,
            appUrl: baseUrl,
          })
        )
        .catch((emailErr) => console.warn('Could not send pro approval user email:', emailErr));
    }

    return NextResponse.json({ success: true, message: approved ? 'Pro hesabı aktif edildi.' : 'Talep reddedildi.' });
  } catch (error) { return apiErrorResponse(error); }
}
