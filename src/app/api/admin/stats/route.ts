import { NextResponse } from 'next/server';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiErrorResponse } from '@/lib/api/security';
import TEFAS_DIRECTORY from '@/lib/data/tefas_funds_directory.json';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireDesktopAdmin(request);
    const admin = createAdminClient();

    let fundsCount = 0;
    try {
      const fundsRes = await admin.from('funds').select('code', { count: 'exact', head: true });
      fundsCount = fundsRes.count || 0;
    } catch {
      fundsCount = 0;
    }

    const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: { users: [] }, error: null }));
    const users: any[] = usersResult.data?.users || [];
    const totalUsers = users.length;
    const proUsers = users.filter((u: any) => u.app_metadata?.plan === 'pro' || u.app_metadata?.is_pro === true).length;
    const pendingRequests = users.filter((u: any) => u.user_metadata?.pro_request_status === 'pending').length;

    const emailServiceMode = process.env.RESEND_API_KEY
      ? 'Resend REST API (Canlı/Aktif)'
      : process.env.SMTP_USER
      ? 'SMTP Nodemailer (Yedek)'
      : 'Yapılandırılmamış';

    return NextResponse.json(
      {
        success: true,
        stats: {
          totalUsers,
          proUsers,
          freeUsers: totalUsers - proUsers,
          pendingRequests,
          dbFundsCount: fundsCount,
          directoryFundsCount: (TEFAS_DIRECTORY as any[]).length,
          emailServiceMode,
          environment: process.env.NODE_ENV || 'production',
          systemTime: new Date().toISOString(),
          adminEmail: process.env.ADMIN_EMAIL || 'kaanrmak7@gmail.com',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
