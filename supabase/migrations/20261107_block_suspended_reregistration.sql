BEGIN;

-- 停止中に退会したメールアドレスをハッシュ（SHA-256）で保存し、再登録時に停止状態で開始する
CREATE TABLE IF NOT EXISTS public.suspended_emails (
  email_hash text PRIMARY KEY,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 200),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suspended_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.suspended_emails FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hash_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(lower(btrim(p_email)), 'UTF8')), 'hex');
$$;

REVOKE ALL ON FUNCTION public.hash_email(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_suspended_email_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recorded_reason text;
  found boolean;
BEGIN
  SELECT true, reason INTO found, recorded_reason
  FROM public.suspended_emails
  WHERE email_hash = public.hash_email(NEW.email);

  IF found THEN
    INSERT INTO public.suspended_users (user_id, reason)
    VALUES (NEW.id, COALESCE(recorded_reason, '停止中に退会したアカウントの再登録'))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_suspended_email_on_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS apply_suspended_email_on_signup ON auth.users;
CREATE TRIGGER apply_suspended_email_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_suspended_email_on_signup();

-- 停止中のユーザーが退会するとき、メールのハッシュを記録する
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef('public.delete_my_account()'::regprocedure) INTO def;
  IF position('suspended_emails' IN def) = 0 THEN
    def := replace(
      def,
      E'  DELETE FROM auth.users WHERE id = uid;',
      E'  IF public.is_suspended(uid) THEN\n    INSERT INTO public.suspended_emails (email_hash, reason)\n    SELECT public.hash_email(u.email), s.reason\n    FROM auth.users u JOIN public.suspended_users s ON s.user_id = u.id\n    WHERE u.id = uid AND u.email IS NOT NULL\n    ON CONFLICT (email_hash) DO NOTHING;\n  END IF;\n\n  DELETE FROM auth.users WHERE id = uid;'
    );
    IF position('suspended_emails' IN def) = 0 THEN
      RAISE EXCEPTION 'delete_my_account() の置換に失敗しました';
    END IF;
    EXECUTE def;
  END IF;
END;
$$;

COMMIT;
