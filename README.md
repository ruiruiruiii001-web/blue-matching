# blue-matching

## テスト運用の制限と再開方法

`PILOT_MODE` は画面表示の切り替えです。画面だけでは直接操作を防げないため、公開前に対応するデータベースの制限も適用・検証する必要があります。`20261121_pilot_restrict_feature_writes.sql` はお気に入り、フォロー、レビュー、検索条件保存、応募管理メモの利用者による読み書きを停止します。元に戻すには、各対象テーブルの `pilot_no_select`、`pilot_no_insert`、`pilot_no_update`、`pilot_no_delete` ポリシーと、レビューの `pilot_no_anon_select` ポリシーを削除します。既存データは削除しません。

`scripts/shared.js` の `PILOT_MODE` が有効な間は、応募・お仕事の確定・連絡リクエストへの返信による通知メールの送信を画面から実行しません。アカウント認証やパスワード再設定のメール設定は変更しません。新しい応募とチャットはサイト内通知と、連携済み掲載者への応募LINE通知を利用し、お仕事の確定結果は応募履歴で確認します。メール再開時は `PILOT_MODE` を無効にする前に送信設定と各通知の動作を確認してください。古い画面や直接のAPI呼び出しによるメール送信自体をサーバー側で禁止する設定ではありません。

運営者は募集の審査、通報、公式LINEとお問い合わせメールを原則1日1回確認します。通報は内容を確認して必要に応じて掲載の非表示やアカウント制限を行い、LINEやメールへの返信は手動で行います。確認頻度は目安であり、即時対応や個別の回答を保証するものではありません。協力店舗への連絡や参加者への説明を行い、テスト応募と実際の募集を区別して運用してください。

`20261122_pilot_restrict_availability.sql` は働ける日の新規登録・変更と公開プロフィールからの日付の取得を停止します。再開時は `seeker_profiles` と `seeker_public_profiles` の `pilot_restrict_availability` トリガーを削除し、同名の関数を削除したうえ、`GRANT SELECT ON public.seeker_public_profiles TO authenticated;` を実行します。

募集の共有ボタンと複製ボタンは非表示にしますが、公開URLを手動でコピーすることや、同じ内容を手入力で再投稿することは防げません。

## LINE応募通知（テスト）

掲載者は公式LINEに「連携」と送り、届いたリンクでログイン中の掲載者アカウントと連携できます。連携後の新しい応募だけを通知し、応募者名・応募本文・連絡先は送信しません。「応募・チャット」で連携状態の確認・解除ができます。LINEをブロックすると通知は届かず、ブロック解除後は未解除の連携による通知が再開します。サイト内の通知も確認してください。LINEログイン・LINE内表示・チャット通知は対象外です。

連携完了時には、LINEのトークにサイトのURLを返信します。トーク画面の常設リンクは、LINE Official Account ManagerのリッチメニューでURL `https://blue-matching-pi.vercel.app/` を設定します。既存のメニューがある場合は上書きに注意してください。リッチメニューはPC版LINEには表示されません。

解除すると通知先のLINEユーザー識別子とLINE送信履歴を削除します。ただし解除と同時に送信処理が既に始まっていた場合、最後の通知が届くことがあります。同じLINEアカウントを別の掲載者アカウントへ変更するには、元の掲載者アカウントで先に解除してください。

利用前に `supabase/migrations/20261118_add_line_application_notifications.sql` を適用し、Edge Functionsの `LINE_CHANNEL_SECRET` と `LINE_CHANNEL_ACCESS_TOKEN` を設定します。`line-webhook`、`line-link`、`line-delivery` をデプロイし、Webhookと配送ワーカーはJWT検証を無効にします。WebhookはLINE署名、配送ワーカーはVaultの専用秘密値を検証します。最後に `supabase/line-application-schedule.sql` を実行して毎分の配送を有効化します。Vaultの専用秘密値はSQL内で自動生成し、ソースには記録しません。LINE DevelopersのWebhook URLは `https://qefqlbkqewvahtqzqmfp.supabase.co/functions/v1/line-webhook` です。Webhookの検証と利用を有効化し、公式アカウントの応答設定でWebhookを利用します。LINEの通数制限や障害時には通知が失敗する場合があり、サイト内通知は常に確認してください。

