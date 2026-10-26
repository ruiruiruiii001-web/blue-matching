CREATE TABLE IF NOT EXISTS public.seeker_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  phone text CHECK (
    phone IS NULL
    OR phone ~ '^(0[0-9]{9,10}|\+81[0-9]{9,10})$'
  ),
  job_type text NOT NULL DEFAULT '' CHECK (char_length(job_type) <= 100),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 100),
  pay_type text CHECK (pay_type IS NULL OR pay_type IN ('hourly', 'daily', 'monthly')),
  minimum_salary numeric CHECK (minimum_salary IS NULL OR minimum_salary > 0),
  licenses text[] NOT NULL DEFAULT '{}',
  exp_years text NOT NULL DEFAULT '',
  stamina text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  job_title text NOT NULL CHECK (char_length(job_title) BETWEEN 1 AND 200),
  applicant_name text NOT NULL CHECK (char_length(applicant_name) BETWEEN 1 AND 100),
  applicant_phone text NOT NULL CHECK (
    applicant_phone ~ '^(0[0-9]{9,10}|\+81[0-9]{9,10})$'
  ),
  experience text NOT NULL DEFAULT '' CHECK (char_length(experience) <= 100),
  licenses text[] NOT NULL DEFAULT '{}',
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, job_id)
);

ALTER TABLE public.seeker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.seeker_profiles, public.job_favorites, public.job_applications FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.seeker_profiles, public.job_favorites TO authenticated;
GRANT SELECT, INSERT ON TABLE public.job_applications TO authenticated;
GRANT UPDATE (status) ON TABLE public.job_applications TO authenticated;

CREATE POLICY "seeker_profiles_owner_access"
  ON public.seeker_profiles
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "job_favorites_owner_access"
  ON public.job_favorites
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "job_applications_applicant_read"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (applicant_id = (SELECT auth.uid()));

CREATE POLICY "job_applications_applicant_insert"
  ON public.job_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    applicant_id = (SELECT auth.uid())
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.published_jobs job
      WHERE job.id::text = job_applications.job_id
        AND job.owner_id = (SELECT auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS job_applications_applicant_created_idx
  ON public.job_applications (applicant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_applications_job_created_idx
  ON public.job_applications (job_id, created_at DESC);
