-- ═══════════════════════════════════════════════════════════════════════
-- StockMind Database Schema - Migration 004
-- Fix Row Level Security (RLS) for TEFAS Funds & Fund Daily History
-- ═══════════════════════════════════════════════════════════════════════

-- 1. FIX FUNDS TABLE RLS
ALTER TABLE IF EXISTS public.funds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view funds" ON public.funds;
DROP POLICY IF EXISTS "Public can manage funds" ON public.funds;
DROP POLICY IF EXISTS "Service role can manage funds" ON public.funds;

-- Allow public read access
CREATE POLICY "Public can view funds"
  ON public.funds FOR SELECT
  USING (true);

-- Allow server sync / anonymous cache / authenticated users to upsert fund market data
CREATE POLICY "Public and service can upsert funds"
  ON public.funds FOR ALL
  USING (true)
  WITH CHECK (true);


-- 2. FIX FUND DAILY HISTORY TABLE RLS
ALTER TABLE IF EXISTS public.fund_daily_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view fund history" ON public.fund_daily_history;
DROP POLICY IF EXISTS "Public can manage fund history" ON public.fund_daily_history;
DROP POLICY IF EXISTS "Service role can manage fund history" ON public.fund_daily_history;

-- Allow public read access
CREATE POLICY "Public can view fund history"
  ON public.fund_daily_history FOR SELECT
  USING (true);

-- Allow server sync / anonymous cache / authenticated users to upsert historical fund prices
CREATE POLICY "Public and service can upsert fund history"
  ON public.fund_daily_history FOR ALL
  USING (true)
  WITH CHECK (true);
