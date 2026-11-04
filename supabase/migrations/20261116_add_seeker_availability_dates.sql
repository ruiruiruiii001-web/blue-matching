ALTER TABLE public.seeker_profiles
  ADD COLUMN IF NOT EXISTS available_dates date[] NOT NULL DEFAULT '{}'
  CHECK (cardinality(available_dates) <= 60);

ALTER TABLE public.seeker_public_profiles
  ADD COLUMN IF NOT EXISTS available_dates date[] NOT NULL DEFAULT '{}'
  CHECK (cardinality(available_dates) <= 60);

CREATE INDEX IF NOT EXISTS seeker_public_profiles_available_dates_idx
  ON public.seeker_public_profiles USING gin (available_dates);

COMMENT ON COLUMN public.seeker_public_profiles.available_dates IS
  'Dates the seeker is available, visible only through the consent-protected public profile.';
