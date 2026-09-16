-- ═══════════════════════════════════════════
-- StockMind Database Schema - Migration 003
-- Multi-currency Support for Transactions
-- ═══════════════════════════════════════════

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL DEFAULT 1.0;

-- Optional index for currency queries
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON public.transactions(currency);
