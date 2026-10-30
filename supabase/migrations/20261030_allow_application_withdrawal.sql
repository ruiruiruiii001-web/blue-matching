ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('pending', 'reviewed', 'dismissed', 'withdrawn'));

REVOKE UPDATE ON TABLE public.job_applications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status) ON TABLE public.job_applications TO authenticated;

DROP POLICY IF EXISTS "job_applications_applicant_withdraw" ON public.job_applications;

CREATE POLICY "job_applications_applicant_withdraw"
  ON public.job_applications
  FOR UPDATE
  TO authenticated
  USING (
    applicant_id = (SELECT auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    applicant_id = (SELECT auth.uid())
    AND status = 'withdrawn'
  );
