-- 008_transactions_rls.sql
-- Harden transactions Row Level Security (RLS) to enforce BOTH user ownership AND portfolio ownership.
-- Prevents authenticated users from attaching transactions to another user's portfolio.

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = transactions.portfolio_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own transactions" ON public.transactions;
CREATE POLICY "Users can create own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = transactions.portfolio_id
      AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = transactions.portfolio_id
      AND p.user_id = auth.uid()
    )
  );
