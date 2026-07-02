# API仕様書

> バージョン: 1 | 更新日時: 2026/7/1 23:21:47

## 項目 1

- **endpoint:** /api/auth/login
- **method:** POST
- **summary:** SE管理者ログイン
- **説明:** メールアドレスとパスワードで認証を行い、セッションを開始する。パスワード未設定（is_password_set=false）の場合はパスワード設定画面へのリダイレクト指示を返す。連続失敗5回でアカウントをロックする。
- **カテゴリ:** 認証
- **relatedScreen:** ログイン画面
**auth:**

- required: false
- type: なし
- permissions: 

**pathParameters:**


**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Content-Type | true | application/json |

**requestBody:**

- contentType: application/json
- fields: [object Object],[object Object]
- example: [object Object]

**responses:**

- 200: [object Object]
- 400: [object Object]
- 401: [object Object]
- 403: [object Object]
- 500: [object Object]

- **備考:** 認証成功時はaudit_logsにLOGIN_SUCCESSを記録。失敗時はLOGIN_FAILUREを記録。failed_login_countが5回に達した場合はis_lockedをTRUEに更新しACCOUNT_LOCKを記録する。※要確認（ロック回数閾値・セッションタイムアウト時間）

## 項目 2

- **endpoint:** /api/auth/logout
- **method:** POST
- **summary:** SE管理者ログアウト
- **説明:** 現在のセッションを破棄し、ログイン画面へのリダイレクトを促す。セッションテーブルから該当レコードを削除する。
- **カテゴリ:** 認証
- **relatedScreen:** 管理画面共通ヘッダー
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 500: [object Object]

- **備考:** audit_logsにLOGOUT_SUCCESSを記録する。CookieのセッションIDを無効化する。

## 項目 3

- **endpoint:** /api/auth/password
- **method:** POST
- **summary:** SE管理者パスワード初回設定
- **説明:** DBに直接追加されたSE管理者がパスワードを初回設定する。is_password_set=falseのアカウントのみ利用可能。設定完了後はis_password_setをTRUEに更新する。
- **カテゴリ:** 認証
- **relatedScreen:** パスワード設定画面（FR-005）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |
| Content-Type | true | application/json |

**requestBody:**

- contentType: application/json
- fields: [object Object],[object Object]
- example: [object Object]

**responses:**

- 200: [object Object]
- 400: [object Object]
- 401: [object Object]
- 409: [object Object]
- 500: [object Object]

- **備考:** audit_logsにSE_ADMIN_PASSWORD_SETを記録する。bcrypt等でハッシュ化して保存する。※要確認（パスワードポリシーの詳細）

## 項目 4

- **endpoint:** /api/auth/session
- **method:** GET
- **summary:** 現在のセッション情報取得
- **説明:** Cookieのセッションを検証し、現在ログイン中のSE管理者情報を返す。フロントエンドの認証状態確認やページリロード時のセッション復元に使用する。
- **カテゴリ:** 認証
- **relatedScreen:** 全管理画面共通
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 500: [object Object]

- **備考:** セッションのexpiresAtをスライディングウィンドウ方式で延長する場合は、このAPIの呼び出しごとに更新する。※要確認（セッション延長方針）

## 項目 5

- **endpoint:** /api/dashboard/summary
- **method:** GET
- **summary:** ダッシュボード用システムサマリー情報取得
- **説明:** ダッシュボードトップ画面に表示するシステムの稼働状態サマリー情報を返す。顧客アカウント発行数の統計等を含む。二次開発での拡張を想定した最小限の実装。
- **カテゴリ:** ダッシュボード
- **relatedScreen:** ダッシュボード画面（FR-007, FR-008）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 500: [object Object]

- **備考:** ※要確認（systemStatusの詳細定義はドメイン知識が未提供のため未定義。二次開発での拡張を前提とした最小実装）

## 項目 6

