-- Broadcasts are application messages, not TEFAS funds.
BEGIN;
CREATE TABLE public.broadcasts (
  id text PRIMARY KEY CHECK (id = 'latest'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object')
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.broadcasts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.broadcasts TO anon, authenticated;
GRANT ALL ON public.broadcasts TO service_role;
CREATE POLICY "Public can read broadcasts" ON public.broadcasts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role can write broadcasts" ON public.broadcasts FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Deliberately do not promote legacy messages accepted via the old fixed keys.
COMMIT;
