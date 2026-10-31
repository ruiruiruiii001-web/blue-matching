BEGIN;

-- 1. 求人通報への運営メモ
ALTER TABLE public.job_reports
  ADD COLUMN IF NOT EXISTS admin_note text CHECK (admin_note IS NULL OR char_length(admin_note) <= 500);
GRANT UPDATE (status, admin_note) ON TABLE public.job_reports TO authenticated;

-- 2. 停止・解除の履歴（退会後も残すため、ユーザーIDは外部キーにしない）
CREATE TABLE IF NOT EXISTS public.suspension_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('suspended', 'unsuspended')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 200),
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suspension_log_user_idx ON public.suspension_log (user_id, created_at DESC);

ALTER TABLE public.suspension_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.suspension_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.suspension_log TO authenticated;
DROP POLICY IF EXISTS "suspension_log_admin_read" ON public.suspension_log;
CREATE POLICY "suspension_log_admin_read"
  ON public.suspension_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

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
  clean_reason text := left(nullif(btrim(p_reason), ''), 200);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '権限がありません。' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION '運営者のアカウントは停止できません。' USING ERRCODE = '22023';
  END IF;

  IF p_suspended THEN
    INSERT INTO public.suspended_users (user_id, reason)
    VALUES (p_user_id, clean_reason)
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

  INSERT INTO public.suspension_log (user_id, action, reason, admin_id)
  VALUES (p_user_id, CASE WHEN p_suspended THEN 'suspended' ELSE 'unsuspended' END, clean_reason, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_suspended(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_suspended(uuid, boolean, text) TO authenticated;

-- 3. メッセージの通報
CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.application_messages(id) ON DELETE SET NULL,
  application_id uuid,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('harassment', 'scam', 'contact', 'inappropriate', 'other')),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note text CHECK (admin_note IS NULL OR char_length(admin_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS message_reports_unique_idx
  ON public.message_reports (message_id, reporter_id) WHERE message_id IS NOT NULL AND reporter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_reports_status_idx ON public.message_reports (status, created_at DESC);

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.message_reports TO authenticated;
GRANT UPDATE (status, admin_note) ON TABLE public.message_reports TO authenticated;

DROP POLICY IF EXISTS "message_reports_admin_read" ON public.message_reports;
CREATE POLICY "message_reports_admin_read"
  ON public.message_reports FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "message_reports_admin_update" ON public.message_reports;
CREATE POLICY "message_reports_admin_update"
  ON public.message_reports FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 応募の当事者だけが、相手から届いたメッセージを通報できる（1日20件まで）
CREATE OR REPLACE FUNCTION public.report_message(
  p_message_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  msg record;
  applicant uuid;
  owner uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_reason NOT IN ('harassment', 'scam', 'contact', 'inappropriate', 'other') THEN
    RAISE EXCEPTION '通報の理由が正しくありません。' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(p_details, '')) > 500 THEN
    RAISE EXCEPTION '詳細は500文字以内で入力してください。' USING ERRCODE = '22023';
  END IF;

  SELECT m.id, m.application_id, m.sender_id, m.body INTO msg
  FROM public.application_messages m WHERE m.id = p_message_id;
  IF msg.id IS NULL THEN
    RAISE EXCEPTION 'メッセージが見つかりません。' USING ERRCODE = 'P0002';
  END IF;

  SELECT a.applicant_id, j.owner_id INTO applicant, owner
  FROM public.job_applications a
  JOIN public.published_jobs j ON j.id::text = a.job_id
  WHERE a.id = msg.application_id;
  IF uid NOT IN (applicant, owner) THEN
    RAISE EXCEPTION 'このメッセージは通報できません。' USING ERRCODE = '42501';
  END IF;
  IF msg.sender_id = uid THEN
    RAISE EXCEPTION '自分のメッセージは通報できません。' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM public.message_reports
      WHERE reporter_id = uid AND created_at > now() - interval '24 hours') >= 20 THEN
    RAISE EXCEPTION '通報の回数が上限に達しました。しばらくしてからお試しください。' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.message_reports (message_id, application_id, reporter_id, reported_user_id, reason, details, message_body)
  VALUES (msg.id, msg.application_id, uid, msg.sender_id, p_reason, nullif(btrim(p_details), ''), msg.body)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.report_message(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_message(uuid, text, text) TO authenticated;

-- 4. 運営向けユーザー一覧（メールの一部一致で検索）
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  email text,
  account_type text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_suspended boolean,
  suspended_reason text,
  job_count bigint,
  report_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '権限がありません。' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id,
         u.email::text,
         (SELECT a.account_type FROM public.account_types a WHERE a.user_id = u.id),
         u.created_at,
         u.last_sign_in_at,
         EXISTS (SELECT 1 FROM public.suspended_users s WHERE s.user_id = u.id),
         (SELECT s.reason FROM public.suspended_users s WHERE s.user_id = u.id),
         (SELECT count(*) FROM public.published_jobs j WHERE j.owner_id = u.id),
         (SELECT count(*) FROM public.message_reports r WHERE r.reported_user_id = u.id)
  FROM auth.users u
  WHERE p_query IS NULL OR btrim(p_query) = '' OR u.email ILIKE '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%'
  ORDER BY u.created_at DESC
  LIMIT least(greatest(p_limit, 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, integer) TO authenticated;

COMMIT;