- **endpoint:** /api/dashboard/shop-account-activities
- **method:** GET
- **summary:** ダッシュボード用顧客アカウント発行状況一覧取得
- **説明:** ダッシュボードに表示する直近の顧客アカウント発行処理状況（ステータス、発行者、発行日時等）の一覧を返す。エラー発生時はdetailリンクへの情報も含む。
- **カテゴリ:** ダッシュボード
- **relatedScreen:** ダッシュボード画面（FR-007, FR-009）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**

| name | type | required | default | 説明 |
| --- | --- | --- | --- | --- |
| limit | number | false | 10 | 取得件数（最新N件） |

**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 500: [object Object]

- **備考:** shop_accountsとemail_notification_logsをJOINして最新の送信ステータスを付与する。※要確認（ダッシュボード上のエラー詳細へのリンク仕様）

## 項目 7

- **endpoint:** /api/shop-accounts
- **method:** GET
- **summary:** ショップアカウント一覧取得
- **説明:** 登録済みショップアカウントの一覧をページネーション・フィルタ・ソート付きで返す。論理削除済み（is_deleted=true）のアカウントはデフォルトで除外する。
- **カテゴリ:** 顧客アカウント
- **relatedScreen:** 顧客アカウント一覧画面（※要確認：明示的な一覧画面の定義なし）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**

| name | type | required | default | 説明 |
| --- | --- | --- | --- | --- |
| page | number | false | 1 | ページ番号 |
| limit | number | false | 20 | 1ページあたりの件数 |
| sort | string | false | createdAt:desc | ソート項目（例: createdAt:desc, shopName:asc） |
| status | string | false |  | アカウントステータスでフィルタ（active/pending/suspended） |
| keyword | string | false |  | ショップ名またはメールアドレスでのキーワード部分一致検索 |
| includeDeleted | boolean | false | false | 論理削除済みアカウントを含めるか |

**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 500: [object Object]

- **備考:** is_deleted=falseのレコードをデフォルト対象とする。

## 項目 8

- **endpoint:** /api/shop-accounts
- **method:** POST
- **summary:** ショップアカウント新規発行
- **説明:** 新規顧客アカウントを作成する。バリデーション・重複チェック後にshop_accountsテーブルへ登録し、アカウント発行完了通知メールの送信をトリガーする。
- **カテゴリ:** 顧客アカウント
- **relatedScreen:** 顧客アカウント新規発行画面（FR-010, FR-011, FR-012）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |
| Content-Type | true | application/json |

**requestBody:**

- contentType: application/json
- fields: [object Object],[object Object],[object Object]
- example: [object Object]

**responses:**

- 201: [object Object]
- 400: [object Object]
- 401: [object Object]
- 409: [object Object]
- 500: [object Object]

- **備考:** 登録成功後、email_notification_logsにPENDINGレコードを作成し、バックグラウンドでメール送信処理を実行する。audit_logsにSHOP_ACCOUNT_CREATEを記録する。issued_by_se_admin_user_idにはセッションのSE管理者IDをセットする。※要確認（初期パスワードの生成・送付方式）

## 項目 9

- **endpoint:** /api/shop-accounts/{shopAccountId}
- **method:** GET
- **summary:** ショップアカウント詳細取得
- **説明:** 指定されたショップアカウントIDの詳細情報を返す。メール送信ログ情報も含む。
- **カテゴリ:** 顧客アカウント
- **relatedScreen:** 顧客アカウント詳細画面（※要確認：明示的な詳細画面の定義なし）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**

| name | type | required | 説明 |
| --- | --- | --- | --- |
| shopAccountId | string(UUID) | true | ショップアカウントID |

**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 404: [object Object]
- 500: [object Object]

- **備考:** is_deleted=trueのレコードは404を返す。※要確認（削除済みアカウントの閲覧可否）

## 項目 10

