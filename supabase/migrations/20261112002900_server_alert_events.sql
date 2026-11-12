BEGIN;

ALTER TABLE public.watchlist_items
  ADD COLUMN IF NOT EXISTS alert_currency TEXT,
  ADD COLUMN IF NOT EXISTS alert_direction TEXT,
  ADD COLUMN IF NOT EXISTS alert_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_observed_price DECIMAL,
  ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_triggered_price DECIMAL;

CREATE TABLE IF NOT EXISTS public.alert_trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  watchlist_item_id UUID,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'fund')),
  alert_type TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  observed_price DECIMAL NOT NULL,
  target_price DECIMAL,
  base_price DECIMAL,
  alert_percent DECIMAL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_trigger_events_user_time
  ON public.alert_trigger_events (user_id, triggered_at DESC);

ALTER TABLE public.alert_trigger_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.alert_trigger_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.alert_trigger_events TO authenticated;
GRANT ALL ON public.alert_trigger_events TO service_role;

CREATE POLICY "Users can read own alert trigger events"
  ON public.alert_trigger_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alert trigger events"
  ON public.alert_trigger_events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages alert trigger events"
  ON public.alert_trigger_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
