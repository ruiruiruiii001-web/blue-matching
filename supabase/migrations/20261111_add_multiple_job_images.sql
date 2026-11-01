BEGIN;

ALTER TABLE public.published_jobs
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.published_jobs
SET image_urls = ARRAY[image_url]
WHERE cardinality(image_urls) = 0
  AND image_url IS NOT NULL
  AND btrim(image_url) <> '';

ALTER TABLE public.published_jobs
  DROP CONSTRAINT IF EXISTS published_jobs_image_urls_limit;

ALTER TABLE public.published_jobs
  ADD CONSTRAINT published_jobs_image_urls_limit
  CHECK (cardinality(image_urls) <= 5);

GRANT SELECT (image_urls) ON TABLE public.published_jobs TO anon, authenticated;
GRANT INSERT (image_urls) ON TABLE public.published_jobs TO authenticated;
GRANT UPDATE (image_urls, image_url) ON TABLE public.published_jobs TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-media', 'job-media', true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Account Upload Own Media" ON storage.objects;

CREATE POLICY "Account Upload Own Media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.account_types account
      WHERE account.user_id = (SELECT auth.uid())
        AND account.account_type IN ('employer', 'seeker')
    )
  );

COMMIT;
