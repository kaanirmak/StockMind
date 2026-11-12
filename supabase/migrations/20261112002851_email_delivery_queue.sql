BEGIN;

CREATE TABLE IF NOT EXISTS public.email_delivery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_date date NOT NULL,
  job_type text NOT NULL DEFAULT 'daily_bulletin',
  recipient_email text NOT NULL,
  recipient_name text,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'failed', 'retry_scheduled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  next_retry_at timestamptz,
  sender_email text,
  transport_method text,
  provider_message_id text,
  last_error text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT email_delivery_queue_unique_day_recipient UNIQUE (bulletin_date, job_type, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_queue_date_status
  ON public.email_delivery_queue (bulletin_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_email_delivery_queue_status_retry
  ON public.email_delivery_queue (status, next_retry_at);

ALTER TABLE public.email_delivery_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_delivery_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_delivery_queue TO service_role;

CREATE POLICY "Service role manages email delivery queue"
  ON public.email_delivery_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
