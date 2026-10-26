# blue-matching

## 求人の編集・募集状態

求人一覧から求人情報を編集し、募集終了または募集再開に切り替えられます。募集人数は「1〜3名（少人数・ピンポイント）」「4〜6名（チーム・中規模）」「7〜10名（大規模）」「11名以上（超大型・大量募集）」から選択でき、一覧と詳細に表示されます。勤務地も求人に登録でき、職種・勤務地・タグで検索できます。募集終了の求人では応募ボタンを表示しません。

### Supabase の準備

求人の募集状態と勤務地を保存するカラムを追加します。Supabase の SQL Editor で次のSQLファイルをそれぞれ一度実行してください。

- [`supabase/migrations/20261026_add_job_status.sql`](./supabase/migrations/20261026_add_job_status.sql)
- [`supabase/migrations/20261026_add_job_location.sql`](./supabase/migrations/20261026_add_job_location.sql)

編集・募集状態の更新には、Supabase の Row Level Security（RLS）で `published_jobs` の `UPDATE` が許可されている必要があります。実行後も更新に失敗する場合は、プロジェクトの認証・RLSポリシーを確認してください。公開鍵を使うページのため、無制限な更新ポリシーは設定しないでください。