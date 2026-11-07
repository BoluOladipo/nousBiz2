ALTER TABLE public.business_subscriptions
  DROP CONSTRAINT IF EXISTS business_subscriptions_plan_check;
ALTER TABLE public.business_subscriptions
  ADD CONSTRAINT business_subscriptions_plan_check
  CHECK (plan IN ('free', 'premium', 'enterprise', 'standard_x'));

ALTER TABLE public.billing_checkout_sessions
  DROP CONSTRAINT IF EXISTS billing_checkout_sessions_plan_check;
ALTER TABLE public.billing_checkout_sessions
  ADD CONSTRAINT billing_checkout_sessions_plan_check
  CHECK (plan IN ('premium', 'enterprise', 'standard_x'));

ALTER TABLE public.billing_transactions
  DROP CONSTRAINT IF EXISTS billing_transactions_plan_check;
ALTER TABLE public.billing_transactions
  ADD CONSTRAINT billing_transactions_plan_check
  CHECK (plan IN ('premium', 'enterprise', 'standard_x'));

CREATE OR REPLACE FUNCTION public.apply_billing_payment(
  p_transaction_id bigint,
  p_business_id uuid,
  p_plan text,
  p_provider_payment_plan_id bigint,
  p_customer_email text,
  p_tx_ref text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inserted_transaction_id bigint;
BEGIN
  IF p_plan NOT IN ('premium', 'enterprise', 'standard_x') THEN
    RAISE EXCEPTION 'Invalid subscription plan';
  END IF;

  INSERT INTO public.billing_transactions (
    transaction_id,
    business_id,
    plan,
    tx_ref
  )
  VALUES (
    p_transaction_id,
    p_business_id,
    p_plan,
    p_tx_ref
  )
  ON CONFLICT (transaction_id) DO NOTHING
  RETURNING transaction_id INTO inserted_transaction_id;

  IF inserted_transaction_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.business_subscriptions (
    business_id,
    plan,
    status,
    current_period_start,
    current_period_end,
    provider_payment_plan_id,
    provider_customer_email,
    cancel_at_period_end,
    updated_at
  )
  VALUES (
    p_business_id,
    p_plan,
    'active',
    now(),
    now() + interval '1 month',
    p_provider_payment_plan_id,
    lower(p_customer_email),
    false,
    now()
  )
  ON CONFLICT (business_id) DO UPDATE
  SET plan = EXCLUDED.plan,
      status = 'active',
      current_period_start = now(),
      current_period_end = now() + interval '1 month',
      provider_payment_plan_id = EXCLUDED.provider_payment_plan_id,
      provider_customer_email = EXCLUDED.provider_customer_email,
      cancel_at_period_end = false,
      updated_at = now();

  IF p_tx_ref IS NOT NULL THEN
    UPDATE public.billing_checkout_sessions
    SET status = 'completed',
        transaction_id = p_transaction_id,
        completed_at = now()
    WHERE tx_ref = p_tx_ref
      AND business_id = p_business_id
      AND plan = p_plan;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_billing_payment(
  bigint,
  uuid,
  text,
  bigint,
  text,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_billing_payment(
  bigint,
  uuid,
  text,
  bigint,
  text,
  text
) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_business_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  target_business_id uuid;
  active_plan text;
  current_usage bigint;
  month_start timestamptz;
  record_label text;
  member_limit integer;
BEGIN
  target_business_id := NEW.business_id;
  NEW := jsonb_populate_record(
    NEW,
    jsonb_build_object('created_at', transaction_timestamp())
  );

  PERFORM pg_advisory_xact_lock(
    hashtext(target_business_id::text || ':' || TG_TABLE_NAME)
  );

  SELECT subscription.plan
  INTO active_plan
  FROM public.business_subscriptions AS subscription
  WHERE subscription.business_id = target_business_id
    AND subscription.status = 'active'
    AND (
      subscription.current_period_end IS NULL
      OR subscription.current_period_end > now()
    );

  IF TG_TABLE_NAME = 'business_members' THEN
    member_limit := CASE
      WHEN active_plan = 'enterprise' THEN 10
      ELSE 1
    END;

    SELECT count(*)
    INTO current_usage
    FROM public.business_members AS membership
    WHERE membership.business_id = target_business_id;

    IF current_usage >= member_limit THEN
      RAISE EXCEPTION 'TEAM_MEMBER_LIMIT_REACHED: This plan allows up to % member(s). Upgrade to Enterprise for team access.', member_limit
        USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
  END IF;

  IF active_plan IN ('premium', 'enterprise', 'standard_x') THEN
    IF active_plan <> 'enterprise'
      AND auth.uid() IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_members AS membership
        WHERE membership.business_id = target_business_id
          AND membership.user_id = auth.uid()
          AND membership.role = 'owner'
      )
    THEN
      RAISE EXCEPTION 'TEAM_MEMBER_LIMIT_REACHED: Team access is available on the Enterprise plan.'
        USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.business_members AS membership
      WHERE membership.business_id = target_business_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'owner'
    )
  THEN
    RAISE EXCEPTION 'TEAM_MEMBER_LIMIT_REACHED: Team access is available on the Enterprise plan.'
      USING ERRCODE = 'P0001';
  END IF;

  month_start := date_trunc(
    'month',
    now() AT TIME ZONE 'Africa/Lagos'
  ) AT TIME ZONE 'Africa/Lagos';

  EXECUTE format(
    'SELECT count(*) FROM public.%I AS r
     WHERE r.business_id = $1
       AND (to_jsonb(r)->>''created_at'')::timestamptz >= $2',
    TG_TABLE_NAME
  )
  INTO current_usage
  USING target_business_id, month_start;

  IF current_usage >= 30 THEN
    record_label := CASE TG_TABLE_NAME
      WHEN 'sales' THEN 'sales'
      WHEN 'expenses' THEN 'expenses'
      WHEN 'invoices' THEN 'invoices'
      WHEN 'products' THEN 'products/services'
      WHEN 'customers' THEN 'customers'
      ELSE TG_TABLE_NAME
    END;

    RAISE EXCEPTION 'FREE_PLAN_LIMIT_REACHED: The Free plan includes 30 new % per calendar month. Upgrade at /billing to continue.', record_label
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
