-- 求人テーブルに「働き方」を追加
ALTER TABLE published_jobs ADD COLUMN IF NOT EXISTS work_style TEXT DEFAULT 'regular'; -- 'short' or 'regular'

-- 相互評価テーブル
-- application_id は BIGINT に修正（job_applications.id と型を合わせる）
CREATE TABLE IF NOT EXISTS job_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id BIGINT REFERENCES job_applications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL, -- 評価した人
  reviewee_id UUID NOT NULL, -- 評価された人
  target_type TEXT NOT NULL, -- 'seeker' (職人への評価) or 'employer' (企業への評価)
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(application_id, target_type) -- 1つの応募につき、各方向1回ずつ
);

-- 検索を速くするためのインデックス
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON job_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_jobs_work_style ON published_jobs(work_style);
