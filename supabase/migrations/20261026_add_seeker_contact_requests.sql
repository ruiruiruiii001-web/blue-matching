CREATE TABLE IF NOT EXISTS public.seeker_contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_message text NOT NULL CHECK (char_length(btrim(employer_message)) BETWEEN 1 AND 1000),
  seeker_reply text CHECK (seeker_reply IS NULL OR char_length(btrim(seeker_reply)) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT seeker_contact_requests_no_self_contact CHECK (seeker_id <> employer_id),
  CONSTRAINT seeker_contact_requests_response_consistent CHECK (
    (status = 'pending' AND seeker_reply IS NULL AND responded_at IS NULL)
    OR
    (status = 'responded' AND seeker_reply IS NOT NULL AND responded_at IS NOT NULL)
    OR
    (status = 'declined' AND responded_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS seeker_contact_requests_pair_idx
  ON public.seeker_contact_requests (seeker_id, employer_id);

CREATE INDEX IF NOT EXISTS seeker_contact_requests_seeker_created_idx
  ON public.seeker_contact_requests (seeker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seeker_contact_requests_employer_created_idx
  ON public.seeker_contact_requests (employer_id, created_at DESC);

ALTER TABLE public.seeker_contact_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seeker_contact_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.seeker_contact_requests TO authenticated;
GRANT UPDATE (status, seeker_reply, responded_at) ON TABLE public.seeker_contact_requests TO authenticated;

DROP POLICY IF EXISTS "seeker_contact_requests_participant_read" ON public.seeker_contact_requests;
DROP POLICY IF EXISTS "seeker_contact_requests_employer_insert" ON public.seeker_contact_requests;
DROP POLICY IF EXISTS "seeker_contact_requests_seeker_respond" ON public.seeker_contact_requests;

CREATE POLICY "seeker_contact_requests_participant_read"
  ON public.seeker_contact_requests
  FOR SELECT
  TO authenticated
  USING (
    (
      seeker_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.account_types account
        WHERE account.user_id = (SELECT auth.uid())
          AND account.account_type = 'seeker'
      )
    )
    OR
    (
      employer_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.account_types account
        WHERE account.user_id = (SELECT auth.uid())
          AND account.account_type = 'employer'
      )
    )
  );

CREATE POLICY "seeker_contact_requests_employer_insert"
  ON public.seeker_contact_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employer_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'employer'
    )
    AND EXISTS (
      SELECT 1
      FROM public.seeker_public_profiles profile
      WHERE profile.user_id = seeker_id
    )
  );

CREATE POLICY "seeker_contact_requests_seeker_respond"
  ON public.seeker_contact_requests
  FOR UPDATE
  TO authenticated
  USING (
    seeker_id = (SELECT auth.uid())
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
  )
  WITH CHECK (
    seeker_id = (SELECT auth.uid())
    AND status IN ('responded', 'declined')
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type = 'seeker'
    )
  );
