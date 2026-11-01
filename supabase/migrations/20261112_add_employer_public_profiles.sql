BEGIN;

CREATE TABLE IF NOT EXISTS public.employer_public_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 100),
  service_area text NOT NULL DEFAULT '' CHECK (char_length(service_area) <= 300),
  introduction text NOT NULL DEFAULT '' CHECK (char_length(introduction) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employer_public_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.employer_public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.employer_public_profiles TO anon, authenticated;
GRANT INSERT (user_id, display_name, service_area, introduction)
  ON TABLE public.employer_public_profiles TO authenticated;
GRANT UPDATE (user_id, display_name, service_area, introduction)
  ON TABLE public.employer_public_profiles TO authenticated;

DROP POLICY IF EXISTS "employer_public_profiles_public_read" ON public.employer_public_profiles;
DROP POLICY IF EXISTS "employer_public_profiles_owner_insert" ON public.employer_public_profiles;
DROP POLICY IF EXISTS "employer_public_profiles_owner_update" ON public.employer_public_profiles;

CREATE POLICY "employer_public_profiles_public_read"
  ON public.employer_public_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "employer_public_profiles_owner_insert"
  ON public.employer_public_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  );

CREATE POLICY "employer_public_profiles_owner_update"
  ON public.employer_public_profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
  );

CREATE OR REPLACE FUNCTION public.set_employer_public_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employer_public_profiles_set_updated_at ON public.employer_public_profiles;
CREATE TRIGGER employer_public_profiles_set_updated_at
  BEFORE UPDATE ON public.employer_public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employer_public_profile_updated_at();

COMMIT;
