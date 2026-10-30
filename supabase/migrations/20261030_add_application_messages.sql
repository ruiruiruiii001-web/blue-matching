CREATE TABLE IF NOT EXISTS public.application_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_messages_application_created_idx
  ON public.application_messages (application_id, created_at);

ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.application_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.application_messages TO authenticated;

DROP POLICY IF EXISTS "application_messages_participant_read" ON public.application_messages;
DROP POLICY IF EXISTS "application_messages_participant_insert" ON public.application_messages;

CREATE POLICY "application_messages_participant_read"
  ON public.application_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_applications application
      JOIN public.published_jobs job
        ON job.id::text = application.job_id
      WHERE application.id = application_messages.application_id
        AND (
          application.applicant_id = (SELECT auth.uid())
          OR job.owner_id = (SELECT auth.uid())
        )
    )
  );

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

ALTER TABLE public.app_notifications
  DROP CONSTRAINT IF EXISTS app_notifications_event_type_check;

ALTER TABLE public.app_notifications
  ADD CONSTRAINT app_notifications_event_type_check
  CHECK (event_type IN ('job_application', 'contact_request', 'contact_reply', 'application_message'));

ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS context_id uuid;

CREATE INDEX IF NOT EXISTS app_notifications_context_idx
  ON public.app_notifications (recipient_id, event_type, context_id);

CREATE OR REPLACE FUNCTION public.notify_application_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recipient uuid;
  application_title text;
BEGIN
  SELECT
    CASE
      WHEN application.applicant_id = NEW.sender_id THEN job.owner_id
      ELSE application.applicant_id
    END,
    application.job_title
  INTO recipient, application_title
  FROM public.job_applications application
  JOIN public.published_jobs job
    ON job.id::text = application.job_id
  WHERE application.id = NEW.application_id;

  IF recipient IS NULL OR recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.app_notifications (
    recipient_id,
    event_type,
    related_id,
    context_id,
    title,
    body
  )
  VALUES (
    recipient,
    'application_message',
    NEW.id,
    NEW.application_id,
    '応募に新しいメッセージが届きました',
    '「' || left(application_title, 80) || '」の応募・メッセージから確認できます。'
  )
  ON CONFLICT (recipient_id, event_type, related_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_application_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS application_messages_notify_participant ON public.application_messages;
CREATE TRIGGER application_messages_notify_participant
  AFTER INSERT ON public.application_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_application_message();