pg_netの送信待ちキューにはワーカーの秘密値が一時的に平文で入ります。データベースに直接接続できるロールから読めるため、接続権限は信頼できる管理者に限定してください。連携用URLのワンタイムトークンは初回アクセス時にホスティング側のアクセスログに残る可能性があるため、ログの閲覧権限と保存期間にも注意してください。

## 募集の条件タグ

掲載情報は単発のお仕事向けです。給与は作業日当日に現金手渡しの条件で新規掲載されます。給与区分は時給・日給から選択できます。タグは未経験歓迎、交通費、服装、食事など、その募集で提供できる条件に絞り、過去の長期雇用向けタグは表示・検索対象から除外します。

募集では給与の下限・上限、資格の必須・歓迎、実務経験の条件を登録できます。これらの項目を保存するには、`supabase/migrations/20261031_add_job_pay_and_qualification_details.sql` をSupabase SQL Editorで実行してください。

募集と希望地域は地方別に都道府県を複数選び、選んだ都道府県ごとに市区町村を任意入力できます。既存の勤務地も引き続き表示・編集できます。募集・希望地域の保存にはそれぞれ500文字まで使えます。希望地域を500文字に拡張するには `supabase/migrations/20261031_expand_seeker_location_length.sql` をSupabase SQL Editorで実行してください。

募集では電話番号・LINE IDを収集せず、応募した方とはサイト内のチャットで連絡します。既存募集に保存済みの連絡先は削除せず、公開APIから読めないようにするには `supabase/migrations/20261031_secure_job_contact_details.sql` を実行してください。

## 退会（アカウント削除）

マイページ下部の「退会する」から、本人が退会できます。事前に `supabase/migrations/20261102_add_account_deletion.sql` をSupabase SQL Editorで実行してください。退会すると、プロフィール・お気に入り・通知・掲載中の求人が削除されます。応募とメッセージは相手側の履歴が壊れないよう、氏名や本文を消して「退会したユーザー」として残り、応募は終了扱いになります。

## アカウント停止と投稿数の制限

運営管理画面の通報カードから、投稿者のアカウントを停止・解除できます。停止すると、そのユーザーの求人はすべて非表示になり、求人の投稿・応募・メッセージ送信ができなくなります。解除すると、停止が理由で非表示にした求人だけ元に戻ります。運営者のアカウントは停止できません。`supabase/migrations/20261103_add_user_suspension_and_post_limits.sql` を実行してください。

また、一般ユーザーの投稿は、掲載中20件まで・24時間で新規10件までに制限されます（運営者とSQL Editorは対象外）。

## お仕事情報の共有と複製

求人の詳細に「LINEで送る」と「リンクをコピー」があり、共有リンク（`/?job=求人ID`）を開くと、その求人の詳細が直接開きます。掲載終了・非公開の求人は開けません。掲載者マイページの求人には「複製」ボタンがあり、内容をコピーした新規投稿フォームを開けます（掲載期間は新しく選びます）。

## お仕事の写真

求人ごとに写真を5枚まで登録できます。JPEG・PNG・WebP形式で1枚15MBまで選択でき、保存時にJPEG・1MB以下へ圧縮してSupabase Storageへ保存します。投稿・編集フォームでは写真の追加と削除ができ、求人カードと詳細に写真が表示されます。既存の `image_url` は移行時に引き継がれます。利用には `supabase/migrations/20261111_add_multiple_job_images.sql` をSupabase SQL Editorで実行してください。

## 掲載者プロフィール

募集管理画面の「掲載者プロフィール」から表示名・屋号、写真、対応地域、紹介文を登録できます。登録内容はお仕事の詳細に公開され、電話番号やメールアドレスはプロフィール項目にありません。初回利用時は `supabase/migrations/20261112_add_employer_public_profiles.sql` を、写真を使う場合は `supabase/migrations/20261117_add_employer_profile_photo.sql` もSupabase SQL Editorで実行してください。

## 検索条件の保存と新着の知らせ

ログイン中は、絞り込み条件を「この条件を保存」で5件まで保存できます。保存した条件は一覧の上に表示され、前回その条件を開いた後に掲載された求人があると「新着N件」と出ます。条件を押すと、その条件で絞り込み、新着の確認日時を更新します。事前に `supabase/migrations/20261104_add_saved_searches.sql` を実行してください。新着のメール通知は、メール設定（Resend独自ドメイン）と一緒に仕上げで対応します。

## 閲覧数・応募数の表示

