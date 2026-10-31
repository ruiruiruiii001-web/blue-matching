BEGIN;

ALTER TABLE public.published_jobs
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN line DROP NOT NULL;

REVOKE SELECT ON TABLE public.published_jobs FROM PUBLIC, anon, authenticated;
REVOKE SELECT (phone, line) ON TABLE public.published_jobs FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id,
  title,
  location,
  salary,
  duties,
  capacity,
  work_style,
  work_preferences,
  start_time,
  end_time,
  break_minutes,
  overtime_details,
  allowance_details,
  pay_type,
  pay_amount,
  pay_amount_max,
  pay_condition_details,
  required_licenses,
  preferred_licenses,
  experience_requirement,
  experience_requirement_details,
  tags,
  image_url,
  owner_id,
  is_closed,
  created_at,
  updated_at
)
ON TABLE public.published_jobs
TO anon, authenticated;

COMMIT;
