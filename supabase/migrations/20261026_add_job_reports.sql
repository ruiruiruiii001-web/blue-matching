CREATE TABLE IF NOT EXISTS public.job_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  job_title text NOT NULL CHECK (char_length(job_title) BETWEEN 1 AND 200),
  reason text NOT NULL CHECK (reason IN ('misleading', 'inappropriate', 'scam', 'contact', 'other')),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.job_reports FROM anon, authenticated;
GRANT ALL ON TABLE public.job_reports TO service_role;
