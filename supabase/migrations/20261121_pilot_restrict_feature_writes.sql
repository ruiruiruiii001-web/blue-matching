BEGIN;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'job_favorites', 'employer_follows', 'job_reviews', 'saved_searches', 'application_tracking'
  ] LOOP
    EXECUTE format('CREATE POLICY pilot_no_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (false)', table_name);
    IF table_name = 'job_reviews' THEN
      EXECUTE format('CREATE POLICY pilot_no_anon_select ON public.%I AS RESTRICTIVE FOR SELECT TO anon USING (false)', table_name);
    END IF;
    EXECUTE format('CREATE POLICY pilot_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false)', table_name);
    EXECUTE format('CREATE POLICY pilot_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false)', table_name);
    EXECUTE format('CREATE POLICY pilot_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (false)', table_name);
  END LOOP;
END;
$$;

COMMIT;
