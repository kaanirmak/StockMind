-- Telemetry table for tracking scheduled daily bulletin execution latency, duration, and missed runs (EPO-08)
CREATE TABLE IF NOT EXISTS public.bulletin_run_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_date DATE NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'daily_bulletin',
  scheduled_for TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  schedule_delay_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed', 'missed', 'no_recipients')),
  recipients_count INTEGER NOT NULL DEFAULT 0,
  successful_count INTEGER NOT NULL DEFAULT 0,
  trigger_source TEXT NOT NULL DEFAULT 'cron',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulletin_run_telemetry_date_started
  ON public.bulletin_run_telemetry (bulletin_date DESC, started_at DESC);

ALTER TABLE public.bulletin_run_telemetry ENABLE ROW LEVEL SECURITY;
