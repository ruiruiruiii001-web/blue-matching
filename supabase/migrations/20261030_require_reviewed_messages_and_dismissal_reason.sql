ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS dismissal_reason text;

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_dismissal_reason_length_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_dismissal_reason_length_check
  CHECK (
    dismissal_reason IS NULL
    OR char_length(btrim(dismissal_reason)) BETWEEN 1 AND 500
  );

CREATE OR REPLACE FUNCTION public.require_application_dismissal_reason()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'dismissed'
    AND OLD.status IS DISTINCT FROM 'dismissed'
    AND (
      NEW.dismissal_reason IS NULL
      OR char_length(btrim(NEW.dismissal_reason)) NOT BETWEEN 1 AND 500
    )
  THEN
    RAISE EXCEPTION 'A dismissal reason between 1 and 500 characters is required'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_application_dismissal_reason()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_applications_require_dismissal_reason
  ON public.job_applications;

CREATE TRIGGER job_applications_require_dismissal_reason
  BEFORE UPDATE OF status ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.require_application_dismissal_reason();

DROP POLICY IF EXISTS "application_messages_participant_insert"
  ON public.application_messages;

CREATE POLICY "application_messages_participant_insert"
  ON public.application_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.job_applications application
      JOIN public.published_jobs job
        ON job.id::text = application.job_id
      WHERE application.id = application_messages.application_id
        AND application.status = 'reviewed'
        AND (
          (
            application.applicant_id = (SELECT auth.uid())
            AND EXISTS (
              SELECT 1
              FROM public.account_types account
              WHERE account.user_id = (SELECT auth.uid())
                AND account.account_type = 'seeker'
            )
          )
          OR
          (
            job.owner_id = (SELECT auth.uid())
            AND EXISTS (
              SELECT 1
              FROM public.account_types account
              WHERE account.user_id = (SELECT auth.uid())
                AND account.account_type = 'employer'
            )
          )
        )
    )
  );
