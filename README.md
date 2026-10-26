# blue-matching

## 求人の編集・募集状態

新規登録時に求職者または企業・親方のアカウント種類を選びます。既存アカウントはログイン後に種類を選択します。既存求人を管理する場合は企業・親方を選んでください。種類はデータベース上で固定され、変更できません。企業確認は行わない自己申告区分です。求職者はプロフィールを企業向けに公開するか選べます。公開プロフィールは個人情報を含まない別テーブルに分離し、企業アカウントに希望職種・勤務地・給与・資格・経験・アピールだけを表示します。名前と電話番号は企業に公開しません。

ログインすると、求職者はプロフィール・お気に入り・応募履歴をマイページで確認できます。企業向け画面の企業マイページから、自分が掲載した求人を確認・編集し、公開に同意された匿名プロフィールを閲覧できます。求職者マイページはプロフィール・お気に入り・自分の求人・応募履歴をメニューで切り替えて表示します。プロフィールの非公開情報は本人だけが閲覧でき、公開プロフィールは企業アカウントだけが閲覧できます。応募履歴は応募者本人または該当求人の企業アカウントだけが閲覧できます。求人カードまたは詳細画面の☆ボタンでお気に入りに登録でき、一覧をお気に入りだけに絞り込めます。求職者プロフィールに希望職種を登録すると、求人の職種名・仕事内容へのキーワード一致をおすすめ順に反映します。希望勤務地は入力地域の一致、次に都道府県の一致を優先し、距離計算は行いません。希望給与区分・最低額は求人検索条件に反映され、おすすめ順にも反映されます。求人一覧は募集中のみの表示、勤務地・募集人数・給与区分・最低給与額での絞り込み、おすすめ順・新着順・給与額順・募集人数が少ない順の並び替えに対応します。求人登録では給与表記に加え、絞り込み用の給与区分と金額を任意で登録できます。タグは複数選択でき、選択したタグのいずれかを含む求人に絞り込みます。募集終了の求人では応募ボタンを表示しません。

求人詳細には、既存のLINE・電話・SMS連絡に加えてサイト内応募フォームがあります。サイト内フォームからの応募だけがマイページの履歴に記録され、応募者の氏名・電話番号・経験・資格は該当求人の投稿者に共有されます。現在、応募通知メールは送信されないため、投稿者はマイページで応募を確認してください。外部アプリで行った連絡は記録されません。

サイトを開くと求職者向け画面が最初に表示され、求人一覧がプロフィールより上に表示されます。

マイページのテーブルを作成するには、Supabase SQL Editorで `supabase/migrations/20261026_add_user_dashboard.sql` を一度実行してください。先に `20261026_add_job_status.sql` と `20261026_secure_job_ownership.sql` を実行し、求人の `is_closed`・`owner_id` とRLSを設定する必要があります。このマイページ移行はプロフィール・お気に入り・応募履歴のテーブルを追加し、RLSにより利用者本人または該当求人の投稿者だけにアクセスを許可します。アカウント区分と匿名プロフィール機能を有効にするには、その後 `supabase/migrations/20261026_add_account_types_and_public_seekers.sql` を実行してください。アカウント区分の選択後、既存アカウントの種類を後から変更する機能はありません。

## 事業者アカウントと求人の権限

求人の投稿・編集・募集終了・削除には事業者アカウントへのログインが必要です。サイトからメールアドレスとパスワードで新規登録できます。アカウント作成後に確認メールが届いた場合は、メール内のリンクを開いてからログインしてください。求職者の求人閲覧はログイン不要です。

ログイン画面の「パスワードを忘れた場合」から再設定メールを送信できます。再設定リンクは同じサイトへ戻るため、Supabase Dashboard の **Authentication → URL Configuration → Redirect URLs** に `https://blue-matching-pi.vercel.app/**` を登録してください。メール内のリンクをスマートフォンで開き、新しいパスワードを2回入力して保存します。

他の求人スキーマ移行（募集状態・勤務地・給与条件）をまだ実行していない場合は、先に「Supabase の準備」のSQLを実行し、その後に次のファイルを実行してください。この移行は `published_jobs` の既存RLSポリシーをすべて置き換え、公開読み取りと、投稿者本人に限定した作成・更新・削除を設定します。既存求人の `owner_id` は空のまま公開閲覧でき、投稿者に紐付けられないため管理操作はできません。既存求人のデータは削除されません。