募集管理画面の掲載カードに、閲覧数と応募数が出ます。閲覧は詳細を開いたときに同じ画面の読み込み中は1回だけ数えます（投稿者本人の閲覧は対象外）。閲覧数は投稿者だけが読めます。事前に `supabase/migrations/20261105_add_job_view_counts.sql` を実行してください。募集の取得は1000件ずつに分けて行うため、件数が増えても欠けません。一覧は10件ずつ「もっと見る」で表示します。

## 応募状況・お気に入りの表示

お仕事を探す方でログイン中は、一覧の各カードに応募状況（応募済み・お仕事確定・見送り）が出ます。お気に入りは★で表示され、一覧から追加・解除できます。「お気に入りのみ表示」「応募済みを隠す」で絞り込めます。新しいSQLは不要です。

## 作業・相談日時の調整

テスト運用中は候補日時の新規提示・削除・選択を停止し、確定済み日時のみ応募の画面に表示します。変更はチャットで相談してください。`20261119_pilot_readonly_interview_slots.sql` を適用すると、画面だけでなく直接の変更も停止します。再開時は `PILOT_MODE` を無効にし、管理者が `DROP POLICY pilot_selected_interview_only ON public.interview_slots; GRANT SELECT, DELETE ON public.interview_slots TO authenticated; GRANT INSERT (application_id, employer_id, starts_at) ON public.interview_slots TO authenticated; GRANT EXECUTE ON FUNCTION public.select_interview_slot(uuid) TO authenticated;` を実行します。

お仕事をお願いする方は、応募の画面で作業や事前相談の候補日時を最大5件まで提示できます（未来の日時のみ）。応募した方は候補から1つ選んで確定します。確定後は変更できないため、変更はメッセージで相談します。メールでの通知はResend独自ドメインの設定後に対応します。利用には `supabase/migrations/20261113_add_interview_slots.sql` をSupabase SQL Editorで実行してください。

## 運営管理画面（ユーザー・メッセージ通報）

`/admin.html` は「求人の通報」「メッセージの通報」「ユーザー」の3つのタブがあります。求人通報には運営メモを残せます。ユーザータブはメールの一部で検索でき、停止・解除と停止履歴を確認できます。応募のメッセージは、受け取った側が各メッセージの「このメッセージを通報」から通報でき（1日20件まで）、通報時の本文が運営に保存されます。事前に `supabase/migrations/20261108_admin_tools_and_message_reports.sql` をSupabase SQL Editorで実行してください。

## リリース前の仕上げ（保留中）

### 他の作業が済んでから実装する機能（依存先つき）

- 通報が来たときの運営者へのメール通知 → 依存: Resendの独自ドメイン設定
- 保存した検索条件の新着メール通知 → 依存: Resendの独自ドメイン設定
- 作業・相談日時の候補提示・調整のメール通知 → 依存: Resendの独自ドメイン設定（サイト内の調整機能自体は先行実装可）
- 応募取り消し・日時調整の運営者向けメール通知 → 依存: Resendの独自ドメイン設定
- アクセス解析（Vercel Analyticsなど） → 依存: 導入時にプライバシーポリシーへ追記、Vercelでの有効化
- バックアップ確認・エラー監視 → 依存: Supabaseの設定画面での確認（有料プランが必要な場合あり）
- 求職者へのおすすめ強化 → 依存: 公開後の利用データ（応募・閲覧の実績）
- 就業後のレビュー（相互評価）の拡充 → 依存: 通報・停止運用の定着と、不正投稿対策の設計

### 仕上げ項目

実行済みのSQL（Supabaseで一度だけ実行）: `20261106_block_admin_self_deletion.sql`（運営者は退会不可）、`20261107_block_suspended_reregistration.sql`（停止中に退会したメールのハッシュを記録し、再登録時は停止状態で開始）。

- 保存した検索条件の新着メール通知（メール設定の完了後）
- 独自ドメインの取得とVercel（Settings → Domains）への追加
- Resendの独自ドメイン設定（通知メール・確認メール）
- 新規登録の確認メールの日本語化（`supabase/email-templates/confirm-signup.html` をSupabaseのAuthentication → Emails → Confirm sign upに貼る。パスワード再設定などの他のメールも必要に応じて）
- 「Confirm email」をオンに戻す（テスト中はオフ）
- テスト用アカウント・求人の削除と、運営者パスワードの運用用への変更
- SMSによる電話番号確認と、同意に基づく電話番号共有
- 規約・プライバシー・お問い合わせの仮表記（運営者名・連絡先・制定日）の差し替え
- 公開前に、利用規約・プライバシーポリシーなどの法的文面を専門家（弁護士など）に確認してもらう

