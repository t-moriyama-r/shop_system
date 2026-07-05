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