- **endpoint:** /api/shop-accounts/{shopAccountId}/status
- **method:** PATCH
- **summary:** ショップアカウントステータス更新
- **説明:** 指定されたショップアカウントのステータス（active/pending/suspended）を更新する。
- **カテゴリ:** 顧客アカウント
- **relatedScreen:** 顧客アカウント詳細画面（※要確認：ステータス変更操作画面の定義なし）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**

| name | type | required | 説明 |
| --- | --- | --- | --- |
| shopAccountId | string(UUID) | true | ショップアカウントID |

**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |
| Content-Type | true | application/json |

**requestBody:**

- contentType: application/json
- fields: [object Object]
- example: [object Object]

**responses:**

- 200: [object Object]
- 400: [object Object]
- 401: [object Object]
- 404: [object Object]
- 500: [object Object]

- **備考:** audit_logsにステータス変更を記録する。※要確認（ステータス遷移ルールの詳細）

## 項目 11

- **endpoint:** /api/shop-accounts/{shopAccountId}/notification/resend
- **method:** POST
- **summary:** ショップアカウント発行通知メール再送信
- **説明:** メール送信に失敗したショップアカウントに対して、アカウント発行完了通知メールを手動で再送信する。
- **カテゴリ:** 顧客アカウント
- **relatedScreen:** ダッシュボード画面 / 顧客アカウント詳細画面（FR-009）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**

| name | type | required | 説明 |
| --- | --- | --- | --- |
| shopAccountId | string(UUID) | true | ショップアカウントID |

**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 404: [object Object]
- 409: [object Object]
- 500: [object Object]

- **備考:** email_notification_logsに新たなPENDINGレコードを作成してバックグラウンド送信をトリガーする。※要確認（再送信可能な条件・回数上限・リトライ方針）

## 項目 12

- **endpoint:** /api/shop-accounts/{shopAccountId}/notification-logs
- **method:** GET
- **summary:** ショップアカウントのメール送信ログ一覧取得
- **説明:** 指定したショップアカウントに紐づくメール送信ログ（送信ステータス、送信日時、エラー情報等）の一覧を返す。
- **カテゴリ:** 顧客アカウント
- **relatedScreen:** 顧客アカウント詳細画面 / ダッシュボードエラー詳細（FR-009）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**

| name | type | required | 説明 |
| --- | --- | --- | --- |
| shopAccountId | string(UUID) | true | ショップアカウントID |

**queryParameters:**

| name | type | required | default | 説明 |
| --- | --- | --- | --- | --- |
| page | number | false | 1 | ページ番号 |
| limit | number | false | 20 | 1ページあたりの件数 |

**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 404: [object Object]
- 500: [object Object]

- **備考:** createdAt降順で返す。※要確認（エラーログの詳細レベルおよび画面遷移仕様）

## 項目 13

- **endpoint:** /api/se-admin-users
- **method:** GET
- **summary:** SE管理者ユーザー一覧取得
- **説明:** 登録済みのSE管理者ユーザー一覧を返す。削除済み（is_deleted=true）はデフォルトで除外する。アカウント削除画面での一覧表示に使用する。
- **カテゴリ:** SE管理者
- **relatedScreen:** SE管理者アカウント削除画面（FR-006）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**

| name | type | required | default | 説明 |
| --- | --- | --- | --- | --- |
| page | number | false | 1 | ページ番号 |
| limit | number | false | 20 | 1ページあたりの件数 |
| sort | string | false | createdAt:desc | ソート項目（例: createdAt:desc, email:asc） |
| keyword | string | false |  | メールアドレスでのキーワード部分一致検索 |
| isLocked | boolean | false |  | ロック状態でフィルタ |

**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 500: [object Object]

- **備考:** password_hashフィールドはレスポンスに含めない。

## 項目 14

