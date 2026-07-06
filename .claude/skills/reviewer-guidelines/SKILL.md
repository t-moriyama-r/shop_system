---
name: reviewer-guidelines
description: reviewer サブエージェント固有のレビュー観点・基準をまとめたスキル。reviewer エージェントが本リポジトリでコードレビューを行う際に参照する。
---

# reviewer エージェント用ガイドライン

本リポジトリ（`shop_system`）のコードレビューで確認する観点・基準をまとめる。

## いつ使うか

- 本リポジトリの PR / 変更に対するコードレビューを行うとき

## レビュー観点

### re-export（バレル再エクスポート）が追加されていないか

`export * from './x'` / `export { foo } from './x'` のような re-export を新たに追加していないかを確認する。追加されている場合は、定義元から直接 import する形（例: `import { seAdminUsers } from 'db/schema'`）に修正を求める。

- 詳細な方針は coder 向けスキル `coder-guidelines` を参照。
- `db` パッケージの公開エントリは `DB/package.json` の `exports`（`.` = `client.ts`, `./schema` = `schema.ts`）で明示する運用。新規サブパス公開が必要な場合は `exports` へ追記されているかも確認する。

### route ハンドラ直下にサービスロジックが書かれていないか（3層構成）

Backend は route層 / handler層 / データアクセス層（`db`）の3層に分ける方針。`Backend/routes/*.ts` の route ハンドラ内に、次のようなロジックが直接書かれていないかを確認する。書かれている場合は handler 層（`Backend/handlers/*.ts`）へ切り出すよう修正を求める。

- DB クエリ組み立て（`db.select().from(...)` 等）→ データアクセス層（`db/xxx`）へ
- バリデーション（UUID/日時/必須）・分岐（自己削除判定・存在チェック）・オーケストレーション・監査ログ記録（`recordAuditLog`）→ handler 層へ

route 層に残ってよいのは、`c.req` からの生の入力取り出し・`c.json(body, status)` 整形・Cookie 反映（`applySessionCookie`）・ミドルウェア登録といった **Hono 依存の配線のみ**。handler は `HandlerResult`（`{ status, body, cookie? }`）を返し Hono 非依存であること（＝route を介さずユニットテスト可能なこと）、Cookie を直接操作せず `SessionCookieDirective` を返していることも確認する。

- 詳細な方針は coder 向けスキル `coder-guidelines`「route ハンドラ直下にサービスロジックを書かない（3層構成）」を参照。
