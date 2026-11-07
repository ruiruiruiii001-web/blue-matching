CREATE TABLE public.line_notification_links (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  line_user_id text NOT NULL UNIQUE CHECK (line_user_id ~ '^U[0-9a-f]{32}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.line_link_requests (
  nonce text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);

CREATE TABLE public.line_application_deliveries (
  notification_id uuid PRIMARY KEY REFERENCES public.app_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  last_error text
);

ALTER TABLE public.line_notification_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_application_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.line_notification_links, public.line_link_requests,
  public.line_application_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.line_notification_links, public.line_link_requests,
  public.line_application_deliveries TO service_role;

CREATE FUNCTION public.enqueue_line_application_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.event_type = 'job_application' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('line:' || NEW.recipient_id::text, 0));
    INSERT INTO public.line_application_deliveries (notification_id, user_id, line_user_id)
    SELECT NEW.id, NEW.recipient_id, links.line_user_id
    FROM public.line_notification_links links
    WHERE links.user_id = NEW.recipient_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_line_application_notification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER app_notifications_enqueue_line
AFTER INSERT ON public.app_notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_line_application_notification();

CREATE FUNCTION public.complete_line_link(p_nonce text, p_line_user_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  target_user uuid;
BEGIN
  SELECT user_id INTO target_user FROM public.line_link_requests
  WHERE nonce = p_nonce AND expires_at > now();
  IF target_user IS NULL THEN
    RETURN false;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('line:' || target_user::text, 0));
  DELETE FROM public.line_link_requests
  WHERE nonce = p_nonce AND expires_at > now()
  RETURNING user_id INTO target_user;
  IF target_user IS NULL THEN
    RETURN false;
  END IF;
  IF p_line_user_id !~ '^U[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Invalid LINE user ID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.line_notification_links
    WHERE line_user_id = p_line_user_id AND user_id <> target_user
  ) THEN
    RAISE EXCEPTION 'LINE account already linked';
  END IF;
  DELETE FROM public.line_application_deliveries
  WHERE user_id = target_user;
  INSERT INTO public.line_notification_links (user_id, line_user_id)
  VALUES (target_user, p_line_user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET line_user_id = EXCLUDED.line_user_id, created_at = now();
  DELETE FROM public.line_link_requests WHERE user_id = target_user;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_line_link(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_line_link(text, text) TO service_role;

CREATE FUNCTION public.remove_line_link(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('line:' || p_user_id::text, 0));
  DELETE FROM public.line_link_requests WHERE user_id = p_user_id;
  DELETE FROM public.line_application_deliveries WHERE user_id = p_user_id;
  DELETE FROM public.line_notification_links WHERE user_id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_line_link(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_line_link(uuid) TO service_role;

CREATE FUNCTION public.claim_line_application_deliveries()
RETURNS SETOF public.line_application_deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.line_link_requests WHERE expires_at <= now();
  UPDATE public.line_application_deliveries
  SET status = 'failed', last_error = '通知の再送期限を超えました'
  WHERE status IN ('pending', 'sending') AND available_at <= now()
    AND (created_at <= now() - interval '23 hours' OR attempts >= 10);
  RETURN QUERY UPDATE public.line_application_deliveries delivery
  SET status = 'sending', attempts = delivery.attempts + 1,
      available_at = now() + interval '5 minutes'
  WHERE delivery.notification_id IN (
    SELECT candidate.notification_id
    FROM public.line_application_deliveries candidate
    WHERE candidate.status IN ('pending', 'sending')
      AND candidate.available_at <= now()
      AND candidate.created_at > now() - interval '23 hours'
      AND candidate.attempts < 10
    ORDER BY candidate.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 20
  )
  RETURNING delivery.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_line_application_deliveries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_line_application_deliveries() TO service_role;

CREATE FUNCTION public.authorize_line_delivery_worker(p_secret text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'line_application_worker_secret'
      AND decrypted_secret = p_secret
  );
$$;
REVOKE ALL ON FUNCTION public.authorize_line_delivery_worker(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_line_delivery_worker(text) TO service_role;
