BEGIN;

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(filters) <= 2000),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON public.saved_searches (user_id);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.saved_searches FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_searches TO authenticated;
GRANT UPDATE (last_seen_at) ON TABLE public.saved_searches TO authenticated;

DROP POLICY IF EXISTS "saved_searches_owner_all" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_owner_select" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_owner_insert" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_owner_update" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_owner_delete" ON public.saved_searches;

CREATE POLICY "saved_searches_owner_select" ON public.saved_searches
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "saved_searches_owner_insert" ON public.saved_searches
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "saved_searches_owner_update" ON public.saved_searches
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "saved_searches_owner_delete" ON public.saved_searches
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- 保存できる検索条件は1人5件まで
CREATE OR REPLACE FUNCTION public.limit_saved_searches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.saved_searches WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION '保存できる検索条件は5件までです。不要な条件を削除してください。' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.limit_saved_searches() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS saved_searches_limit ON public.saved_searches;
CREATE TRIGGER saved_searches_limit
  BEFORE INSERT ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.limit_saved_searches();

COMMIT;
