-- 求人とプロフィールに写真URLを追加する移行SQL
-- Supabase SQL Editor で実行してください

-- 1. 掲載求人に写真カラムを追加
ALTER TABLE published_jobs ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. 求職者プロフィールに写真カラムを追加
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. 公開プロフィールにも写真カラムを追加
ALTER TABLE seeker_public_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
