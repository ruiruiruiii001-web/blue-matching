-- 運営者アカウントは退会できない（退会すると admin_users も CASCADE で消えるため）
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef('public.delete_my_account()'::regprocedure) INTO def;
  IF position('Admin accounts cannot be deleted' IN def) = 0 THEN
    def := replace(
      def,
      E'  -- 自分の求人と、その求人への通報を削除',
      E'  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = uid) THEN\n    RAISE EXCEPTION ''Admin accounts cannot be deleted'';\n  END IF;\n\n  -- 自分の求人と、その求人への通報を削除'
    );
    EXECUTE def;
  END IF;
END;
$$;
