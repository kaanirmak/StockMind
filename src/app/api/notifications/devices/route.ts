import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isInvalidPushErrorCode,
  normalizeDeviceChannel,
  normalizeDeviceChannels,
  normalizeDevicePlatform,
  normalizePermissionState,
  partitionAndPruneDevices,
  type NotificationDeviceRecord,
} from '@/lib/notifications/devices';

export const dynamic = 'force-dynamic';

interface DeviceRow {
  id: string;
  user_id: string;
  device_key: string;
  device_label: string;
  platform: string;
  channel: string;
  permission_state: string;
  push_token: string | null;
  channels: unknown;
  status: string;
  invalid_reason: string | null;
  last_seen_at: string;
  last_error_at: string | null;
}

function mapRowToRecord(row: DeviceRow): NotificationDeviceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    deviceKey: row.device_key,
    deviceLabel: row.device_label,
    platform: normalizeDevicePlatform(row.platform),
    channel: normalizeDeviceChannel(row.channel),
    permissionState: normalizePermissionState(row.permission_state),
    pushToken: row.push_token,
    channels: normalizeDeviceChannels(row.channels),
    status:
      row.status === 'invalid' || row.status === 'revoked' || row.status === 'stale'
        ? row.status
        : 'active',
    invalidReason: row.invalid_reason,
    lastSeenAt: row.last_seen_at,
    lastErrorAt: row.last_error_at,
  };
}

async function listAndPruneUserDevices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from('notification_devices')
    .select(
      'id, user_id, device_key, device_label, platform, channel, permission_state, push_token, channels, status, invalid_reason, last_seen_at, last_error_at',
    )
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });

  if (error) {
    return { error, devices: [] as NotificationDeviceRecord[], prunedCount: 0 };
  }

  const mapped = Array.isArray(data) ? (data as DeviceRow[]).map(mapRowToRecord) : [];
  const { activeDevices, prunedDevices } = partitionAndPruneDevices(mapped);

  if (prunedDevices.length > 0) {
    const pruneIds = prunedDevices.map((d) => d.id).filter(Boolean);
    if (pruneIds.length > 0) {
      await supabase
        .from('notification_devices')
        .delete()
        .eq('user_id', userId)
        .in('id', pruneIds);
    }
  }

  return { error: null, devices: activeDevices, prunedCount: prunedDevices.length };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await listAndPruneUserDevices(supabase, user.id);
  if (result.error) {
    return NextResponse.json(
      { error: 'Bağlı cihazlar yüklenemedi.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    devices: result.devices,
    prunedCount: result.prunedCount,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const deviceKey = typeof raw.deviceKey === 'string' ? raw.deviceKey.trim().slice(0, 128) : '';
  const deviceLabel =
    typeof raw.deviceLabel === 'string' && raw.deviceLabel.trim()
      ? raw.deviceLabel.trim().slice(0, 120)
      : 'Web Oturumu';

  if (!deviceKey) {
    return NextResponse.json({ error: 'deviceKey is required' }, { status: 400 });
  }

  const failureReason =
    typeof raw.invalidReason === 'string'
      ? raw.invalidReason.trim().slice(0, 160)
      : typeof raw.deliveryError === 'string'
        ? raw.deliveryError.trim().slice(0, 160)
        : null;

  // If the client reports an invalid/revoked push registration (e.g. HTTP 410 / NotRegistered), prune immediately.
  if (failureReason && isInvalidPushErrorCode(failureReason)) {
    await supabase
      .from('notification_devices')
      .delete()
      .eq('user_id', user.id)
      .eq('device_key', deviceKey);

    const refreshed = await listAndPruneUserDevices(supabase, user.id);
    return NextResponse.json({
      devices: refreshed.devices,
      prunedCount: refreshed.prunedCount + 1,
      prunedCurrentDevice: true,
    });
  }

  const platform = normalizeDevicePlatform(raw.platform);
  const channel = normalizeDeviceChannel(raw.channel);
  const permissionState = normalizePermissionState(raw.permissionState);
  const channels = normalizeDeviceChannels(raw.channels);
  const pushToken =
    typeof raw.pushToken === 'string' && raw.pushToken.trim()
      ? raw.pushToken.trim().slice(0, 512)
      : null;

  const { error: upsertError } = await supabase
    .from('notification_devices')
    .upsert(
      {
        user_id: user.id,
        device_key: deviceKey,
        device_label: deviceLabel,
        platform,
        channel,
        permission_state: permissionState,
        push_token: pushToken,
        channels,
        status: 'active',
        invalid_reason: null,
        last_seen_at: new Date().toISOString(),
        last_error_at: null,
      },
      { onConflict: 'user_id,device_key' },
    );

  if (upsertError) {
    return NextResponse.json(
      { error: 'Cihaz kaydı güncellenemedi.' },
      { status: 500 },
    );
  }

  const refreshed = await listAndPruneUserDevices(supabase, user.id);
  if (refreshed.error) {
    return NextResponse.json(
      { error: 'Bağlı cihazlar yüklenemedi.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    devices: refreshed.devices,
    prunedCount: refreshed.prunedCount,
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id')?.trim();
  const deviceKey = request.nextUrl.searchParams.get('deviceKey')?.trim();
  if (!id && !deviceKey) {
    return NextResponse.json({ error: 'id or deviceKey required' }, { status: 400 });
  }

  let query = supabase.from('notification_devices').delete().eq('user_id', user.id);
  query = id ? query.eq('id', id) : query.eq('device_key', deviceKey as string);
  const { error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Cihaz kaydı silinemedi.' },
      { status: 500 },
    );
  }

  const refreshed = await listAndPruneUserDevices(supabase, user.id);
  return NextResponse.json({
    ok: true,
    devices: refreshed.devices,
    prunedCount: refreshed.prunedCount,
  });
}
