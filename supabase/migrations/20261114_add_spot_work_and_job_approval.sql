BEGIN;

ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'construction_help',
      'event_setup',
      'farm_work',
      'neighborhood_help',
      'restaurant_help',
      'other'
    )),
  ADD COLUMN IF NOT EXISTS work_date date,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'undecided'
    CHECK (payment_method IN ('cash_on_site', 'bank_transfer', 'undecided')),
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS moderation_note text
    CHECK (moderation_note IS NULL OR char_length(moderation_note) <= 200);

ALTER TABLE public.published_jobs
  ALTER COLUMN moderation_status SET DEFAULT 'pending';

GRANT SELECT (category, work_date, payment_method, moderation_status, moderation_note)
ON TABLE public.published_jobs TO anon, authenticated;
GRANT INSERT (category, work_date, payment_method)
ON TABLE public.published_jobs TO authenticated;
GRANT UPDATE (category, work_date, payment_method)
ON TABLE public.published_jobs TO authenticated;

CREATE INDEX IF NOT EXISTS published_jobs_moderation_status_created_at_idx
  ON public.published_jobs (moderation_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_published_jobs_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
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

  IF NEW.expires_at > now() + interval '31 days' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION '掲載期間は最長30日です。' USING ERRCODE = '22023';
    ELSIF NEW.expires_at > OLD.expires_at THEN
      RAISE EXCEPTION '掲載期間は最長30日です。' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.job_moderation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id bigint NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  moderator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_moderation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_moderation_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.job_moderation_events TO authenticated;
DROP POLICY IF EXISTS "job_moderation_events_admin_read" ON public.job_moderation_events;
CREATE POLICY "job_moderation_events_admin_read"
  ON public.job_moderation_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_published_jobs_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'pending';
    NEW.moderation_note := NULL;
    RETURN NEW;
  END IF;

  NEW.moderation_status := OLD.moderation_status;
  NEW.moderation_note := OLD.moderation_note;

  IF (to_jsonb(NEW) - ARRAY[
        'moderation_status', 'moderation_note',
        'is_hidden', 'hidden_reason', 'hidden_at', 'updated_at', 'created_at',
        'expires_at', 'is_closed'
      ]) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY[
        'moderation_status', 'moderation_note',
        'is_hidden', 'hidden_reason', 'hidden_at', 'updated_at', 'created_at',
        'expires_at', 'is_closed'
      ]) THEN
    NEW.moderation_status := 'pending';
    NEW.moderation_note := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS published_jobs_guard_approval ON public.published_jobs;
CREATE TRIGGER published_jobs_guard_approval
  BEFORE INSERT OR UPDATE ON public.published_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_published_jobs_approval();

DROP POLICY IF EXISTS "published_jobs_public_read" ON public.published_jobs;
CREATE POLICY "published_jobs_public_read"
  ON public.published_jobs
  FOR SELECT
  TO anon, authenticated
  USING (
    (moderation_status = 'approved' AND is_hidden = false)
    OR owner_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.admin_review_job(
  p_job_id bigint,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '権限がありません。' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION '審査結果が正しくありません。' USING ERRCODE = '22023';
  END IF;

  IF p_note IS NOT NULL AND char_length(btrim(p_note)) > 200 THEN
    RAISE EXCEPTION '審査メモは200文字以内で入力してください。' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'rejected' AND nullif(btrim(p_note), '') IS NULL THEN
    RAISE EXCEPTION '却下理由を入力してください。' USING ERRCODE = '22023';
  END IF;

  UPDATE public.published_jobs
  SET moderation_status = p_decision,
      moderation_note = CASE WHEN p_decision = 'rejected' THEN nullif(btrim(p_note), '') ELSE NULL END
  WHERE id = p_job_id
    AND moderation_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION '審査待ちのお仕事が見つかりません。' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.job_moderation_events (job_id, decision, moderator_id, note)
  VALUES (p_job_id, p_decision, auth.uid(), CASE WHEN p_decision = 'rejected' THEN nullif(btrim(p_note), '') ELSE NULL END);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_job(bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_job(bigint, text, text) TO authenticated;

COMMIT;
