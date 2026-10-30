CREATE OR REPLACE FUNCTION public.can_access_public_seeker_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.seeker_profiles profile
      WHERE profile.user_id = profile_user_id
        AND profile.is_public
    )
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND (
          (
            account.account_type = 'seeker'
            AND profile_user_id = (SELECT auth.uid())
          )
          OR account.account_type = 'employer'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_public_seeker_profile(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_public_seeker_profile(uuid)
  TO authenticated;

DROP POLICY IF EXISTS "Anyone can view public profiles"
  ON public.seeker_public_profiles;
DROP POLICY IF EXISTS "seeker_public_profiles_seeker_insert"
  ON public.seeker_public_profiles;
CREATE POLICY "seeker_public_profiles_seeker_insert"
  ON public.seeker_public_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.can_access_public_seeker_profile(user_id)
  );

DROP POLICY IF EXISTS "seeker_public_profiles_seeker_update"
  ON public.seeker_public_profiles;
CREATE POLICY "seeker_public_profiles_seeker_update"
  ON public.seeker_public_profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.can_access_public_seeker_profile(user_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.can_access_public_seeker_profile(user_id)
  );

DROP POLICY IF EXISTS "seeker_public_profiles_employer_read"
  ON public.seeker_public_profiles;
CREATE POLICY "seeker_public_profiles_employer_read"
  ON public.seeker_public_profiles
  FOR SELECT
  TO authenticated
  USING (public.can_access_public_seeker_profile(user_id));
