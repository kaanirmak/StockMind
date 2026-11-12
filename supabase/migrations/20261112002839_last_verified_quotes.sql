CREATE TABLE IF NOT EXISTS public.market_quote_cache (
  symbol TEXT PRIMARY KEY,
  quote JSONB NOT NULL,
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.market_quote_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market quote cache is readable by everyone"
  ON public.market_quote_cache FOR SELECT
  USING (true);
