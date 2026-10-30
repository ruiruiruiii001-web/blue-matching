CREATE OR REPLACE FUNCTION public.cleanup_deleted_application_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.app_notifications
  WHERE (event_type = 'job_application' AND related_id = OLD.id)
    OR (event_type = 'application_message' AND context_id = OLD.id);

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_deleted_application_records()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_applications_cleanup_deleted_records
  ON public.job_applications;

CREATE TRIGGER job_applications_cleanup_deleted_records
  BEFORE DELETE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_deleted_application_records();

GRANT DELETE ON TABLE public.job_applications TO authenticated;

DROP POLICY IF EXISTS "job_applications_applicant_withdraw"
  ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_applicant_delete_pending"
  ON public.job_applications;

CREATE POLICY "job_applications_applicant_delete_pending"
  ON public.job_applications
  FOR DELETE
  TO authenticated
  USING (
    applicant_id = (SELECT auth.uid())
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
  );

DELETE FROM public.job_applications
WHERE status = 'withdrawn';

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('pending', 'reviewed', 'dismissed'));
