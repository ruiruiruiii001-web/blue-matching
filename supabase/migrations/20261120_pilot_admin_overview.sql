CREATE FUNCTION public.admin_pilot_overview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION '権限がありません。' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'employer_count', (SELECT count(*) FROM public.account_types WHERE account_type = 'employer'),
    'job_count', (SELECT count(*) FROM public.published_jobs),
    'application_count', (SELECT count(*) FROM public.job_applications),
    'employers', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data)) FROM (
        SELECT COALESCE(p.display_name, '表示名未登録') AS name,
          (SELECT count(*) FROM public.published_jobs j WHERE j.owner_id = a.user_id) AS job_count
        FROM public.account_types a
        LEFT JOIN public.employer_public_profiles p ON p.user_id = a.user_id
        WHERE a.account_type = 'employer'
        ORDER BY p.display_name NULLS LAST, a.user_id
        LIMIT 100
      ) row_data
    ), '[]'::jsonb),
    'jobs', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data)) FROM (
        SELECT j.title, COALESCE(p.display_name, '表示名未登録') AS employer,
          j.moderation_status, j.is_closed, j.created_at
        FROM public.published_jobs j
        LEFT JOIN public.employer_public_profiles p ON p.user_id = j.owner_id
        ORDER BY j.created_at DESC, j.id DESC LIMIT 100
      ) row_data
    ), '[]'::jsonb),
    'applications', COALESCE((
      SELECT jsonb_agg(to_jsonb(row_data)) FROM (
        SELECT a.job_title, COALESCE(p.display_name, '表示名未登録') AS employer,
          a.status, a.created_at
        FROM public.job_applications a
        LEFT JOIN public.published_jobs j ON j.id::text = a.job_id
        LEFT JOIN public.employer_public_profiles p ON p.user_id = j.owner_id
        ORDER BY a.created_at DESC, a.id DESC LIMIT 100
      ) row_data
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pilot_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pilot_overview() TO authenticated;
