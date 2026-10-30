ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS pay_amount_max numeric
    CHECK (pay_amount_max IS NULL OR pay_amount_max > 0),
  ADD COLUMN IF NOT EXISTS pay_condition_details text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS required_licenses text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_licenses text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_requirement text NOT NULL DEFAULT 'none'
    CHECK (experience_requirement IN ('none', 'preferred', 'required')),
  ADD COLUMN IF NOT EXISTS experience_requirement_details text NOT NULL DEFAULT '';