## 募集の編集・公開状態

新規登録はログイン画面とは別の「新規登録」ページで行い、「お仕事を探す方」または「お仕事をお願いする方」の区分を選びます。ログイン時に区分は選びません。区分はデータベース上で固定され、変更できません。区分は自己申告で、本人確認は行っていません。未ログイン時はお仕事一覧を閲覧できますが、応募や募集の投稿などにはログインが必要です。お仕事を探す方のプロフィール公開は初期状態でオフで、本人が明示的に選んで保存した場合だけ、ログイン中のお仕事をお願いする方が検索できます。公開プロフィールは別テーブルに分離し、氏名・電話番号・メールアドレスは検索結果に含まれません。公開する情報に個人を特定できる内容を含めないでください。

募集情報はログイン不要で閲覧できます。お気に入り保存、サイト内応募、プロフィール保存などアカウントに紐づく操作にはログインが必要です。応募は仕事の詳細から専用の応募画面に進んで送信します。応募後は当事者だけのチャットが開き、作業内容・場所・報酬などを確認してから掲載者が「お仕事を確定する」か「対応不要」を選びます。お仕事の確定前に作業を始めないでください。決済機能はなく、報酬の支払いは利用者同士で行います。

ログインすると、ヘッダーの「マイページ」からアカウント情報・ログアウト・各種管理画面を確認できます。お仕事を探す方はプロフィール・お気に入り・応募したお仕事・連絡と通知を確認できます。今日の状況は「働けます」「働けません」から選びます。初期設定では1日1回だけ確認が表示され、プロフィールを開くたびには表示されません。「今後、自動では表示しない」にチェックすると以降は自動表示されません。画面右下の固定カレンダーボタンからいつでも変更できます。設定は当日のみ有効です。登録状況はプロフィール公開に同意している場合だけ掲載者に表示されます。お仕事をお願いする方は、検索エリアで公開プロフィールを検索できます。お仕事を探す方は絞り込み条件の作業日から日付を指定できます。今日働ける人も専用の状況フィルターで絞り込めます。検索結果には公開用プロフィールの情報だけを表示し、氏名・電話番号・メールアドレスは表示しません。応募内容・チャット・状況管理は、応募者本人または該当募集の掲載者だけが閲覧できます。電話番号・メールアドレスは応募先へ共有されません。未読通知にはメッセージ本文を含めず、相手にサイト内で知らせます。通知一覧は未読を新しい順に先に表示し、既読はその下に新しい順で表示します。

お仕事を探す方のマイページでは、掲載者からの連絡本文・返信／見送り操作と各種通知を「連絡・通知」画面にまとめています。未返信の連絡または未読通知がある場合、ログイン後に案内を表示し、ボタンから同画面を直接開けます。

おすすめ順では、仕事の詳細にプロフィールの希望する仕事・地域・報酬の一致項目と参考スコアを表示します。お仕事をお願いする方は、検索エリアの「働ける人を探す」で選択した募集との一致理由と参考スコアを確認できます。応募詳細から、本人が公開に同意している場合に限り匿名プロフィールを確認できます。公開プロフィールに氏名・連絡先は含めません。

お仕事の詳細から専用の応募画面で応募できます。応募した方の名前・登録済みの経験と資格・任意メッセージが掲載者に共有され、電話番号は応募に含まれません。応募後はマイページの応募一覧とチャットが開きます。新しい応募は掲載者へのサイト内通知と、連携済みならLINEで知らせます。掲載者はチャットで条件を確認し、「お仕事を確定する」か、理由を添えて「対応不要」にできます。応募した方は進捗を応募履歴で確認してください。テスト中は通知メールを停止しています。電話番号のSMS確認および電話番号共有は未対応です。

お仕事をお願いする方のマイページでは、通知を開くと応募した方の名前・経験・資格・任意メッセージ・応募日時と会話を確認できます。応募直後から双方がチャットでき、掲載者は会話で条件を確認した後に「お仕事を確定する」か「対応不要」を選べます。対応不要の場合は理由を入力し、応募した方の履歴にも表示します。テスト中は確定の通知メールを送信しません。応募には電話番号も含まれず、応募情報は応募した方と該当募集の掲載者だけが閲覧できます。対応不要の応募は履歴を閲覧できますが、新しいメッセージは送れません。ブロックリストはプロフィール内に折りたたんで表示し、必要なら解除できます。

