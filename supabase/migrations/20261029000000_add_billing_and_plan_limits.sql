CREATE TABLE public.business_subscriptions (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('free', 'premium', 'enterprise')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider_payment_plan_id bigint,
  provider_customer_email text,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.business_subscriptions TO authenticated;

CREATE POLICY business_subscriptions_read_members
  ON public.business_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members AS membership
    WHERE membership.business_id = p_business_id
      AND membership.user_id = (SELECT auth.uid())
      AND (
        membership.role = 'owner'
        OR EXISTS (
          SELECT 1
          FROM public.business_subscriptions AS subscription
          WHERE subscription.business_id = p_business_id
            AND subscription.plan = 'enterprise'
            AND subscription.status = 'active'
            AND (
              subscription.current_period_end IS NULL
              OR subscription.current_period_end > now()
            )
        )
      )
  );
$$;

CREATE TABLE public.billing_checkout_sessions (
  tx_ref text PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('premium', 'enterprise')),
  expected_amount integer NOT NULL CHECK (expected_amount > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  transaction_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.billing_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.billing_transactions (
  transaction_id bigint PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('premium', 'enterprise')),
  tx_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.sales ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS sales_business_created_at_idx
  ON public.sales (business_id, created_at);
CREATE INDEX IF NOT EXISTS expenses_business_created_at_idx
  ON public.expenses (business_id, created_at);
CREATE INDEX IF NOT EXISTS invoices_business_created_at_idx
  ON public.invoices (business_id, created_at);
CREATE INDEX IF NOT EXISTS products_business_created_at_idx
  ON public.products (business_id, created_at);
CREATE INDEX IF NOT EXISTS customers_business_created_at_idx
  ON public.customers (business_id, created_at);
CREATE INDEX IF NOT EXISTS business_subscriptions_provider_customer_idx
  ON public.business_subscriptions (
    provider_customer_email,
    provider_payment_plan_id
  );

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
  IF p_plan NOT IN ('premium', 'enterprise') THEN
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

CREATE OR REPLACE FUNCTION public.lookup_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
  SELECT users.id
  FROM auth.users AS users
  WHERE lower(users.email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_user_id_by_email(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_auth_user_id_by_email(text)
  TO service_role;

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

  IF active_plan IN ('premium', 'enterprise') THEN
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

REVOKE ALL ON FUNCTION public.enforce_business_plan_limits() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_business_member_plan_limit
  BEFORE INSERT ON public.business_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_plan_limits();

CREATE TRIGGER enforce_sales_plan_limit
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_plan_limits();

CREATE TRIGGER enforce_expenses_plan_limit
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_plan_limits();

CREATE TRIGGER enforce_invoices_plan_limit
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_plan_limits();

CREATE TRIGGER enforce_products_plan_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_plan_limits();

CREATE TRIGGER enforce_customers_plan_limit
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_plan_limits();
