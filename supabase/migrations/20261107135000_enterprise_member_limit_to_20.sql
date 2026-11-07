DO $$
DECLARE
  current_definition text;
  updated_definition text;
  old_limit_expression text := 'WHEN active_plan = ''enterprise'' THEN 10';
  new_limit_expression text := 'WHEN active_plan = ''enterprise'' THEN 20';
BEGIN
  SELECT pg_get_functiondef(
    'public.enforce_business_plan_limits()'::regprocedure
  )
  INTO current_definition;

  updated_definition := replace(
    current_definition,
    old_limit_expression,
    new_limit_expression
  );

  IF updated_definition = current_definition THEN
    IF position(new_limit_expression IN current_definition) > 0 THEN
      RETURN;
    END IF;

    RAISE EXCEPTION
      'Could not update Enterprise member limit: expected the existing 10-member plan rule.';
  END IF;

  EXECUTE updated_definition;
END;
$$;
