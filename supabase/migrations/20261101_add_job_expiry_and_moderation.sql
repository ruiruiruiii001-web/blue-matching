BEGIN;

-- 運営者（管理者）。登録はSQL Editorから手動で行います（README参照）。
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 掲載期限と運営による非表示
ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_reason text CHECK (hidden_reason IS NULL OR char_length(hidden_reason) <= 200),
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

-- 既存の求人には公開時点から30日の猶予を与える
UPDATE public.published_jobs
SET expires_at = now() + interval '30 days'
WHERE expires_at IS NULL;

ALTER TABLE public.published_jobs
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days'),
  ALTER COLUMN expires_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_published_jobs_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- SQL Editorなどの管理操作と運営者は制限しない
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_hidden := false;
    NEW.hidden_reason := NULL;
    NEW.hidden_at := NULL;
  ELSE
    NEW.is_hidden := OLD.is_hidden;
    NEW.hidden_reason := OLD.hidden_reason;
    NEW.hidden_at := OLD.hidden_at;
  END IF;

  IF NEW.expires_at > now() + interval '91 days' THEN
    RAISE EXCEPTION '掲載期間は最長90日です。' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS published_jobs_guard_moderation ON public.published_jobs;
CREATE TRIGGER published_jobs_guard_moderation
  BEFORE INSERT OR UPDATE ON public.published_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_published_jobs_moderation();

-- 非表示の求人は、投稿者本人と運営者だけが読める
DROP POLICY IF EXISTS "published_jobs_public_read" ON public.published_jobs;
CREATE POLICY "published_jobs_public_read"
  ON public.published_jobs
  FOR SELECT
  TO anon, authenticated
  USING (
    is_hidden = false
    OR owner_id = (SELECT auth.uid())
    OR public.is_admin()
  );

GRANT SELECT (expires_at, is_hidden, hidden_reason, hidden_at)
ON TABLE public.published_jobs
TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_job_hidden(
  p_job_id bigint,
  p_hidden boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '権限がありません。' USING ERRCODE = '42501';
  END IF;

  UPDATE public.published_jobs
  SET is_hidden = p_hidden,
      hidden_reason = CASE WHEN p_hidden THEN left(nullif(btrim(p_reason), ''), 200) ELSE NULL END,
      hidden_at = CASE WHEN p_hidden THEN now() ELSE NULL END
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '求人が見つかりません。' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_job_hidden(bigint, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_job_hidden(bigint, boolean, text) TO authenticated;

-- 通報の確認は運営者だけができる
GRANT SELECT ON TABLE public.job_reports TO authenticated;
GRANT UPDATE (status) ON TABLE public.job_reports TO authenticated;

DROP POLICY IF EXISTS "job_reports_admin_read" ON public.job_reports;
CREATE POLICY "job_reports_admin_read"
  ON public.job_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "job_reports_admin_update" ON public.job_reports;
CREATE POLICY "job_reports_admin_update"
  ON public.job_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
