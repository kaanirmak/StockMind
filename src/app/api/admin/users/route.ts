import { NextResponse } from 'next/server';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, apiErrorResponse, readJsonObject } from '@/lib/api/security';
import { sendProApprovedUserEmail } from '@/lib/email/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireDesktopAdmin(request);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const perPage = Math.min(100, Math.max(10, Number(searchParams.get('perPage') || 50)));
    const query = (searchParams.get('query') || '').trim().toLowerCase();
    const filter = searchParams.get('filter') || 'all'; // 'all', 'pro', 'pending', 'banned'

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) throw error;

    let users = data.users.map((u) => {
      const isPro = Boolean(u.app_metadata?.plan === 'pro' || u.app_metadata?.is_pro === true);
      const isBanned = Boolean(u.banned_until && new Date(u.banned_until).getTime() > Date.now());
      const reqStatus = (u.user_metadata?.pro_request_status || 'none') as string;

      return {
        id: u.id,
        email: u.email || '',
        name: String(u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || ''),
        isPro,
        plan: isPro ? (u.app_metadata?.plan || 'pro') : 'free',
        role: (u.app_metadata?.role as string) || 'user',
        emailConfirmedAt: u.email_confirmed_at,
        lastSignInAt: u.last_sign_in_at,
        createdAt: u.created_at,
        proRequestStatus: reqStatus,
        proRequestedAt: u.user_metadata?.pro_requested_at,
        proRequestNote: u.user_metadata?.pro_request_note,
        isBanned,
        bannedUntil: u.banned_until,
      };
    });

    const totalUsersCount = users.length;
    const proUsersCount = users.filter((u) => u.isPro).length;
    const pendingRequestsCount = users.filter((u) => u.proRequestStatus === 'pending').length;

    // Apply text search
    if (query) {
      users = users.filter(
        (u) => u.email.toLowerCase().includes(query) || u.name.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filter === 'pro') {
      users = users.filter((u) => u.isPro);
    } else if (filter === 'pending') {
      users = users.filter((u) => u.proRequestStatus === 'pending');
    } else if (filter === 'banned') {
      users = users.filter((u) => u.isBanned);
    }

    // Pagination slice
    const totalFiltered = users.length;
    const startIdx = (page - 1) * perPage;
    const paginatedUsers = users.slice(startIdx, startIdx + perPage);

    return NextResponse.json(
      {
        success: true,
        users: paginatedUsers,
        pagination: {
          page,
          perPage,
          totalFiltered,
          totalPages: Math.ceil(totalFiltered / perPage),
          hasMore: startIdx + perPage < totalFiltered,
        },
        stats: {
          totalUsers: totalUsersCount,
          proUsers: proUsersCount,
          pendingRequests: pendingRequestsCount,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireDesktopAdmin(request);
    const body = await readJsonObject(request, 8 * 1024);

    const userId = String(body.userId || '').trim();
    const targetPlan = body.plan === 'pro' ? 'pro' : 'standard';
    const notifyUser = Boolean(body.notifyUser !== false);

    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      throw new ApiError(400, 'Geçersiz kullanıcı ID.');
    }

    const admin = createAdminClient();
    const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(userId);

    if (getUserError || !userData?.user) {
      throw new ApiError(404, 'Kullanıcı bulunamadı.');
    }

    const targetUser = userData.user;
    const isUpgrading = targetPlan === 'pro';

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...targetUser.app_metadata,
        plan: isUpgrading ? 'pro' : 'standard',
        is_pro: isUpgrading,
      },
      user_metadata: {
        ...targetUser.user_metadata,
        plan: isUpgrading ? 'pro' : 'standard',
        is_pro: isUpgrading,
        pro_request_status: isUpgrading ? 'approved' : 'none',
        pro_decided_at: new Date().toISOString(),
        pro_decided_by: actor.id,
      },
    });

    if (updateError) throw updateError;

    // Sync profiles table
    try {
      await admin
        .from('profiles')
        .update({ is_pro: isUpgrading, plan: isUpgrading ? 'pro' : 'standard' })
        .eq('id', userId);
    } catch {
      // profiles table is secondary
    }

    // Send email notification via Resend if upgrading
    if (isUpgrading && notifyUser && targetUser.email) {
      const targetName =
        targetUser.user_metadata?.full_name ||
        targetUser.user_metadata?.name ||
        targetUser.email.split('@')[0] ||
        'Değerli Yatırımcı';
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';

      sendProApprovedUserEmail({
        to: targetUser.email,
        userName: targetName,
        appUrl: baseUrl,
      }).catch((err) => console.warn('Could not dispatch approval email:', err));
    }

    return NextResponse.json({
      success: true,
      message: isUpgrading
        ? `${targetUser.email} kullanıcısına Pro yetkisi verildi.`
        : `${targetUser.email} kullanıcısının Pro yetkisi geri alındı.`,
      user: {
        id: userId,
        email: targetUser.email,
        isPro: isUpgrading,
        plan: targetPlan,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
