-- 1. 画像保存用のストレージ作成
INSERT INTO storage.buckets (id, name, public) VALUES ('job-media', 'job-media', true) ON CONFLICT (id) DO NOTHING;

-- ストレージのセキュリティ設定 (誰でも閲覧可、認証ユーザーのみアップロード可)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'job-media');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'job-media' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'job-media' AND owner = auth.uid());

-- 2. テーブルのセキュリティ（RLS）有効化
ALTER TABLE published_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE seeker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE seeker_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_types ENABLE ROW LEVEL SECURITY;

-- 3. 求人 (published_jobs) のポリシー
CREATE POLICY "Anyone can view jobs" ON published_jobs FOR SELECT USING (true);
CREATE POLICY "Users can create jobs" ON published_jobs FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their jobs" ON published_jobs FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their jobs" ON published_jobs FOR DELETE USING (auth.uid() = owner_id);

-- 4. 応募 (job_applications) のポリシー
-- 自分の応募、または自分の求人への応募のみ閲覧可能
CREATE POLICY "Users can view relevant applications" ON job_applications FOR SELECT 
USING (auth.uid() = applicant_id OR auth.uid() IN (SELECT owner_id FROM published_jobs WHERE id::text = job_id));
CREATE POLICY "Users can submit applications" ON job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Owners can update application status" ON job_applications FOR UPDATE 
USING (auth.uid() IN (SELECT owner_id FROM published_jobs WHERE id::text = job_id));

-- 5. プロフィール (seeker_profiles)
CREATE POLICY "Owners can manage their profile" ON seeker_profiles FOR ALL USING (auth.uid() = user_id);

-- 6. 公開プロフィール (seeker_public_profiles)
CREATE POLICY "Anyone can view public profiles" ON seeker_public_profiles FOR SELECT USING (true);
CREATE POLICY "Owners can manage their public profile" ON seeker_public_profiles FOR ALL USING (auth.uid() = user_id);

-- 7. お気に入り (job_favorites)
CREATE POLICY "Users can manage their favorites" ON job_favorites FOR ALL USING (auth.uid() = user_id);

-- 8. 評価 (job_reviews)
CREATE POLICY "Anyone can view reviews" ON job_reviews FOR SELECT USING (true);
CREATE POLICY "Users can post reviews" ON job_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Reviewers can update their reviews" ON job_reviews FOR UPDATE USING (auth.uid() = reviewer_id);

-- 9. ブロック (user_blocks)
CREATE POLICY "Users can manage their blocks" ON user_blocks FOR ALL USING (auth.uid() = blocker_id);
