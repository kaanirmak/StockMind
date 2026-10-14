-- One row per user/action; fixed-window limits shared by all application instances.
BEGIN;
CREATE TABLE public.api_usage_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('ai_chat', 'ai_committee', 'test_email')),
  window_start timestamptz NOT NULL,
  window_count integer NOT NULL CHECK (window_count > 0),
  day_start timestamptz NOT NULL,
  day_count integer NOT NULL CHECK (day_count > 0),
  PRIMARY KEY (user_id, action)
);
ALTER TABLE public.api_usage_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_usage_limits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.consume_api_quota(p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_seconds integer;
  v_limit integer;
  v_daily_limit integer;
  v_window timestamptz;
  v_day timestamptz;
  v_written boolean := false;
  v_row public.api_usage_limits%ROWTYPE;
  v_retry integer := 1;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  CASE p_action
    WHEN 'ai_chat' THEN v_seconds := 60; v_limit := 10; v_daily_limit := 100;
    WHEN 'ai_committee' THEN v_seconds := 60; v_limit := 2; v_daily_limit := 20;
    WHEN 'test_email' THEN v_seconds := 600; v_limit := 3; v_daily_limit := 10;
    ELSE RAISE EXCEPTION 'Unknown action' USING ERRCODE = '22023';
  END CASE;
  v_window := to_timestamp(floor(extract(epoch FROM v_now) / v_seconds) * v_seconds);
  v_day := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  -- The conflict update locks the row and tests the latest counters atomically.
  INSERT INTO public.api_usage_limits AS usage
    (user_id, action, window_start, window_count, day_start, day_count)
  VALUES (v_user, p_action, v_window, 1, v_day, 1)
  ON CONFLICT (user_id, action) DO UPDATE SET
    window_start = v_window,
    window_count = CASE WHEN usage.window_start < v_window THEN 1 ELSE usage.window_count + 1 END,
    day_start = v_day,
    day_count = CASE WHEN usage.day_start < v_day THEN 1 ELSE usage.day_count + 1 END
  WHERE (usage.window_start < v_window OR usage.window_count < v_limit)
    AND (usage.day_start < v_day OR usage.day_count < v_daily_limit)
  RETURNING true INTO v_written;

  IF coalesce(v_written, false) THEN
    RETURN jsonb_build_object('allowed', true, 'retry_after', 0);
  END IF;
  SELECT * INTO v_row FROM public.api_usage_limits WHERE user_id = v_user AND action = p_action;
  IF v_row.window_start = v_window AND v_row.window_count >= v_limit THEN
    v_retry := greatest(v_retry, ceil(extract(epoch FROM (v_window + make_interval(secs => v_seconds) - v_now)))::integer);
  END IF;
  IF v_row.day_start = v_day AND v_row.day_count >= v_daily_limit THEN
    v_retry := greatest(v_retry, ceil(extract(epoch FROM (v_day + interval '1 day' - v_now)))::integer);
  END IF;
  RETURN jsonb_build_object('allowed', false, 'retry_after', v_retry);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_api_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_api_quota(text) TO authenticated;
COMMIT;
