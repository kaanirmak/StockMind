BEGIN;

-- Trigger execution does not need a public RPC grant.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.handle_new_profile() SET search_path = '';
ALTER FUNCTION public.handle_new_profile_watchlist() SET search_path = '';
ALTER FUNCTION public.update_updated_at() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.handle_new_user(), public.handle_new_profile(),
  public.handle_new_profile_watchlist(), public.update_updated_at() FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.market_quote_cache TO anon, authenticated;
GRANT ALL ON public.market_quote_cache TO service_role;
REVOKE ALL ON public.bulletin_run_telemetry FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bulletin_run_telemetry TO service_role;

-- Owners may mark their server-generated alerts read, but cannot rewrite the event.
REVOKE UPDATE ON public.alert_trigger_events FROM authenticated;
GRANT UPDATE (read_at, archived_at) ON public.alert_trigger_events TO authenticated;

ALTER TABLE public.email_delivery_queue
  DROP CONSTRAINT email_delivery_queue_status_check,
  ADD CONSTRAINT email_delivery_queue_status_check
    CHECK (status IN ('pending', 'processing', 'accepted', 'failed', 'retry_scheduled')),
  ADD COLUMN claim_token uuid UNIQUE,
  ADD COLUMN claimed_at timestamptz;

-- A processing row is deliberately never auto-reclaimed: SMTP can have accepted a
-- message before a worker crashes. Such rows require provider reconciliation.
CREATE FUNCTION public.claim_bulletin_delivery(
  p_bulletin_date date, p_recipient_email text, p_claim_token uuid, p_force boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF p_claim_token IS NULL THEN RAISE EXCEPTION 'Claim token required'; END IF;
  UPDATE public.email_delivery_queue q
  SET status = 'processing', claim_token = p_claim_token,
      claimed_at = now(), updated_at = now(), attempt_count = attempt_count + 1
  WHERE q.bulletin_date = p_bulletin_date
    AND q.job_type = 'daily_bulletin'
    AND q.recipient_email = lower(trim(p_recipient_email))
    AND q.status <> 'processing'
    AND (p_force OR (
      q.status IN ('pending', 'retry_scheduled')
      AND q.attempt_count < q.max_attempts
      AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
    ))
  RETURNING to_jsonb(q) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_bulletin_delivery(date, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bulletin_delivery(date, text, uuid, boolean) TO service_role;

CREATE FUNCTION public.complete_bulletin_delivery(p_claim_token uuid, p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF p_result->>'status' IS NULL OR p_result->>'status' NOT IN ('accepted', 'failed', 'retry_scheduled') THEN
    RAISE EXCEPTION 'Invalid delivery outcome';
  END IF;
  UPDATE public.email_delivery_queue q
  SET status = p_result->>'status',
      sender_email = p_result->>'sender_email',
      transport_method = p_result->>'transport_method',
      provider_message_id = p_result->>'provider_message_id',
      last_error = left(p_result->>'last_error', 500),
      next_retry_at = (p_result->>'next_retry_at')::timestamptz,
      sent_at = CASE WHEN p_result->>'status' = 'accepted' THEN now() ELSE NULL END,
      updated_at = now(), claim_token = NULL
  WHERE q.claim_token = p_claim_token AND q.status = 'processing'
  RETURNING to_jsonb(q) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_bulletin_delivery(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_bulletin_delivery(uuid, jsonb) TO service_role;

COMMIT;
