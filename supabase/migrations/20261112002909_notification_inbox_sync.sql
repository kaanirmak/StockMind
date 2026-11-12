BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notification_states (
  user_id UUID PRIMARY KEY,
  inbox_items JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(inbox_items) = 'array'),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preferences) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_notification_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_notification_states FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.user_notification_states TO authenticated;
GRANT ALL ON public.user_notification_states TO service_role;

CREATE POLICY "Users can read own notification state"
  ON public.user_notification_states
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification state"
  ON public.user_notification_states
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification state"
  ON public.user_notification_states
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages user notification states"
  ON public.user_notification_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
