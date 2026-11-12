-- Shared sliding window. Only the authenticated caller can inspect or change its credits.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.ai_quota_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  standard_limit integer NOT NULL CHECK (standard_limit BETWEEN 1 AND 10000),
  pro_limit integer NOT NULL CHECK (pro_limit BETWEEN 1 AND 10000),
  window_seconds integer NOT NULL CHECK (window_seconds BETWEEN 60 AND 86400)
);
INSERT INTO private.ai_quota_policy VALUES (true, 5, 20, 3600);
ALTER TABLE private.ai_quota_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ai_quota_policy FROM PUBLIC, anon, authenticated;
CREATE TABLE private.ai_chat_credits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
CREATE INDEX ai_chat_credits_window ON private.ai_chat_credits (user_id, created_at);
ALTER TABLE private.ai_chat_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ai_chat_credits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.ai_hourly_quota(p_mode text, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_meta jsonb;
  v_pro boolean;
  v_limit integer;
  v_window integer;
  v_used integer;
  v_oldest timestamptz;
  v_allowed boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_mode NOT IN ('inspect', 'consume', 'refund') OR p_mode IS NULL OR
     (p_mode <> 'inspect' AND p_request_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid quota operation' USING ERRCODE = '22023';
  END IF;
  SELECT raw_app_meta_data INTO v_meta FROM auth.users WHERE id = v_user;
  v_pro := coalesce(v_meta->>'plan' IN ('pro', 'enterprise') OR v_meta->'is_pro' = 'true'::jsonb, false);
  SELECT CASE WHEN v_pro THEN pro_limit ELSE standard_limit END, window_seconds
    INTO STRICT v_limit, v_window FROM private.ai_quota_policy WHERE singleton;
  -- Serialize all operations for this account, including concurrent application instances.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  DELETE FROM private.ai_chat_credits WHERE user_id = v_user AND created_at <= v_now - make_interval(secs => v_window);
  IF p_mode = 'refund' THEN
    DELETE FROM private.ai_chat_credits WHERE user_id = v_user AND request_id = p_request_id;
  END IF;
  SELECT count(*), min(created_at) INTO v_used, v_oldest
    FROM private.ai_chat_credits WHERE user_id = v_user;
  v_allowed := v_used < v_limit;
  IF p_mode = 'consume' AND v_allowed THEN
    INSERT INTO private.ai_chat_credits (user_id, request_id, created_at)
      VALUES (v_user, p_request_id, v_now) ON CONFLICT DO NOTHING;
    SELECT count(*), min(created_at) INTO v_used, v_oldest
      FROM private.ai_chat_credits WHERE user_id = v_user;
  END IF;
  RETURN jsonb_build_object(
    'allowed', v_allowed, 'limit', v_limit, 'used', v_used,
    'remaining', greatest(0, v_limit - v_used), 'isPro', v_pro,
    'retryAfter', CASE WHEN v_oldest IS NULL THEN 0 ELSE greatest(1, ceil(extract(epoch FROM (v_oldest + make_interval(secs => v_window) - v_now)))::integer) END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.ai_hourly_quota(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_hourly_quota(text, uuid) TO authenticated;
COMMIT;
