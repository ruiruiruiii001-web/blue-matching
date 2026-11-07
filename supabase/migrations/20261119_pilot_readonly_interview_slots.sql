BEGIN;

REVOKE INSERT, DELETE ON public.interview_slots FROM authenticated;
REVOKE INSERT (application_id, employer_id, starts_at) ON public.interview_slots FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.select_interview_slot(uuid) FROM authenticated;
CREATE POLICY pilot_selected_interview_only ON public.interview_slots AS RESTRICTIVE
  FOR SELECT TO authenticated USING (is_selected);

COMMIT;
