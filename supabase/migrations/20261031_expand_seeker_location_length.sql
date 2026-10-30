ALTER TABLE public.seeker_profiles
  DROP CONSTRAINT IF EXISTS seeker_profiles_location_check,
  DROP CONSTRAINT IF EXISTS seeker_profiles_location_length_check,
  ADD CONSTRAINT seeker_profiles_location_length_check
    CHECK (char_length(location) <= 500);

ALTER TABLE public.seeker_public_profiles
  DROP CONSTRAINT IF EXISTS seeker_public_profiles_location_check,
  DROP CONSTRAINT IF EXISTS seeker_public_profiles_location_length_check,
  ADD CONSTRAINT seeker_public_profiles_location_length_check
    CHECK (char_length(location) <= 500);
