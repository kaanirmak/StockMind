import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeInboxItems, safeInboxLink, type InboxItem } from '@/lib/notifications/inbox';
import {
  mergeAccountInboxItems,
  sanitizePushPreferences,
} from '@/lib/notifications/inboxSync';

export const dynamic = 'force-dynamic';

interface AlertEventRow {
  id: string;
  title: string;
  message: string;
  link: string;
  triggered_at: string;
  read_at: string | null;
  archived_at: string | null;
}

function mapAlertRowToInboxItem(row: AlertEventRow): InboxItem {
  const triggeredMs = Date.parse(row.triggered_at);
  return {
    id: `alert-${row.id}`,
    title: row.title,
    description: row.message,
    time: Number.isFinite(triggeredMs)
      ? new Date(triggeredMs).toLocaleString('tr-TR')
      : row.triggered_at,
    read: Boolean(row.read_at),
    ...(row.archived_at ? { archived: true } : {}),
    category: 'market',
    ...(safeInboxLink(row.link) ? { link: safeInboxLink(row.link) } : {}),
    updatedAt: row.triggered_at,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [{ data: stateRow, error: stateError }, { data: alertRows }] = await Promise.all([
    supabase
      .from('user_notification_states')
      .select('inbox_items, preferences, updated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('alert_trigger_events')
      .select('id, title, message, link, triggered_at, read_at, archived_at')
      .eq('user_id', user.id)
      .order('triggered_at', { ascending: false })
      .limit(40),
  ]);

  if (stateError) {
    return NextResponse.json(
      { error: 'Bildirim durumu yüklenemedi.' },
      { status: 500 },
    );
  }

  const stateUpdatedAtMs = stateRow?.updated_at ? Date.parse(String(stateRow.updated_at)) : 0;
  const savedInbox = sanitizeInboxItems(stateRow?.inbox_items ?? []);

  // Only fold in server-triggered alert events that occurred after the user's last saved inbox snapshot
  // so explicitly deleted notifications stay deleted across devices.
  const freshAlertItems = Array.isArray(alertRows)
    ? (alertRows as AlertEventRow[])
        .filter((row) => {
          if (row.archived_at) return false;
          const triggeredMs = Date.parse(row.triggered_at);
          return !Number.isFinite(stateUpdatedAtMs) || stateUpdatedAtMs <= 0 || triggeredMs >= stateUpdatedAtMs;
        })
        .map(mapAlertRowToInboxItem)
    : [];

  const mergedInbox = mergeAccountInboxItems(savedInbox, freshAlertItems);
  const preferences = stateRow?.preferences
    ? sanitizePushPreferences(stateRow.preferences)
    : undefined;

  return NextResponse.json({
    inbox: mergedInbox,
    ...(preferences ? { preferences } : {}),
    updatedAt: stateRow?.updated_at ?? null,
  });
}

export async function PUT(request: NextRequest) {
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

  const { data: existingRow } = await supabase
    .from('user_notification_states')
    .select('inbox_items, preferences')
    .eq('user_id', user.id)
    .maybeSingle();

  const existingInbox = sanitizeInboxItems(existingRow?.inbox_items ?? []);
  const hasInbox = Array.isArray((body as { inbox?: unknown }).inbox);
  const nextInbox = hasInbox
    ? sanitizeInboxItems((body as { inbox: unknown }).inbox)
    : existingInbox;

  const existingPrefs = existingRow?.preferences
    ? sanitizePushPreferences(existingRow.preferences)
    : undefined;
  const hasPrefs =
    Boolean((body as { preferences?: unknown }).preferences) &&
    typeof (body as { preferences?: unknown }).preferences === 'object';
  const nextPrefs = hasPrefs
    ? sanitizePushPreferences((body as { preferences: unknown }).preferences, existingPrefs)
    : existingPrefs;

  const updatedAt = new Date().toISOString();

  const { error } = await supabase.from('user_notification_states').upsert(
    {
      user_id: user.id,
      inbox_items: nextInbox,
      preferences: nextPrefs ?? {},
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    return NextResponse.json(
      { error: 'Bildirim durumu kaydedilemedi.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    inbox: nextInbox,
    ...(nextPrefs ? { preferences: nextPrefs } : {}),
    updatedAt,
  });
}
