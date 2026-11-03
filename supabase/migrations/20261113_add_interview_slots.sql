BEGIN;

-- 企業が提示する面接候補日時。応募者は1つだけ選べる。
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interview_slots_application_idx
  ON public.interview_slots (application_id, starts_at);

ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.interview_slots FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.interview_slots TO authenticated;
GRANT INSERT (application_id, employer_id, starts_at) ON TABLE public.interview_slots TO authenticated;

CREATE OR REPLACE FUNCTION public.is_application_applicant(p_application_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_applications a
    WHERE a.id = p_application_id
      AND a.applicant_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_propose_interview_slot(p_application_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.owns_application(p_application_id)
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = p_application_id AND a.status = 'reviewed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.interview_slots s
      WHERE s.application_id = p_application_id AND s.is_selected
    )
    AND (
      SELECT count(*) FROM public.interview_slots s
      WHERE s.application_id = p_application_id
    ) < 5;
$$;

REVOKE ALL ON FUNCTION public.is_application_applicant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_propose_interview_slot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_application_applicant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_propose_interview_slot(uuid) TO authenticated;

DROP POLICY IF EXISTS "interview_slots_participant_read" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_owner_insert" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_owner_delete" ON public.interview_slots;

CREATE POLICY "interview_slots_participant_read"
  ON public.interview_slots FOR SELECT TO authenticated
  USING (
    (employer_id = (SELECT auth.uid()) AND public.owns_application(application_id))
    OR public.is_application_applicant(application_id)
  );

CREATE POLICY "interview_slots_owner_insert"
  ON public.interview_slots FOR INSERT TO authenticated
  WITH CHECK (
    employer_id = (SELECT auth.uid())
    AND starts_at > now()
    AND public.can_propose_interview_slot(application_id)
  );

CREATE POLICY "interview_slots_owner_delete"
  ON public.interview_slots FOR DELETE TO authenticated
  USING (
    employer_id = (SELECT auth.uid())
    AND NOT is_selected
    AND public.owns_application(application_id)
  );

-- 応募者が候補日時を1つだけ選ぶ（選択済み・過去の日時・確認前の応募は不可）
CREATE OR REPLACE FUNCTION public.select_interview_slot(p_slot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application_id uuid;
BEGIN
  SELECT s.application_id INTO v_application_id
  FROM public.interview_slots s
  JOIN public.job_applications a ON a.id = s.application_id
  WHERE s.id = p_slot_id
    AND a.applicant_id = (SELECT auth.uid())
    AND a.status = 'reviewed'
    AND s.starts_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.interview_slots x
      WHERE x.application_id = s.application_id AND x.is_selected
    );

  IF v_application_id IS NULL THEN
    RAISE EXCEPTION 'この候補日時は選べません。' USING ERRCODE = '42501';
  END IF;

  UPDATE public.interview_slots SET is_selected = true WHERE id = p_slot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_interview_slot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_interview_slot(uuid) TO authenticated;

COMMIT;
