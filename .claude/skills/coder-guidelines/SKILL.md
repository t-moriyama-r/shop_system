---
name: coder-guidelines
description: coder サブエージェント固有のコーディング規約・実装方針をまとめたスキル。coder エージェントが本リポジトリで実装タスクに着手する際に参照する。
---

# coder エージェント用ガイドライン

本リポジトリで実装を行う際に守るコーディング規約・方針をまとめる。

## いつ使うか

- 本リポジトリ（`shop_system`）で機能追加・修正・リファクタリング等の実装を行うとき
- 特に `import` / `export` の書き方、パッケージ間の依存の張り方を判断するとき

## コーディング規約

### re-export（バレル再エクスポート）を禁止する

`export * from './x'` や `export { foo } from './x'` のような **re-export（再エクスポート）を新たに追加しないこと**。シンボルは定義元モジュールから直接 import する。

- NG: `DB/client.ts` に `export * from './schema'` を追加し、利用側が `import { seAdminUsers } from 'db'` で参照する
- OK: 利用側が定義元から直接 import する
  - DB クライアント: `import { db } from 'db'`
  - スキーマ（テーブル定義）: `import { seAdminUsers, sessions } from 'db/schema'`

`db` パッケージは公開エントリを `package.json` の `exports` で明示している。

```jsonc
// DB/package.json
"exports": {
  ".": "./client.ts",        // db インスタンス（import { db } from 'db'）
  "./schema": "./schema.ts"  // テーブル定義（import { ... } from 'db/schema'）
}
```

新しいモジュール（例: `DB/sessions.ts`, `DB/se-admin.ts`）を追加した場合も、`client.ts` へ re-export を足さず、利用側（CLI スクリプトやテスト）から相対 import で直接参照する。

- 例: `DB/create-se-admin.ts` は `import { createSeAdmin } from './se-admin'`
- 例: `DB/cleanup-sessions.ts` は `import { deleteExpiredSessions } from './sessions'`

新しく `db/xxx` のようなサブパスを外部（`Backend` 等）へ公開する必要がある場合は、`DB/package.json` の `exports` にエントリを追加する。

### route ハンドラ直下にサービスロジックを書かない

Hono の route ハンドラ（`Backend/routes/*.ts` の `app.get(...)` 等の中身）に、**DB クエリ組み立て・ビジネスロジックを直接書かないこと**。route はあくまで HTTP の入出力（クエリ/ボディのパース・バリデーション・レスポンス整形・ステータスコード決定）に専念し、データアクセスやドメインロジックは別レイヤの関数に切り出して呼び出す。

- NG: route ハンドラ内で `db.select().from(...).where(and(...))` のようなクエリ組み立てや、フィルタ条件の構築・集計処理をそのまま記述する
- OK: `listAuditLogs(filters)` のようなデータアクセス関数を用意し、route からはそれを呼ぶだけにする

切り出し先は、既存の `DB/se-admin.ts`（`createSeAdmin`/`deleteSeAdmin`）や `DB/sessions.ts`（`deleteExpiredSessions`）と同じく **`db` パッケージのデータアクセス関数**とする（`db/xxx` サブパスを `DB/package.json` の `exports` に追加して `Backend` から利用する）。これにより CLI/バッチと API でロジックを共有でき、ユニットテストも route を介さず関数単体で書ける。

- 例: `Backend/routes/audit-logs.ts` は入力のパース/バリデーションのみ行い、`listAuditLogs({ actionType, result, ... , page, limit })` を呼んで結果を整形して返す
- バリデーション（UUID 形式チェック等）や `400` の判定は HTTP の関心事なので route 側に残してよい

> 補足: 既存の route（`auth.ts` / `se-admin-users.ts` 等）はこの規約導入前の実装でインラインクエリが残っている。これらは別途リファクタリングで移行する方針（該当 issue を参照）。新規・改修時は本規約に従うこと。
