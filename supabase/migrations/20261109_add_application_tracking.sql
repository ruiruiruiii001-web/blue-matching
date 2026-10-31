BEGIN;

-- 企業側だけが見られる選考管理（応募者には表示されない）
CREATE TABLE IF NOT EXISTS public.application_tracking (
  application_id uuid PRIMARY KEY REFERENCES public.job_applications(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'none'
    CHECK (stage IN ('none', 'interview', 'offer', 'hired', 'not_hired')),
  interview_at timestamptz,
  memo text CHECK (memo IS NULL OR char_length(memo) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.application_tracking FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.application_tracking TO authenticated;

CREATE OR REPLACE FUNCTION public.owns_application(p_application_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_applications a
    JOIN public.published_jobs j ON j.id::text = a.job_id
    JOIN public.account_types t ON t.user_id = j.owner_id AND t.account_type = 'employer'
    WHERE a.id = p_application_id
      AND j.owner_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.owns_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_application(uuid) TO authenticated;

DROP POLICY IF EXISTS "application_tracking_owner_read" ON public.application_tracking;
DROP POLICY IF EXISTS "application_tracking_owner_insert" ON public.application_tracking;
DROP POLICY IF EXISTS "application_tracking_owner_update" ON public.application_tracking;

CREATE POLICY "application_tracking_owner_read"
  ON public.application_tracking FOR SELECT TO authenticated
  USING (employer_id = (SELECT auth.uid()) AND public.owns_application(application_id));

CREATE POLICY "application_tracking_owner_insert"
  ON public.application_tracking FOR INSERT TO authenticated
  WITH CHECK (employer_id = (SELECT auth.uid()) AND public.owns_application(application_id));

CREATE POLICY "application_tracking_owner_update"
  ON public.application_tracking FOR UPDATE TO authenticated
  USING (employer_id = (SELECT auth.uid()) AND public.owns_application(application_id))
  WITH CHECK (employer_id = (SELECT auth.uid()) AND public.owns_application(application_id));

COMMIT;