求人一覧では、求人ごとの囲み枠を使わず、余白・薄い区切り線・ホバー時の背景色で情報を見分けやすくします。募集状況・人数・職種・勤務地・給与を見比べやすく表示し、詳細条件は折りたたんでおき、必要なときだけ開けます。検索結果がない場合は理由と条件リセットを表示し、求人詳細では仕事内容・勤務地・給与を確認してから専用応募画面に進めます。スマートフォンでも操作しやすいボタンサイズと文字間隔にしています。未ログイン時は求人一覧だけが表示されます。

一覧には「未経験歓迎」「交通費支給」「まかないあり」のクイック条件があります。絞り込み条件の作業日から任意の日付のお仕事に絞り込めます。募集には掲載・更新日時を表示しますが、掲載者の本人確認は行っていないため、確認済みバッジは表示せず、応募前に作業内容・場所・報酬を確認するよう案内しています。各アカウントのマイページには、最初の操作を案内する使い方ガイドがあります。

マイページのテーブルを作成するには、Supabase SQL Editorで `supabase/migrations/20261026_add_user_dashboard.sql` を一度実行してください。先に `20261026_add_job_status.sql` と `20261026_secure_job_ownership.sql` を実行し、求人の `is_closed`・`owner_id` とRLSを設定する必要があります。このマイページ移行はプロフィール・お気に入り・応募履歴のテーブルを追加し、RLSにより利用者本人または該当求人の投稿者だけにアクセスを許可します。アカウント区分と匿名プロフィール機能を有効にするには、その後 `supabase/migrations/20261026_add_account_types_and_public_seekers.sql` を実行してください。企業からの連絡リクエストを有効にするには、続けて `supabase/migrations/20261026_add_seeker_contact_requests.sql` を実行してください。サイト内通知を保存するには、続けて `supabase/migrations/20261027_add_notifications.sql` をSupabase SQL Editorで実行してください。アカウント区分の選択後、既存アカウントの種類を後から変更する機能はありません。
公開プロフィール検索と公開同意のデータベース保護を有効にするには、アカウント種別・公開プロフィール移行の後に [`supabase/migrations/20261030_secure_public_seeker_search.sql`](./supabase/migrations/20261030_secure_public_seeker_search.sql) をSupabase SQL Editorで実行してください。このSQLは再実行可能で、以前の広い読み取りポリシーも削除します。非公開プロフィールの検索・読み取りを拒否し、本人が公開を許可したプロフィール項目だけをお仕事をお願いする方に表示します。掲載中の自分の募集を選ぶと、希望する仕事・地域・報酬・働き方の一致度を最大14点の参考スコアで確認し、点数順にプロフィールを並べ替えられます。経験・資格は参考情報として表示しますが、マッチ順位の判定には使いません。お仕事を探す方にもプロフィールの希望条件をおすすめ順に反映します。いずれのマッチ度も条件一致の目安であり、作業成立の可能性を判定するものではありません。

拡充した仕事・資格・働き方の選択肢を有効にするには、`supabase/migrations/20261031_expand_work_preferences.sql` をSupabase SQL Editorで実行してください。募集と公開・非公開プロフィールの希望条件を保存する列を追加し、従来の働き方・体力自信度を新しい選択肢に移行します。公開プロフィールの既存の同意・読み取り制御は変更しません。

仕事を探す方がマイページの「今日働ける」から状況を登録し、掲載者が今日働ける方に絞り込むには `supabase/migrations/20261116_add_seeker_availability_dates.sql` をSupabase SQL Editorで実行してください。公開に同意したプロフィールに限って今日の状況が掲載者へ表示され、氏名・電話番号は含まれません。
募集の始業・終業時間、休憩、残業目安、手当・待遇の詳細と、仕事を探す方の経験した作業を保存するには、上記の後に `supabase/migrations/20261031_add_job_conditions_and_experience.sql` をSupabase SQL Editorで実行してください。経験した作業の詳細は、本人が匿名プロフィールの公開に同意した場合だけ掲載者に表示されます。募集の条件は詳細に表示されます。
マイページのテーブルを作成するには、Supabase SQL Editorで `supabase/migrations/20261026_add_user_dashboard.sql` を一度実行してください。先に `20261026_add_job_status.sql` と `20261026_secure_job_ownership.sql` を実行し、求人の `is_closed`・`owner_id` とRLSを設定する必要があります。このマイページ移行はプロフィール・お気に入り・応募履歴のテーブルを追加し、RLSにより利用者本人または該当求人の投稿者だけにアクセスを許可します。アカウント区分と匿名プロフィール機能を有効にするには、その後 `supabase/migrations/20261026_add_account_types_and_public_seekers.sql` を実行してください。企業からの連絡リクエストを有効にするには、続けて `supabase/migrations/20261026_add_seeker_contact_requests.sql` を実行してください。サイト内通知を保存するには、続けて `supabase/migrations/20261027_add_notifications.sql` をSupabase SQL Editorで実行してください。アカウント区分の選択後、既存アカウントの種類を後から変更する機能はありません。

