CREATE TABLE IF NOT EXISTS public.account_types (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('seeker', 'employer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.account_types FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.account_types TO authenticated;

DROP POLICY IF EXISTS "account_types_owner_read" ON public.account_types;
DROP POLICY IF EXISTS "account_types_owner_insert" ON public.account_types;

CREATE POLICY "account_types_owner_read"
  ON public.account_types
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "account_types_owner_insert"
  ON public.account_types
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER TABLE public.seeker_profiles
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.seeker_public_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.seeker_profiles(user_id) ON DELETE CASCADE,
  job_type text NOT NULL DEFAULT '' CHECK (char_length(job_type) <= 100),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 100),
  pay_type text CHECK (pay_type IS NULL OR pay_type IN ('hourly', 'daily', 'monthly')),
  minimum_salary numeric CHECK (minimum_salary IS NULL OR minimum_salary > 0),
  licenses text[] NOT NULL DEFAULT '{}',
  exp_years text NOT NULL DEFAULT '',
  stamina text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seeker_public_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seeker_public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.seeker_public_profiles TO authenticated;

DROP POLICY IF EXISTS "seeker_public_profiles_owner_read" ON public.seeker_public_profiles;
DROP POLICY IF EXISTS "seeker_public_profiles_seeker_insert" ON public.seeker_public_profiles;
DROP POLICY IF EXISTS "seeker_public_profiles_seeker_update" ON public.seeker_public_profiles;
DROP POLICY IF EXISTS "seeker_public_profiles_seeker_delete" ON public.seeker_public_profiles;
DROP POLICY IF EXISTS "seeker_public_profiles_employer_read" ON public.seeker_public_profiles;

CREATE POLICY "seeker_public_profiles_owner_read"
  ON public.seeker_public_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "seeker_public_profiles_seeker_insert"
  ON public.seeker_public_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
  );

CREATE POLICY "seeker_public_profiles_seeker_update"
  ON public.seeker_public_profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
  );

CREATE POLICY "seeker_public_profiles_seeker_delete"
  ON public.seeker_public_profiles
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
  );

CREATE POLICY "seeker_public_profiles_employer_read"
  ON public.seeker_public_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  );

DROP POLICY IF EXISTS "published_jobs_owner_insert" ON public.published_jobs;
DROP POLICY IF EXISTS "published_jobs_owner_update" ON public.published_jobs;
DROP POLICY IF EXISTS "published_jobs_owner_delete" ON public.published_jobs;

CREATE POLICY "published_jobs_owner_insert"
  ON public.published_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  );

CREATE POLICY "published_jobs_owner_update"
  ON public.published_jobs
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  );

CREATE POLICY "published_jobs_owner_delete"
  ON public.published_jobs
  FOR DELETE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  );

DROP POLICY IF EXISTS "job_applications_applicant_insert" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_applicant_read" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_job_owner_read" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_job_owner_update" ON public.job_applications;

CREATE POLICY "job_applications_applicant_read"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (
    applicant_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
  );

CREATE POLICY "job_applications_applicant_insert"
  ON public.job_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    applicant_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
    AND EXISTS (
      SELECT 1
      FROM public.published_jobs job
      WHERE job.id::text = job_applications.job_id
        AND job.title = job_applications.job_title
        AND NOT coalesce(job.is_closed, false)
        AND job.owner_id IS DISTINCT FROM (SELECT auth.uid())
    )
  );

CREATE POLICY "job_applications_job_owner_read"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.published_jobs job
      WHERE job.id::text = job_applications.job_id
        AND job.owner_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  );

CREATE POLICY "job_applications_job_owner_update"
  ON public.job_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.published_jobs job
      WHERE job.id::text = job_applications.job_id
        AND job.owner_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.published_jobs job
      WHERE job.id::text = job_applications.job_id
        AND job.owner_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  );

CREATE INDEX IF NOT EXISTS seeker_profiles_public_idx
  ON public.seeker_profiles (is_public)
  WHERE is_public;

CREATE INDEX IF NOT EXISTS seeker_public_profiles_updated_idx
  ON public.seeker_public_profiles (updated_at DESC);
