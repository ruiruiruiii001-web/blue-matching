ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;
