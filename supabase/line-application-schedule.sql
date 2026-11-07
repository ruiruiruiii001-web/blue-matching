CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'line_application_worker_secret'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'line_application_worker_secret'
    );
  END IF;
END;
$$;

SELECT cron.schedule(
  'line-application-delivery',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://qefqlbkqewvahtqzqmfp.supabase.co/functions/v1/line-delivery',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-worker-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'line_application_worker_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$
);
