BEGIN;

ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_event_type_check;
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_event_type_check
  CHECK (event_type IN ('job_application', 'contact_request', 'contact_reply', 'application_message', 'application_reviewed'));

CREATE FUNCTION public.notify_application_reviewed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'reviewed' AND NEW.applicant_id IS NOT NULL THEN
    INSERT INTO public.app_notifications (recipient_id, event_type, related_id, title, body)
    VALUES (NEW.applicant_id, 'application_reviewed', NEW.id, 'お仕事が確定しました',
      '応募履歴でお仕事の内容とメッセージをご確認ください。')
    ON CONFLICT (recipient_id, event_type, related_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_application_reviewed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER job_applications_notify_reviewed
AFTER UPDATE OF status ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_reviewed();

CREATE OR REPLACE FUNCTION public.cleanup_deleted_application_records()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.app_notifications
  WHERE (event_type IN ('job_application', 'application_reviewed') AND related_id = OLD.id)
    OR (event_type = 'application_message' AND context_id = OLD.id);
  RETURN OLD;
END;
$$;

COMMIT;
