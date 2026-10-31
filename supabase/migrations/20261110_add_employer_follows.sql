BEGIN;

-- 求職者が企業（求人の投稿者）をフォローする。フォロー状況は本人にだけ見える。
CREATE TABLE IF NOT EXISTS public.employer_follows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, employer_id),
  CHECK (user_id <> employer_id)
);

ALTER TABLE public.employer_follows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.employer_follows FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.employer_follows TO authenticated;

DROP POLICY IF EXISTS "employer_follows_own_read" ON public.employer_follows;
DROP POLICY IF EXISTS "employer_follows_own_insert" ON public.employer_follows;
DROP POLICY IF EXISTS "employer_follows_own_delete" ON public.employer_follows;

CREATE POLICY "employer_follows_own_read"
  ON public.employer_follows FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "employer_follows_own_insert"
  ON public.employer_follows FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.account_types t
      WHERE t.user_id = (SELECT auth.uid()) AND t.account_type = 'seeker'
    )
    AND EXISTS (SELECT 1 FROM public.published_jobs j WHERE j.owner_id = employer_id)
  );

CREATE POLICY "employer_follows_own_delete"
  ON public.employer_follows FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMIT;
