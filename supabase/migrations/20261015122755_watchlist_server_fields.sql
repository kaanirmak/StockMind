-- Keep watchlist metadata and alert configuration on the server so devices share one source of truth.
ALTER TABLE public.watchlist_items
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS target_price DECIMAL,
  ADD COLUMN IF NOT EXISTS alert_type TEXT,
  ADD COLUMN IF NOT EXISTS alert_percent DECIMAL,
  ADD COLUMN IF NOT EXISTS alert_base_price DECIMAL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_watchlist_items_symbol ON public.watchlist_items(symbol);
