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

### route ハンドラ直下にサービスロジックが書かれていないか

`Backend/routes/*.ts` の route ハンドラ内に、DB クエリ組み立て・フィルタ条件構築・集計などのサービス／ビジネスロジックが直接書かれていないかを確認する。書かれている場合は、`db` パッケージのデータアクセス関数（`DB/se-admin.ts` / `DB/sessions.ts` と同流儀）へ切り出し、route は HTTP 入出力（パース・バリデーション・整形）に限定する形に修正を求める。

- バリデーションや `400` 判定など HTTP の関心事は route 側に残してよい。
- 詳細な方針は coder 向けスキル `coder-guidelines`「route ハンドラ直下にサービスロジックを書かない」を参照。
- 既存 route（`auth.ts` / `se-admin-users.ts` 等）は規約導入前の実装でインラインクエリが残っており、別 issue でのリファクタリング対象。新規・改修分について本観点を確認する。
