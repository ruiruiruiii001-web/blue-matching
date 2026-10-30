ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS work_preferences text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.seeker_profiles
  ADD COLUMN IF NOT EXISTS work_preferences text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.seeker_public_profiles
  ADD COLUMN IF NOT EXISTS work_preferences text[] NOT NULL DEFAULT '{}';

UPDATE public.published_jobs
SET work_preferences = CASE
  WHEN work_style = 'short'
    THEN ARRAY['employment:spot', 'employment:short_term']
  ELSE ARRAY['employment:long_term']
END
WHERE cardinality(work_preferences) = 0
  AND work_style IN ('short', 'regular');

UPDATE public.seeker_profiles
SET stamina = '★★★★★ (とても自信あり)'
WHERE stamina = '★★★★★ (自信あり)';

UPDATE public.seeker_public_profiles
SET stamina = '★★★★★ (とても自信あり)'
WHERE stamina = '★★★★★ (自信あり)';
