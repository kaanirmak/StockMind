\set ON_ERROR_STOP on
-- Run ONLY in a freshly created disposable database named stockmind_security_test.
DO $$ BEGIN
  IF current_database() <> 'stockmind_security_test' OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    RAISE EXCEPTION 'This test requires a fresh disposable stockmind_security_test database';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_app_meta_data jsonb NOT NULL DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE IF NOT EXISTS public.portfolios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id));
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own portfolios" ON public.portfolios;
CREATE POLICY "Users can manage own portfolios" ON public.portfolios FOR ALL USING (auth.uid() = user_id);
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  symbol text NOT NULL
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios, public.transactions TO authenticated;
\ir ../supabase/migrations/006_api_quotas.sql
\ir ../supabase/migrations/007_broadcasts.sql
\ir ../supabase/migrations/008_transactions_rls.sql
\ir ../supabase/migrations/20261019165130_durable_ai_hourly_quota.sql

BEGIN;
INSERT INTO auth.users (id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.profiles VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.consume_api_quota('ai_chat');
    RAISE EXCEPTION 'Anonymous RPC access unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.broadcasts VALUES ('latest', '{}'::jsonb);
    RAISE EXCEPTION 'Anonymous broadcast write unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.consume_api_quota('ai_chat');
    RAISE EXCEPTION 'Missing identity unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ DECLARE result jsonb; BEGIN
  BEGIN
    INSERT INTO public.api_usage_limits VALUES (auth.uid(),'ai_chat',now(),1,now(),1);
    RAISE EXCEPTION 'Direct counter writes unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.consume_api_quota('arbitrary-action');
    RAISE EXCEPTION 'Unknown action unexpectedly allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  FOR i IN 1..10 LOOP
    result := public.consume_api_quota('ai_chat');
    IF result->>'allowed' <> 'true' THEN RAISE EXCEPTION 'Chat request % denied too early', i; END IF;
  END LOOP;
  result := public.consume_api_quota('ai_chat');
  IF result->>'allowed' <> 'false' OR (result->>'retry_after')::int < 1 THEN RAISE EXCEPTION 'Chat limit not enforced'; END IF;
  FOR i IN 1..2 LOOP
    IF public.consume_api_quota('ai_committee')->>'allowed' <> 'true' THEN RAISE EXCEPTION 'Committee denied too early'; END IF;
  END LOOP;
  IF public.consume_api_quota('ai_committee')->>'allowed' <> 'false' THEN RAISE EXCEPTION 'Committee limit not enforced'; END IF;
  FOR i IN 1..3 LOOP
    IF public.consume_api_quota('test_email')->>'allowed' <> 'true' THEN RAISE EXCEPTION 'Mail denied too early'; END IF;
  END LOOP;
  IF public.consume_api_quota('test_email')->>'allowed' <> 'false' THEN RAISE EXCEPTION 'Mail limit not enforced'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ BEGIN
  IF public.consume_api_quota('ai_chat')->>'allowed' <> 'true' THEN RAISE EXCEPTION 'Different user shares exhausted quota'; END IF;
END $$;
RESET ROLE;
UPDATE public.api_usage_limits SET window_start = now() - interval '10 minutes', day_count = 100 WHERE user_id = '11111111-1111-4111-8111-111111111111' AND action = 'ai_chat';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ BEGIN
  IF public.consume_api_quota('ai_chat')->>'allowed' <> 'false' THEN RAISE EXCEPTION 'Daily quota bypassed by new short window'; END IF;
END $$;
RESET ROLE;
UPDATE public.api_usage_limits SET window_start = now() - interval '2 days', day_start = now() - interval '2 days' WHERE user_id = '11111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.consume_api_quota('ai_chat')->>'allowed' <> 'true' THEN RAISE EXCEPTION 'Expired daily window not reset'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
INSERT INTO public.broadcasts VALUES ('latest', '{"message":"test broadcast"}'::jsonb);
RESET ROLE;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.portfolios (id, user_id) VALUES ('aaaaaaaa-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111');
INSERT INTO public.transactions (id, portfolio_id, user_id, symbol) VALUES ('cccccccc-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'THYAO');

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
INSERT INTO public.portfolios (id, user_id) VALUES ('bbbbbbbb-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222');

DO $$ BEGIN
  -- User 2 trying to attach a transaction to User 1's portfolio using User 2's own user_id
  BEGIN
    INSERT INTO public.transactions (portfolio_id, user_id, symbol)
      VALUES ('aaaaaaaa-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'GARAN');
    RAISE EXCEPTION 'Cross-portfolio transaction attachment unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- User 2 cannot view, update, or delete User 1's transaction
  IF EXISTS (SELECT 1 FROM public.transactions WHERE id = 'cccccccc-1111-4111-8111-111111111111') THEN
    RAISE EXCEPTION 'User 2 can view User 1 transaction';
  END IF;

  UPDATE public.transactions SET symbol = 'HACKED' WHERE id = 'cccccccc-1111-4111-8111-111111111111';
  DELETE FROM public.transactions WHERE id = 'cccccccc-1111-4111-8111-111111111111';
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ DECLARE result jsonb; first_request uuid := gen_random_uuid(); BEGIN
  IF (public.ai_hourly_quota('inspect')->>'used')::int <> 0 THEN RAISE EXCEPTION 'Initial hourly count'; END IF;
  PERFORM public.ai_hourly_quota('consume', first_request);
  FOR i IN 2..5 LOOP PERFORM public.ai_hourly_quota('consume', gen_random_uuid()); END LOOP;
  result := public.ai_hourly_quota('consume', gen_random_uuid());
  IF result->>'allowed' <> 'false' OR (result->>'used')::int <> 5 THEN RAISE EXCEPTION 'Standard hourly cap failed'; END IF;
  PERFORM public.ai_hourly_quota('refund', gen_random_uuid());
  IF (public.ai_hourly_quota('inspect')->>'used')::int <> 5 THEN RAISE EXCEPTION 'Unknown refund changed quota'; END IF;
  PERFORM public.ai_hourly_quota('refund', first_request);
  IF (public.ai_hourly_quota('inspect')->>'used')::int <> 4 THEN RAISE EXCEPTION 'Specific request refund failed'; END IF;
  PERFORM public.ai_hourly_quota('refund', first_request);
  IF (public.ai_hourly_quota('inspect')->>'used')::int <> 4 THEN RAISE EXCEPTION 'Duplicate refund changed quota'; END IF;
  BEGIN
    PERFORM count(*) FROM private.ai_chat_credits;
    RAISE EXCEPTION 'Direct quota table read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ BEGIN
  IF (public.ai_hourly_quota('inspect')->>'used')::int <> 0 THEN RAISE EXCEPTION 'Cross-user quota leak'; END IF;
END $$;
RESET ROLE;
UPDATE auth.users SET raw_app_meta_data = '{"plan":"enterprise"}' WHERE id = '22222222-2222-4222-8222-222222222222';
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
  FOR i IN 1..20 LOOP result := public.ai_hourly_quota('consume', gen_random_uuid()); END LOOP;
  IF result->>'allowed' <> 'true' OR (result->>'limit')::int <> 20 THEN RAISE EXCEPTION 'Pro quota failed'; END IF;
  IF public.ai_hourly_quota('consume', gen_random_uuid())->>'allowed' <> 'false' THEN RAISE EXCEPTION 'Pro cap failed'; END IF;
END $$;
RESET ROLE;
UPDATE private.ai_chat_credits SET created_at = now() - interval '2 hours';
UPDATE private.ai_quota_policy SET standard_limit = 2;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ DECLARE result jsonb; BEGIN
  result := public.ai_hourly_quota('inspect');
  IF (result->>'used')::int <> 0 OR (result->>'limit')::int <> 2 THEN RAISE EXCEPTION 'Expiry or dynamic policy failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
\echo 'Database security assertions passed: identity, quotas, user isolation, window reset, transactions RLS and broadcast permissions.'
