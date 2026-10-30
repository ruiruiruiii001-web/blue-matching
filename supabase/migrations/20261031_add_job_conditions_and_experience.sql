ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS break_minutes integer,
  ADD COLUMN IF NOT EXISTS overtime_details text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS allowance_details text NOT NULL DEFAULT '';

ALTER TABLE public.seeker_profiles
  ADD COLUMN IF NOT EXISTS experience_details text NOT NULL DEFAULT '';

ALTER TABLE public.seeker_public_profiles
  ADD COLUMN IF NOT EXISTS experience_details text NOT NULL DEFAULT '';
