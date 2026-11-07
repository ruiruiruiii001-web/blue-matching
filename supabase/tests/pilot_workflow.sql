BEGIN;

INSERT INTO auth.users (id) VALUES
  ('e2434fd6-1c77-4669-8908-a971c38b024a'),
  ('39ad2a7e-552b-46c9-b33e-a341db6f0ee9'),
  ('09fa7a7f-75ee-4a63-b9ef-039355bfe5ce');
INSERT INTO public.account_types (user_id, account_type) VALUES
  ('e2434fd6-1c77-4669-8908-a971c38b024a', 'employer'),
  ('39ad2a7e-552b-46c9-b33e-a341db6f0ee9', 'seeker');
INSERT INTO public.admin_users (user_id) VALUES ('09fa7a7f-75ee-4a63-b9ef-039355bfe5ce');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e2434fd6-1c77-4669-8908-a971c38b024a', true);
INSERT INTO public.published_jobs (id, owner_id, title, moderation_status, work_date)
OVERRIDING SYSTEM VALUE VALUES
  (-123456789, 'e2434fd6-1c77-4669-8908-a971c38b024a', 'Pilot test', 'pending', current_date);

RESET ROLE;
UPDATE public.published_jobs SET moderation_status = 'approved' WHERE id = -123456789;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '39ad2a7e-552b-46c9-b33e-a341db6f0ee9', true);
INSERT INTO public.job_applications (id, applicant_id, job_id, job_title, applicant_name)
VALUES ('cd918fe0-2b82-42cc-97e2-745e0e95d8ad', '39ad2a7e-552b-46c9-b33e-a341db6f0ee9', '-123456789', 'Pilot test', 'Test seeker');
INSERT INTO public.application_messages (application_id, sender_id, body)
VALUES ('cd918fe0-2b82-42cc-97e2-745e0e95d8ad', '39ad2a7e-552b-46c9-b33e-a341db6f0ee9', 'Test message');

SELECT set_config('request.jwt.claim.sub', 'e2434fd6-1c77-4669-8908-a971c38b024a', true);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.job_applications WHERE id = 'cd918fe0-2b82-42cc-97e2-745e0e95d8ad') OR
     NOT EXISTS (SELECT 1 FROM public.application_messages WHERE application_id = 'cd918fe0-2b82-42cc-97e2-745e0e95d8ad') THEN
    RAISE EXCEPTION 'Employer cannot read the application and chat';
  END IF;
  BEGIN
    PERFORM public.admin_pilot_overview();
    RAISE EXCEPTION 'Non-admin accessed overview';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
UPDATE public.job_applications SET status = 'reviewed'
WHERE id = 'cd918fe0-2b82-42cc-97e2-745e0e95d8ad';
INSERT INTO public.application_messages (application_id, sender_id, body)
VALUES ('cd918fe0-2b82-42cc-97e2-745e0e95d8ad', 'e2434fd6-1c77-4669-8908-a971c38b024a', 'Test reply');

SELECT set_config('request.jwt.claim.sub', '09fa7a7f-75ee-4a63-b9ef-039355bfe5ce', true);
DO $$
DECLARE
  overview jsonb;
  application jsonb;
BEGIN
  overview := public.admin_pilot_overview();
  SELECT item INTO application FROM jsonb_array_elements(overview->'applications') item
  WHERE item->>'job_title' = 'Pilot test';
  IF application IS NULL OR application->>'status' <> 'reviewed' OR
     application ?| ARRAY['applicant_id', 'applicant_name', 'message'] THEN
    RAISE EXCEPTION 'Unexpected admin application data';
  END IF;
END;
$$;
SELECT set_config('request.jwt.claim.sub', '39ad2a7e-552b-46c9-b33e-a341db6f0ee9', true);
SELECT public.delete_my_account();
SELECT set_config('request.jwt.claim.sub', 'e2434fd6-1c77-4669-8908-a971c38b024a', true);
SELECT public.delete_my_account();
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN
    ('39ad2a7e-552b-46c9-b33e-a341db6f0ee9', 'e2434fd6-1c77-4669-8908-a971c38b024a')) THEN
    RAISE EXCEPTION 'Account deletion failed';
  END IF;
END;
$$;
ROLLBACK;