- **endpoint:** /api/se-admin-users/{seAdminUserId}
- **method:** DELETE
- **summary:** SE管理者アカウント論理削除
- **説明:** 指定されたSE管理者アカウントを論理削除する。is_deletedをTRUEに設定し、deleted_atに現在日時を記録する。自分自身のアカウントは削除不可。
- **カテゴリ:** SE管理者
- **relatedScreen:** SE管理者アカウント削除画面（FR-006）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**

| name | type | required | 説明 |
| --- | --- | --- | --- |
| seAdminUserId | string(UUID) | true | 削除対象のSE管理者ユーザーID |

**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 403: [object Object]
- 404: [object Object]
- 500: [object Object]

- **備考:** 論理削除（is_deleted=TRUE、deleted_at=現在日時）を行う。該当ユーザーの既存セッションも同時に無効化する。audit_logsにSE_ADMIN_DELETEを記録する。※要確認（物理削除か論理削除かの最終方針）

## 項目 15

- **endpoint:** /api/se-admin-users/{seAdminUserId}/lock
- **method:** PATCH
- **summary:** SE管理者アカウントのロック状態変更
- **説明:** 指定されたSE管理者アカウントのロック状態を手動で変更する（ロック解除、または手動ロック）。ロック解除時はfailed_login_countも0にリセットする。
- **カテゴリ:** SE管理者
- **relatedScreen:** SE管理者アカウント削除画面（FR-006）※要確認（ロック解除専用画面の有無）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**

| name | type | required | 説明 |
| --- | --- | --- | --- |
| seAdminUserId | string(UUID) | true | 対象のSE管理者ユーザーID |

**queryParameters:**


**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |
| Content-Type | true | application/json |

**requestBody:**

- contentType: application/json
- fields: [object Object]
- example: [object Object]

**responses:**

- 200: [object Object]
- 401: [object Object]
- 404: [object Object]
- 500: [object Object]

- **備考:** audit_logsにACCOUNT_UNLOCKまたはACCOUNT_LOCKを記録する。※要確認（ロック解除権限の制限有無）

## 項目 16

- **endpoint:** /api/audit-logs
- **method:** GET
- **summary:** 監査ログ一覧取得
- **説明:** システム操作の監査ログ一覧をページネーション・フィルタ付きで返す。ダッシュボードのエラー詳細確認や運用監査に使用する。
- **カテゴリ:** 監査ログ
- **relatedScreen:** ダッシュボード画面エラー詳細（FR-009）※要確認（専用ログ閲覧画面の有無）
**auth:**

- required: true
- type: Session Cookie
- permissions: 

**pathParameters:**


**queryParameters:**

| name | type | required | default | 説明 |
| --- | --- | --- | --- | --- |
| page | number | false | 1 | ページ番号 |
| limit | number | false | 50 | 1ページあたりの件数 |
| sort | string | false | createdAt:desc | ソート項目（例: createdAt:desc） |
| actionType | string | false |  | 操作種別でフィルタ（例: LOGIN_FAILURE, SHOP_ACCOUNT_CREATE） |
| result | string | false |  | 操作結果でフィルタ（SUCCESS/FAILURE/ERROR） |
| seAdminUserId | string | false |  | 操作者のSE管理者IDでフィルタ |
| targetType | string | false |  | 操作対象リソース種別でフィルタ（例: shop_account） |
| targetId | string | false |  | 操作対象リソースIDでフィルタ |
| dateFrom | string | false |  | ログ作成日時の範囲開始（ISO8601形式） |
| dateTo | string | false |  | ログ作成日時の範囲終了（ISO8601形式） |

**requestHeaders:**

| name | required | 説明 |
| --- | --- | --- |
| Cookie | true | sessionId={セッションID} |

**responses:**

- 200: [object Object]
- 401: [object Object]
- 500: [object Object]

- **備考:** audit_logsテーブルはUPDATE・DELETE不可（改ざん防止）のため、このAPIはGETのみ。保持期間1年間のデータを対象とする。※要確認（改ざん防止の実装方針）
