# SE管理者アカウント CLI

不正アクセスのリスクを抑えるため、SE管理者アカウントの追加・削除は Web 画面からは行わず、CLI（DB への直接書き込み）からのみ実行する（要件: FR-005 / BP-002・BP-008 備考）。

## アカウント追加

```sh
pnpm db:create-se-admin <email>
# 例
pnpm db:create-se-admin admin@example.com
```

- `se_admin_users` にレコードを追加する。作成時にランダムな初期パスワードを自動生成し、bcrypt ハッシュを `password` に保存する（空値・NULL での作成はしない）。`must_change_password` は `true` で作成され、初回ログイン後に画面（SCR-002）で初期パスワードの変更が強制される。
- 初期パスワードの平文は AWS SES 経由で本人宛にメール送信する（通知種別 `SE_ADMIN_ACCOUNT_ISSUED`）。送信ログは `se_admin_email_notification_logs` に記録する。
- メール送信に失敗した場合はアカウント作成ごとロールバックし、終了コード 1 で終了する（`audit_logs` に `SE_ADMIN_CREATE` / `FAILURE` を記録）。
- メールアドレスの形式チェックと重複チェックを行う。不正・重複の場合はエラーメッセージを表示し、終了コード 1 で終了する（レコードは作成されない）。
- 実行結果を `audit_logs` に記録する（`operator_type=cli`, `action_type=SE_ADMIN_CREATE`）。
- CLI の実体は `Backend/cli/create-se-admin.ts`（実行コマンドは従来どおり `pnpm db:create-se-admin <email>`）。

### メール送信に必要な環境変数

| 環境変数 | 内容 |
| --- | --- |
| `EMAIL_PROVIDER` | `ses` を指定すると AWS SES で送信する |
| `EMAIL_FROM_ADDRESS` | 送信元メールアドレス |
| `AWS_REGION` | SES のリージョン |

未設定の場合は ConsoleEmailSender が使われ、メール内容をコンソールに出力する（開発用動作）。

### 終了コード

| コード | 意味 |
| --- | --- |
| 0 | 追加成功 |
| 1 | 引数不足・メール形式不正・重複・メール送信失敗のいずれか |

## アカウント削除

```sh
pnpm db:delete-se-admin <email|id>
# 例（メールアドレス指定）
pnpm db:delete-se-admin admin@example.com
# 例（SE管理者ユーザーID指定）
pnpm db:delete-se-admin 123e4567-e89b-12d3-a456-426614174000
```

- 引数はメールアドレスまたは SE管理者ユーザーID（UUID）で指定する。UUID 形式なら ID、それ以外はメールアドレスとして検索する。
- **論理削除**（`is_deleted=true` / `deleted_at` を設定）で行う。物理削除はしない。
- 削除対象ユーザーの既存セッションを無効化する（`sessions` から削除）。実行後は再ログインできない。
- 対象が見つからない（存在しない、または既に論理削除済み）場合はエラーメッセージを表示し、終了コード 1 で終了する（DB は変更されない）。
- 実行結果を `audit_logs` に記録する（`operator_type=cli`, `action_type=SE_ADMIN_DELETE`）。

### 終了コード

| コード | 意味 |
| --- | --- |
| 0 | 削除成功 |
| 1 | 引数不足・対象が見つからないのいずれか |
