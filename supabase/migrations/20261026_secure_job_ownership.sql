ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS owner_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL
    DEFAULT auth.uid();

ALTER TABLE public.published_jobs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'published_jobs'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.published_jobs',
      existing_policy.policyname
    );
  END LOOP;
END
$$;

CREATE POLICY "published_jobs_public_read"
  ON public.published_jobs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "published_jobs_owner_insert"
  ON public.published_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "published_jobs_owner_update"
  ON public.published_jobs
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "published_jobs_owner_delete"
  ON public.published_jobs
  FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));
