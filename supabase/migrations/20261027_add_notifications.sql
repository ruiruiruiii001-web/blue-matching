CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('job_application', 'contact_request', 'contact_reply')),
  related_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  email_sent_at timestamptz,
  UNIQUE (recipient_id, event_type, related_id)
);

CREATE INDEX IF NOT EXISTS app_notifications_recipient_created_idx
  ON public.app_notifications (recipient_id, created_at DESC);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.app_notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.app_notifications TO authenticated;
GRANT ALL ON TABLE public.app_notifications TO service_role;

DROP POLICY IF EXISTS "app_notifications_recipient_read" ON public.app_notifications;
DROP POLICY IF EXISTS "app_notifications_recipient_mark_read" ON public.app_notifications;

CREATE POLICY "app_notifications_recipient_read"
  ON public.app_notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = (SELECT auth.uid()));

CREATE POLICY "app_notifications_recipient_mark_read"
  ON public.app_notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    AND read_at IS NULL
  )
  WITH CHECK (
    recipient_id = (SELECT auth.uid())
    AND read_at IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.create_app_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recipient uuid;
  notification_title text;
  notification_body text;
  notification_type text;
  notification_related_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'job_applications' THEN
    SELECT job.owner_id
      INTO recipient
      FROM public.published_jobs job
      WHERE job.id::text = NEW.job_id;

    IF recipient IS NULL OR recipient = NEW.applicant_id THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = recipient
        AND account.account_type = 'employer'
    ) THEN
      RETURN NEW;
    END IF;

    notification_type := 'job_application';
    notification_related_id := NEW.id;
    notification_title := '新しい求人応募が届きました';
    notification_body := '企業マイページの「受け取った応募」で応募内容を確認できます。';
  ELSIF TG_TABLE_NAME = 'seeker_contact_requests' AND TG_OP = 'INSERT' THEN
    notification_type := 'contact_request';
    notification_related_id := NEW.id;
    recipient := NEW.seeker_id;
    notification_title := '企業から連絡リクエストが届きました';
    notification_body := 'マイページの「企業からの連絡」で内容を確認できます。';
  ELSIF TG_TABLE_NAME = 'seeker_contact_requests'
    AND TG_OP = 'UPDATE'
    AND OLD.status = 'pending'
    AND NEW.status IN ('responded', 'declined') THEN
    notification_type := 'contact_reply';
    notification_related_id := NEW.id;
    recipient := NEW.employer_id;
    notification_title := CASE
      WHEN NEW.status = 'responded' THEN '求職者から連絡リクエストに返信がありました'
      ELSE '求職者が連絡リクエストを見送りました'
    END;
    notification_body := '企業向け画面の公開プロフィール一覧で状況を確認できます。';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.app_notifications (
    recipient_id,
    event_type,
    related_id,
    title,
    body
  )
  VALUES (
    recipient,
    notification_type,
    notification_related_id,
    notification_title,
    notification_body
  )
  ON CONFLICT (recipient_id, event_type, related_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_app_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_applications_notify_owner ON public.job_applications;
CREATE TRIGGER job_applications_notify_owner
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.create_app_notification();

DROP TRIGGER IF EXISTS seeker_contact_requests_notify_seeker ON public.seeker_contact_requests;
CREATE TRIGGER seeker_contact_requests_notify_seeker
  AFTER INSERT ON public.seeker_contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_app_notification();

DROP TRIGGER IF EXISTS seeker_contact_requests_notify_employer ON public.seeker_contact_requests;
CREATE TRIGGER seeker_contact_requests_notify_employer
  AFTER UPDATE OF status ON public.seeker_contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_app_notification();
