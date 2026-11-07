CREATE FUNCTION public.pilot_restrict_availability()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' AND cardinality(NEW.available_dates) > 0 THEN
      RAISE EXCEPTION 'テスト運用中は働ける日の登録を利用できません。' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.available_dates IS DISTINCT FROM OLD.available_dates THEN
      RAISE EXCEPTION 'テスト運用中は働ける日の変更を利用できません。' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pilot_restrict_availability() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pilot_restrict_availability
BEFORE INSERT OR UPDATE ON public.seeker_profiles
FOR EACH ROW EXECUTE FUNCTION public.pilot_restrict_availability();
CREATE TRIGGER pilot_restrict_availability
BEFORE INSERT OR UPDATE ON public.seeker_public_profiles
FOR EACH ROW EXECUTE FUNCTION public.pilot_restrict_availability();

REVOKE SELECT ON public.seeker_public_profiles FROM authenticated;
REVOKE SELECT (available_dates) ON public.seeker_public_profiles FROM authenticated;
GRANT SELECT (user_id, job_type, location, pay_type, minimum_salary, licenses, exp_years,
  stamina, updated_at, avatar_url, work_preferences, experience_details)
  ON public.seeker_public_profiles TO authenticated;