- [`supabase/migrations/20261026_secure_job_ownership.sql`](./supabase/migrations/20261026_secure_job_ownership.sql)

公開登録を許可しているため、Supabase Auth のメール確認を有効にし、CAPTCHAやサインアップのレート制限も設定してください。移行SQLを実行するまでは、データベース側の権限保護は有効になりません。

### 新規登録のCAPTCHA（Cloudflare Turnstile）

1. CloudflareでTurnstileウィジェットを作成し、ドメインに `blue-matching-pi.vercel.app` を登録します。
2. 発行されたSitekeyを `index.html` の `cloudflare-turnstile-sitekey` メタタグの `content` に設定してサイトを再デプロイします。Sitekeyは公開用ですが、Secret keyはソースコードやGitHubに置かないでください。
3. Supabase Dashboardの **Authentication → Bot and Abuse Protection** でCAPTCHAを有効にし、Cloudflare Turnstileを選択してSecret keyを登録・保存します。サイト側のデプロイが完了する前にSupabase側を有効化すると、新規登録できなくなるため順番を守ってください。
4. 公開サイトでTurnstileが表示されることを確認し、CAPTCHAを完了してから新規登録できることをテストします。Turnstile確認に成功して新規登録を送信すると、Supabase AuthがSecret keyを使ってCloudflare Siteverifyをサーバー側で呼び出します。アプリのブラウザーコードからSiteverifyを直接呼び出したり、Secret keyを配置したりしないでください。

### 求人の入力チェックと通報

求人のタイトル・電話番号・給与表記・連絡先URLなどはブラウザー側で検証します。通報は求人詳細から送信でき、Cloudflare Turnstileをサーバー側で検証した後、Supabaseの `job_reports` テーブルに保存します。通報機能を公開する前に、次の移行SQLをSupabase SQL Editorで実行してください。

- [`supabase/migrations/20261026_add_job_reports.sql`](./supabase/migrations/20261026_add_job_reports.sql)

Vercelのプロジェクト設定 **Settings → Environment Variables** に、Production用として次の環境変数を追加し、再デプロイしてください。値はGitHubやチャットに貼らないでください。

- `CLOUDFLARE_TURNSTILE_SECRET_KEY`: TurnstileのSecret key
- `SUPABASE_URL`: `https://qefqlbkqewvahtqzqmfp.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabaseのサーバー専用service_role key（ブラウザー用publishable/anon keyではありません）

通報内容はSupabase Dashboardの **Table Editor → job_reports** で確認できます。公開ユーザーには通報一覧の読み取り・直接書き込み権限を付与せず、検証済みのサーバーAPIだけが保存します。

### 確認メールをResendから送る（標準メール上限の回避）

Supabase標準メール送信はテスト向けで送信数が非常に限られます。Resendを使うには、送信元として使える独自ドメインを用意し、Resendにドメインを追加してDNSのSPF/DKIMレコードを設定・検証します。Vercelの `vercel.app` ドメインは送信者ドメインとして使えません。

1. ResendでAPI keyを作成し、ドメインをVerifiedにします。API keyはSupabase SMTPのパスワードとしてだけ設定し、共有しないでください。
2. Supabase Dashboardの **Authentication → Email → SMTP Settings** を開いて、Custom SMTPを有効にします。
3. 次を入力して保存します。
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: ResendのAPI key
   - Sender email: Resendで検証したドメイン上のアドレス（例: `auth@あなたのドメイン`）
   - Sender name: `blue-matching`
4. テスト登録または確認メール送信を一度だけ行い、受信できることを確認します。送信上限はResendの契約・アカウント状態にも従います。

### Supabase の準備

求人の募集状態、勤務地、給与条件を保存するカラムを追加します。Supabase の SQL Editor で次のSQLファイルをそれぞれ一度実行してください。

- [`supabase/migrations/20261026_add_job_status.sql`](./supabase/migrations/20261026_add_job_status.sql)
- [`supabase/migrations/20261026_add_job_location.sql`](./supabase/migrations/20261026_add_job_location.sql)
- [`supabase/migrations/20261026_add_job_pay.sql`](./supabase/migrations/20261026_add_job_pay.sql)