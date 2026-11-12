CREATE TABLE public.application_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK (level IN (info, warn, error)),
  area text NOT NULL CHECK (area IN (email, bulletin, admin, api)),
  event text NOT NULL CHECK (length(event) BETWEEN 1 AND 80),
  message text NOT NULL CHECK (length(message) <= 500),
  request_id uuid,
  context jsonb NOT NULL DEFAULT {}::jsonb CHECK (octet_length(context::text) <= 32768)
);
CREATE INDEX application_logs_filters ON public.application_logs (area, level, id DESC);
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.application_logs_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.application_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.application_logs_id_seq TO service_role;
