ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';
