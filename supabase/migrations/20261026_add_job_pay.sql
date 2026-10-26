ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS pay_type text
    CHECK (pay_type IN ('hourly', 'daily', 'monthly')),
  ADD COLUMN IF NOT EXISTS pay_amount numeric
    CHECK (pay_amount IS NULL OR pay_amount > 0);
