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
