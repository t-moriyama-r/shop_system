# SE管理者アカウント CLI

不正アクセスのリスクを抑えるため、SE管理者アカウントの追加は Web 画面からは行わず、CLI（DB への直接書き込み）からのみ実行する（要件: FR-005 / BP-002・BP-008 備考）。

## アカウント追加

```sh
pnpm db:create-se-admin <email>
# 例
pnpm db:create-se-admin admin@example.com
```

- `se_admin_users` にレコードを追加する。`password` は NULL（パスワード未設定）で作成され、初回ログイン時に画面（SCR-002）でパスワードを設定する。
- メールアドレスの形式チェックと重複チェックを行う。不正・重複の場合はエラーメッセージを表示し、終了コード 1 で終了する（レコードは作成されない）。
- 実行結果を `audit_logs` に記録する（`operator_type=cli`, `action_type=SE_ADMIN_CREATE`）。

### 終了コード

| コード | 意味 |
| --- | --- |
| 0 | 追加成功 |
| 1 | 引数不足・メール形式不正・重複のいずれか |
