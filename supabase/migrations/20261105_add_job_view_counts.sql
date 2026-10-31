BEGIN;

-- 求人ごとの閲覧数。投稿者だけが自分の求人の数を読める。
CREATE TABLE IF NOT EXISTS public.job_view_counts (
  job_id bigint PRIMARY KEY REFERENCES public.published_jobs(id) ON DELETE CASCADE,
  view_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.job_view_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_view_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.job_view_counts TO authenticated;

DROP POLICY IF EXISTS "job_view_counts_owner_read" ON public.job_view_counts;
CREATE POLICY "job_view_counts_owner_read"
  ON public.job_view_counts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.published_jobs job
      WHERE job.id = job_view_counts.job_id
        AND job.owner_id = (SELECT auth.uid())
    )
  );

-- 閲覧を1回数える。公開中の求人のみ対象で、投稿者本人の閲覧は数えない。
CREATE OR REPLACE FUNCTION public.record_job_view(p_job_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.published_jobs
    WHERE id = p_job_id
      AND is_hidden = false
      AND expires_at > now()
      AND owner_id IS DISTINCT FROM auth.uid()
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.job_view_counts (job_id, view_count)
  VALUES (p_job_id, 1)
  ON CONFLICT (job_id) DO UPDATE
    SET view_count = public.job_view_counts.view_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.record_job_view(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_job_view(bigint) TO anon, authenticated;

COMMIT;
