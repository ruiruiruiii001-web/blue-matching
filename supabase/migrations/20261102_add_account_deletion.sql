-- 退会（アカウント削除）
-- 求人は削除し、応募・メッセージは相手側の履歴が壊れないよう匿名化して残す。

ALTER TABLE public.job_applications
  ALTER COLUMN applicant_id DROP NOT NULL;

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_applicant_id_fkey;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_applicant_id_fkey
  FOREIGN KEY (applicant_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.application_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.application_messages
  DROP CONSTRAINT IF EXISTS application_messages_sender_id_fkey;

ALTER TABLE public.application_messages
  ADD CONSTRAINT application_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 自分の求人と、その求人への通報を削除
  DELETE FROM public.job_reports
  WHERE job_id IN (
    SELECT id::text FROM public.published_jobs WHERE owner_id = uid
  );
  DELETE FROM public.job_favorites
  WHERE job_id IN (
    SELECT id::text FROM public.published_jobs WHERE owner_id = uid
  );
  DELETE FROM public.published_jobs WHERE owner_id = uid;

  -- 自分の応募は匿名化し、以降のやり取りを終了する
  UPDATE public.job_applications
  SET applicant_name = '退会したユーザー',
      experience = '',
      licenses = '{}',
      message = '',
      status = 'dismissed',
      dismissal_reason = '応募者が退会しました'
  WHERE applicant_id = uid;

  UPDATE public.application_messages
  SET body = '（退会したユーザーのメッセージは削除されました）'
  WHERE sender_id = uid;

  IF to_regclass('public.job_reviews') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.job_reviews WHERE reviewer_id = $1 OR reviewee_id = $1'
    USING uid;
  END IF;

  -- プロフィール・お気に入り・通知・ブロック等は外部キーのCASCADEで削除される
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