応募で電話番号を収集・共有しない運用に切り替えるには、上記の応募テーブル作成後に `supabase/migrations/20261030_remove_application_phone.sql` をSupabase SQL Editorで実行してください。この移行は応募テーブルに保存済みの応募者電話番号をすべて削除し、元に戻せません。以前プロフィールに登録された電話番号はそのまま残る場合がありますが、現在は入力・SMS確認・応募先への共有に使用していません。移行を実行してから新しい応募画面を公開してください。


求人の更新日時を表示するには、既存の求人・通知用SQL移行の後に `supabase/migrations/20261027_add_job_updated_at.sql` をSupabase SQL Editorで実行してください。求人を編集・募集終了にすると更新日時が記録されます。

登録メール通知を有効にするには、Resendで送信元ドメインを検証し、Supabase DashboardのEdge Function Secretsに `RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`APP_URL` を登録してください。独自ドメインを使う場合は、そのオリジンを `APP_ORIGIN` にも設定します。その後、Supabase CLIで `supabase functions deploy send-notification --project-ref qefqlbkqewvahtqzqmfp` を実行してください。APIキーはHTMLやGitHubへ登録しないでください。テスト中は送信を停止しており、再開前に応募・確定・連絡への返信それぞれの通知レコードとメール配信を実環境で確認してください。特に確定通知は、テストで通知レコードが見つからずメール送信が失敗したため、再開前に対応が必要です。サイト内通知はデータベース移行後に利用できます。

## 募集する方のアカウントと掲載権限

お仕事の投稿・編集・募集終了・削除には「お仕事をお願いする方」アカウントへのログインが必要です。サイトからメールアドレスとパスワードで新規登録できます。アカウント作成後に確認メールが届いた場合は、メール内のリンクを開いてからログインしてください。お仕事を探す方はログイン不要で掲載を閲覧できます。

お仕事を探す方のマイページではプロフィール・お気に入り・応募したお仕事・連絡と通知を、上部の横並びボタンで切り替えます。掲載者からの連絡本文と返信・見送り操作は通知一覧にまとめています。募集管理はお仕事をお願いする方のアカウントにのみ表示します。表示領域の高さを固定して画面上部が切り替え時にずれないようにし、閉じるボタンは右上に配置しています。ログイン画面も暗転オーバーレイで開き、お仕事の詳細など他の画面より手前に表示されます。

お仕事の検索条件は一覧と背景色・枠線・余白で分けて表示します。お仕事をお願いする方は募集を管理し、「応募・チャット」から応募内容・通知・応募した方とのメッセージを確認します。

ログイン画面の「パスワードを忘れた場合」から再設定メールを送信できます。再設定リンクは同じサイトへ戻るため、Supabase Dashboard の **Authentication → URL Configuration → Redirect URLs** に `https://blue-matching-pi.vercel.app/**` を登録してください。メール内のリンクをスマートフォンで開き、新しいパスワードを2回入力して保存します。

他の求人スキーマ移行（募集状態・勤務地・給与条件）をまだ実行していない場合は、先に「Supabase の準備」のSQLを実行し、その後に次のファイルを実行してください。この移行は `published_jobs` の既存RLSポリシーをすべて置き換え、公開読み取りと、投稿者本人に限定した作成・更新・削除を設定します。既存求人の `owner_id` は空のまま公開閲覧でき、投稿者に紐付けられないため管理操作はできません。既存求人のデータは削除されません。

- [`supabase/migrations/20261026_secure_job_ownership.sql`](./supabase/migrations/20261026_secure_job_ownership.sql)

