BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_key TEXT NOT NULL,
  device_label TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'web', 'pwa')),
  channel TEXT NOT NULL CHECK (channel IN ('android', 'web', 'inbox')),
  permission_state TEXT NOT NULL CHECK (permission_state IN ('granted', 'denied', 'default', 'unsupported')),
  push_token TEXT,
  channels JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'invalid', 'stale')),
  invalid_reason TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_seen
  ON public.notification_devices (user_id, last_seen_at DESC);

ALTER TABLE public.notification_devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notification_devices FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_devices TO authenticated;
GRANT ALL ON public.notification_devices TO service_role;

CREATE POLICY "Users can read own notification devices"
  ON public.notification_devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification devices"
  ON public.notification_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification devices"
  ON public.notification_devices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification devices"
  ON public.notification_devices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages notification devices"
  ON public.notification_devices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
