BEGIN;

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
        AND application.status IN ('pending', 'reviewed')
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

COMMIT;