求人の電話番号・LINE IDを公開APIから取得できないようにし、新規求人でそれらを不要にするには、求人スキーマと上記の所有権移行の後に次のSQLを実行してください。既存の電話番号・LINE IDは削除されず、APIからは取得できません。新しい画面を公開する前に実行してください。

- [`supabase/migrations/20261031_secure_job_contact_details.sql`](./supabase/migrations/20261031_secure_job_contact_details.sql)

公開登録を許可しているため、Supabase Auth のメール確認を有効にし、CAPTCHAやサインアップのレート制限も設定してください。移行SQLを実行するまでは、データベース側の権限保護は有効になりません。

### 新規登録のCAPTCHA（Cloudflare Turnstile）

1. CloudflareでTurnstileウィジェットを作成し、ドメインに `blue-matching-pi.vercel.app` を登録します。
2. 発行されたSitekeyを `index.html` の `cloudflare-turnstile-sitekey` メタタグの `content` に設定してサイトを再デプロイします。Sitekeyは公開用ですが、Secret keyはソースコードやGitHubに置かないでください。
3. Supabase Dashboardの **Authentication → Bot and Abuse Protection** でCAPTCHAを有効にし、Cloudflare Turnstileを選択してSecret keyを登録・保存します。サイト側のデプロイが完了する前にSupabase側を有効化すると、新規登録できなくなるため順番を守ってください。
4. 公開サイトでTurnstileが表示されることを確認し、CAPTCHAを完了してから新規登録できることをテストします。Turnstile確認に成功して新規登録を送信すると、Supabase AuthがSecret keyを使ってCloudflare Siteverifyをサーバー側で呼び出します。アプリのブラウザーコードからSiteverifyを直接呼び出したり、Secret keyを配置したりしないでください。

### 求人の入力チェックと通報

求人のタイトル・勤務地・給与表記などはブラウザー側で検証します。求人の電話番号・LINE IDは収集しません。通報は求人詳細から送信でき、Cloudflare Turnstileをサーバー側で検証した後、Supabaseの `job_reports` テーブルに保存します。通報機能を公開する前に、次の移行SQLをSupabase SQL Editorで実行してください。

- [`supabase/migrations/20261026_add_job_reports.sql`](./supabase/migrations/20261026_add_job_reports.sql)

Vercelのプロジェクト設定 **Settings → Environment Variables** に、Production用として次の環境変数を追加し、再デプロイしてください。値はGitHubやチャットに貼らないでください。

- `TURNSTILE_SECRET_KEY`: TurnstileのSecret key（推奨）
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`: 既存設定との互換用。`TURNSTILE_SECRET_KEY`が未設定の場合に使用
- `SUPABASE_URL`: `https://qefqlbkqewvahtqzqmfp.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabaseのサーバー専用service_role key（ブラウザー用publishable/anon keyではありません）

通報内容は運営管理画面（`/admin.html`）で確認できます。Supabase Dashboardの **Table Editor → job_reports** でも確認できます。公開ユーザーには通報一覧の読み取り・直接書き込み権限を付与せず、検証済みのサーバーAPIだけが保存します。

### 運営管理・求人の掲載期限・非表示

次の移行SQLを実行すると、求人の掲載期限（`expires_at`。既存求人は実行時から30日）、運営による非表示（`is_hidden`）、運営者の判定（`admin_users` と `is_admin()`）、通報の運営向け閲覧・更新が有効になります。**新しい画面を公開する前に実行してください**（未実行だと求人一覧の取得に失敗します）。

- [`supabase/migrations/20261101_add_job_expiry_and_moderation.sql`](./supabase/migrations/20261101_add_job_expiry_and_moderation.sql)

運営者は、実行後にSQL Editorで次のSQLを実行して登録します（`運営者のメール` を書き換え、アカウントは先に新規登録しておきます。メールアドレスをGitHubに置かないでください）。

```sql
INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users WHERE email = '運営者のメール'
ON CONFLICT DO NOTHING;
```

