ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.published_jobs
SET updated_at = created_at
WHERE updated_at IS NULL
  AND created_at IS NOT NULL;

UPDATE public.published_jobs
SET updated_at = now()
WHERE updated_at IS NULL;

ALTER TABLE public.published_jobs
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_published_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS published_jobs_set_updated_at ON public.published_jobs;
CREATE TRIGGER published_jobs_set_updated_at
  BEFORE UPDATE ON public.published_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_published_jobs_updated_at();
