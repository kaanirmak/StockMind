-- ═══════════════════════════════════════════
-- StockMind Database Schema - Migration 002
-- TEFAS Funds & Daily History Tables
-- ═══════════════════════════════════════════

-- 1. FUNDS TABLE (Current snapshot of all TEFAS mutual funds)
CREATE TABLE IF NOT EXISTS public.funds (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  founder TEXT NOT NULL,
  price DECIMAL NOT NULL DEFAULT 0,
  daily_return DECIMAL NOT NULL DEFAULT 0,
  monthly_return DECIMAL DEFAULT 0,
  return_3m DECIMAL DEFAULT 0,
  return_6m DECIMAL DEFAULT 0,
  ytd_return DECIMAL DEFAULT 0,
  yearly_return DECIMAL DEFAULT 0,
  return_3y DECIMAL DEFAULT 0,
  return_5y DECIMAL DEFAULT 0,
  risk_value INTEGER NOT NULL DEFAULT 1 CHECK (risk_value BETWEEN 1 AND 7),
  total_value DECIMAL NOT NULL DEFAULT 0, -- AUM / Portföy Büyüklüğü (TRY)
  investor_count INTEGER NOT NULL DEFAULT 0,
  management_fee DECIMAL DEFAULT 0, -- Yıllık Yönetim Ücreti %
  asset_allocation JSONB DEFAULT '[]'::jsonb, -- Portföy Varlık Dağılımı [{category, percentage}]
  kap_link TEXT,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes for search, filtering, and sorting
CREATE INDEX IF NOT EXISTS idx_funds_category ON public.funds(category);
CREATE INDEX IF NOT EXISTS idx_funds_daily_return ON public.funds(daily_return DESC);
CREATE INDEX IF NOT EXISTS idx_funds_yearly_return ON public.funds(yearly_return DESC);
CREATE INDEX IF NOT EXISTS idx_funds_total_value ON public.funds(total_value DESC);
CREATE INDEX IF NOT EXISTS idx_funds_risk_value ON public.funds(risk_value);

-- Row Level Security for funds table
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;

-- Anyone can read funds data
CREATE POLICY "Public can view funds"
  ON public.funds FOR SELECT
  USING (true);

-- Only authenticated admins or service role can insert/update/delete funds
CREATE POLICY "Service role can manage funds"
  ON public.funds FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NOT NULL);

-- Auto-update updated_at trigger
CREATE TRIGGER funds_updated_at
  BEFORE UPDATE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- 2. FUND DAILY HISTORY TABLE (Daily NAV / Price Series Archive)
CREATE TABLE IF NOT EXISTS public.fund_daily_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_code TEXT NOT NULL REFERENCES public.funds(code) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  price DECIMAL NOT NULL,
  daily_return DECIMAL,
  total_value DECIMAL,
  investor_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fund_code, price_date)
);

-- Performance Indexes for historical queries & charts
CREATE INDEX IF NOT EXISTS idx_fund_history_lookup ON public.fund_daily_history(fund_code, price_date DESC);
CREATE INDEX IF NOT EXISTS idx_fund_history_date ON public.fund_daily_history(price_date DESC);

-- Row Level Security for fund daily history table
ALTER TABLE public.fund_daily_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read history
CREATE POLICY "Public can view fund history"
  ON public.fund_daily_history FOR SELECT
  USING (true);

-- Service role / admin can manage history
CREATE POLICY "Service role can manage fund history"
  ON public.fund_daily_history FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NOT NULL);