- 運営者でログインしたまま `/admin.html` を開くと、掲載審査、通報の確認、求人の非表示・解除、通報の「確認済み」「対応不要」の切替ができます。非表示にした求人は一覧・応募から外れ、投稿者のマイページに理由つきで表示されます。
- 掲載期間は7・14・30日から選べます。新規掲載と内容を編集した掲載は審査待ちになり、承認後に一覧・応募へ公開されます。却下された掲載は投稿者に理由を表示し、編集して再審査に出せます。過去の掲載は既存利用者への影響を避けるため公開状態を維持します。
- 期限を過ぎた掲載は一覧に出ず応募もできません。期限の3日前から投稿者のマイページに警告が出ます。延長は7・14・30日から選べ、掲載期限を今日から30日より先へ延ばすことはできません（移行時点ですでに30日より先の期限は維持されます）。
- 求人テーブルに列を足す場合は、取得列と `GRANT SELECT` の両方に追加してください。

### 地域密着の単発・お助けスキマ仕事掲示板

作業カテゴリ（イベント・農作業・ご近所や飲食店のお手伝いなど）、作業日、支払い方法は、既存の募集・応募・メッセージを残したまま追加されています。新しい募集は作業日当日の現金手渡しが前提です。一覧では今日または今週末のお仕事、カテゴリ、作業日で絞り込めます。オンライン決済は行いません。新規掲載および内容を編集した募集は審査後に公開され、過去の掲載は既存利用者への影響を避けるため公開状態が維持されます。

公開前に [`supabase/migrations/20261114_add_spot_work_and_job_approval.sql`](./supabase/migrations/20261114_add_spot_work_and_job_approval.sql) と [`supabase/migrations/20261115_allow_application_chat_before_review.sql`](./supabase/migrations/20261115_allow_application_chat_before_review.sql) を、この順番でSupabase SQL Editorで実行してください。前者は新規掲載を審査待ちにし、掲載内容の編集時も再審査に戻します。審査操作は管理者専用RPCで検証され、審査履歴は管理者以外から読めないテーブルに記録されます。後者は未確認の応募でも当事者だけがチャットを送信できるようにし、対応不要の応募への送信は引き続き禁止します。未実行のまま新しい画面を公開すると、掲載審査またはチャットが動作しません。

外部連絡先・口座貸し・高額即金を示す一部の表現には警告を出しますが、単語ベースの注意喚起であり、危険な内容の完全な検出・防止は保証しません。本人確認バッジや身分証の収集は、この段階では導入していません。

### スタイル（Tailwind CSS）

CDNは使わず、ビルド済みの `styles/tailwind.css` を読み込みます。HTMLやスクリプトでTailwindのクラスを追加・変更したら、`tools` フォルダーで `npm install`（初回のみ）と `npm run build:css` を実行し、更新された `styles/tailwind.css` もコミットしてください。

### 通知について

メール通知はResendの独自ドメイン設定が済むまで届かない場合があります。サイト内では、ヘッダーの「マイページ（未読N）」、ブラウザータブの件数、ログイン後の案内バナーで未読の通知・連絡・掲載期限の近い求人を知らせます。

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

応募を取り消す機能を有効にするには、上記の応募・RLS移行の後に `supabase/migrations/20261030_allow_application_withdrawal.sql` を実行し、続けて `supabase/migrations/20261030_delete_withdrawn_applications.sql` をSupabase SQL Editorで一度実行してください。お仕事を探す方は掲載者が確認する前の応募だけを取り消せます。取り消すと応募データ・会話・関連通知を削除し、同じ募集へ再応募できます。新しい移行では、以前の仕様で保存されていた「取り下げ済み」応募も削除します。

- [`supabase/migrations/20261030_add_application_messages.sql`](./supabase/migrations/20261030_add_application_messages.sql) — 応募した方と掲載者のサイト内メッセージ、参加者限定のRLS、相手への通知を追加します。
- [`supabase/migrations/20261030_require_reviewed_messages_and_dismissal_reason.sql`](./supabase/migrations/20261030_require_reviewed_messages_and_dismissal_reason.sql) — 当時は掲載者が応募を確認した後だけメッセージを送信可能にし、対応不要の理由を必須で保存しました。現在の送信条件は次の移行で更新されます。
- [`supabase/migrations/20261115_allow_application_chat_before_review.sql`](./supabase/migrations/20261115_allow_application_chat_before_review.sql) — 未確認の応募でも当事者だけがチャットを送信できるようにし、対応不要の応募への送信は引き続き禁止します。
- [`supabase/migrations/20261030_delete_withdrawn_applications.sql`](./supabase/migrations/20261030_delete_withdrawn_applications.sql) — お仕事を探す方による未確認応募の取り消し時に応募データ・会話・通知を削除し、既存の取り下げ済みレコードも削除します。