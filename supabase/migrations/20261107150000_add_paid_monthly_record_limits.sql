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
  next_month_start timestamptz;
  record_label text;
  record_limit integer;
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
      WHEN active_plan = 'enterprise' THEN 20
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
  ELSIF auth.uid() IS NOT NULL
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

  IF active_plan = 'standard_x' THEN
    RETURN NEW;
  END IF;

  record_limit := CASE active_plan
    WHEN 'premium' THEN 60
    WHEN 'enterprise' THEN 90
    ELSE 30
  END;

  month_start := date_trunc(
    'month',
    now() AT TIME ZONE 'Africa/Lagos'
  ) AT TIME ZONE 'Africa/Lagos';
  next_month_start := month_start + interval '1 month';

  EXECUTE format(
    'SELECT count(*) FROM public.%I AS r
     WHERE r.business_id = $1
       AND (to_jsonb(r)->>''created_at'')::timestamptz >= $2
       AND (to_jsonb(r)->>''created_at'')::timestamptz < $3',
    TG_TABLE_NAME
  )
  INTO current_usage
  USING target_business_id, month_start, next_month_start;

  IF current_usage >= record_limit THEN
    record_label := CASE TG_TABLE_NAME
      WHEN 'sales' THEN 'sales'
      WHEN 'expenses' THEN 'expenses'
      WHEN 'invoices' THEN 'invoices'
      WHEN 'products' THEN 'products/services'
      WHEN 'customers' THEN 'customers'
      ELSE TG_TABLE_NAME
    END;

    IF active_plan IN ('premium', 'enterprise') THEN
      RAISE EXCEPTION 'PAID_PLAN_LIMIT_REACHED: The % plan includes up to % new % per calendar month. Upgrade or switch plans at /billing to continue.', initcap(active_plan), record_limit, record_label
        USING ERRCODE = 'P0001';
    END IF;

    RAISE EXCEPTION 'FREE_PLAN_LIMIT_REACHED: The Free plan includes up to % new % per calendar month. Upgrade at /billing to continue.', record_limit, record_label
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
