BEGIN;

-- 運営によるアカウント停止
CREATE TABLE IF NOT EXISTS public.suspended_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 200),
  suspended_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suspended_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.suspended_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.suspended_users TO authenticated;

DROP POLICY IF EXISTS "suspended_users_admin_read" ON public.suspended_users;
CREATE POLICY "suspended_users_admin_read"
  ON public.suspended_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_suspended(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.suspended_users WHERE user_id = p_user_id);
$$;

REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM PUBLIC, anon, authenticated;

-- 停止すると求人を非表示にし、解除すると停止が理由で非表示にした求人だけ戻す
CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suspension_reason constant text := '運営によりアカウントが停止されています';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '権限がありません。' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION '運営者のアカウントは停止できません。' USING ERRCODE = '22023';
  END IF;

  IF p_suspended THEN
    INSERT INTO public.suspended_users (user_id, reason)
    VALUES (p_user_id, left(nullif(btrim(p_reason), ''), 200))
    ON CONFLICT (user_id) DO UPDATE
      SET reason = EXCLUDED.reason, suspended_at = now();

    UPDATE public.published_jobs
    SET is_hidden = true,
        hidden_reason = suspension_reason,
        hidden_at = now()
    WHERE owner_id = p_user_id AND is_hidden = false;
  ELSE
    DELETE FROM public.suspended_users WHERE user_id = p_user_id;

    UPDATE public.published_jobs
    SET is_hidden = false, hidden_reason = NULL, hidden_at = NULL
    WHERE owner_id = p_user_id AND hidden_reason = suspension_reason;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_suspended(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_suspended(uuid, boolean, text) TO authenticated;

-- 投稿数の制限: 掲載中20件まで、24時間で新規10件まで。停止中は投稿・応募・メッセージ不可。
CREATE OR REPLACE FUNCTION public.enforce_job_post_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF public.is_suspended(NEW.owner_id) THEN
    RAISE EXCEPTION 'アカウントが停止されているため、求人を投稿できません。' USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(*) FROM public.published_jobs
    WHERE owner_id = NEW.owner_id AND is_hidden = false AND expires_at > now()
  ) >= 20 THEN
    RAISE EXCEPTION '掲載中の求人は20件までです。不要な求人を削除するか、掲載を終了してください。' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*) FROM public.published_jobs
    WHERE owner_id = NEW.owner_id AND created_at > now() - interval '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION '短時間に投稿できる求人は10件までです。しばらくしてからお試しください。' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_job_post_limits() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS published_jobs_enforce_limits ON public.published_jobs;
CREATE TRIGGER published_jobs_enforce_limits
  BEFORE INSERT ON public.published_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_job_post_limits();

CREATE OR REPLACE FUNCTION public.block_suspended_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'job_applications' THEN
    actor := NEW.applicant_id;
  ELSE
    actor := NEW.sender_id;
  END IF;

  IF actor IS NOT NULL AND public.is_suspended(actor) THEN
    RAISE EXCEPTION 'アカウントが停止されているため、この操作はできません。' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_suspended_sender() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_applications_block_suspended ON public.job_applications;
CREATE TRIGGER job_applications_block_suspended
  BEFORE INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.block_suspended_sender();

DROP TRIGGER IF EXISTS application_messages_block_suspended ON public.application_messages;
CREATE TRIGGER application_messages_block_suspended
  BEFORE INSERT ON public.application_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.block_suspended_sender();

COMMIT;
