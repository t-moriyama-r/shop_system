---
name: reviewer-guidelines
description: reviewer サブエージェント固有のレビュー観点・基準をまとめたスキル。reviewer エージェントが本リポジトリでコードレビューを行う際に参照する。
---

# reviewer エージェント用ガイドライン

## いつ使うか

- 本リポジトリの PR / 変更に対するコードレビューを行うとき

## レビュー基準の正本

レビューで確認すべき実装規約（re-export 禁止、Backend の3層構成、Front の実装規約など）は以下に一元化されている。レビュー前に必ず参照すること。

- `Backend/CLAUDE.md`（`Backend/`, `DB/` の変更: re-export 禁止、route/handler/データアクセスの3層構成に沿っているか）
- `Front/AGENTS.md`（`Front/` の変更: コンポーネント分割、Props の置き方、repository 層、TanStack Query などに沿っているか）

## reviewer エージェントとしての作業方針

- 変更対象ディレクトリに対応する規約ファイル（上記）と差分を突き合わせ、逸脱があれば指摘する。
- 指摘する際は、該当する規約ファイルのどの項目に反しているかを明示する。
