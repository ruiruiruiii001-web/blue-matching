BEGIN;

ALTER TABLE public.employer_public_profiles
  ADD COLUMN IF NOT EXISTS photo_url text NOT NULL DEFAULT ''
  CHECK (char_length(photo_url) <= 2048);

GRANT INSERT (user_id, display_name, service_area, introduction, photo_url)
  ON TABLE public.employer_public_profiles TO authenticated;
GRANT UPDATE (user_id, display_name, service_area, introduction, photo_url)
  ON TABLE public.employer_public_profiles TO authenticated;

COMMIT;
