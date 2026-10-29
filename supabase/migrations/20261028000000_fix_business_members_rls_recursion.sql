DO $$
DECLARE
  membership_policy record;
  policy_roles text;
  policy_using text;
  policy_check text;
  policy_name_suffix text;
BEGIN
  FOR membership_policy IN
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_members'
      AND cmd IN ('ALL', 'SELECT')
      AND (
        (
          cmd = 'SELECT'
          AND COALESCE(qual, '') ILIKE '%business_members%'
        )
        OR (
          cmd = 'ALL'
          AND (
            COALESCE(qual, '') ILIKE '%business_members%'
            OR COALESCE(with_check, '') ILIKE '%business_members%'
          )
        )
      )
  LOOP
    IF membership_policy.cmd = 'ALL' THEN
      SELECT string_agg(
        CASE
          WHEN role_name = 'public' THEN 'PUBLIC'
          ELSE quote_ident(role_name)
        END,
        ', '
      )
      INTO policy_roles
      FROM unnest(membership_policy.roles) AS roles(role_name);

      policy_using := COALESCE(membership_policy.qual, 'true');
      policy_check := COALESCE(membership_policy.with_check, policy_using);
      policy_name_suffix := LEFT(MD5(membership_policy.policyname), 10);

      EXECUTE format(
        'CREATE POLICY %I ON public.business_members AS %s FOR INSERT TO %s WITH CHECK (%s)',
        'business_members_migrated_' || policy_name_suffix || '_insert',
        membership_policy.permissive,
        policy_roles,
        policy_check
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.business_members AS %s FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
        'business_members_migrated_' || policy_name_suffix || '_update',
        membership_policy.permissive,
        policy_roles,
        policy_using,
        policy_check
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.business_members AS %s FOR DELETE TO %s USING (%s)',
        'business_members_migrated_' || policy_name_suffix || '_delete',
        membership_policy.permissive,
        policy_roles,
        policy_using
      );
    END IF;

    EXECUTE format(
      'DROP POLICY %I ON public.business_members',
      membership_policy.policyname
    );
  END LOOP;
END;
$$;

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
  );
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid)
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
      AND membership.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_business_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_business_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS "business_members_select_own"
  ON public.business_members;
DROP POLICY IF EXISTS "Users can view memberships"
  ON public.business_members;
DROP POLICY IF EXISTS "Owners can manage memberships"
  ON public.business_members;

CREATE POLICY business_members_select_own
  ON public.business_members
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.is_business_member(business_id)
  );

CREATE POLICY "Owners can manage memberships"
  ON public.business_members
  FOR DELETE
  TO authenticated
  USING (public.is_business_owner(business_id));

CREATE OR REPLACE FUNCTION public.create_business(
  p_name text,
  p_description text DEFAULT NULL,
  p_business_type text DEFAULT NULL,
  p_country text DEFAULT 'Nigeria',
  p_currency text DEFAULT 'NGN',
  p_timezone text DEFAULT 'Africa/Lagos'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_business_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be authenticated to create a business';
  END IF;

  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  INSERT INTO public.businesses (
    name,
    description,
    business_type,
    country,
    currency,
    timezone,
    created_by
  )
  VALUES (
    trim(p_name),
    nullif(trim(p_description), ''),
    nullif(trim(p_business_type), ''),
    coalesce(nullif(trim(p_country), ''), 'Nigeria'),
    coalesce(nullif(trim(p_currency), ''), 'NGN'),
    coalesce(nullif(trim(p_timezone), ''), 'Africa/Lagos'),
    auth.uid()
  )
  RETURNING id INTO new_business_id;

  INSERT INTO public.business_members (
    business_id,
    user_id,
    role
  )
  VALUES (
    new_business_id,
    auth.uid(),
    'owner'
  );

  RETURN new_business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_business(
  text,
  text,
  text,
  text,
  text,
  text
) TO authenticated;
