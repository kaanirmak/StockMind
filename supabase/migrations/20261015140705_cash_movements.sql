CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('deposit', 'withdrawal')),
  amount numeric NOT NULL CHECK (amount > 0 AND amount < 1000000000000),
  currency text NOT NULL CHECK (currency IN ('TRY', 'USD', 'EUR')),
  exchange_rate numeric NOT NULL CHECK (exchange_rate > 0 AND exchange_rate < 1000000 AND (currency <> 'TRY' OR exchange_rate = 1)),
  movement_date date NOT NULL,
  notes text CHECK (length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cash_movements_owner_portfolio_idx ON public.cash_movements(user_id, portfolio_id, movement_date);
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages cash movements" ON public.cash_movements FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id AND EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = (select auth.uid())))
  WITH CHECK ((select auth.uid()) = user_id AND EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = (select auth.uid())));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
REVOKE ALL ON public.cash_movements FROM anon;
