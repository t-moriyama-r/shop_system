# プロジェクト共通メモリ

## Pull Request の自動監視

Claude Code on the web で作業する際、担当ブランチに紐づくオープンな Pull Request がある場合は、ユーザーが明示的に望まない旨を示さない限り、`subscribe_pr_activity` でその PR を監視対象に登録し、レビューコメントや CI 失敗に自動対応すること。PR がマージまたはクローズされたら `unsubscribe_pr_activity` で監視を終了する。

### レビュー指摘への返信は必ずスレッド返信で行う（厳守）

レビューコメント（特定ファイル・行に紐づくコメント）への対応報告は、**必ずそのコメントのスレッドに対する返信**として行うこと。PR 全体へのコメント（`add_issue_comment`）で代替してはならない。

手順:

1. webhook で届く通知にはコメント ID が含まれないため、`pull_request_read`（method: `get_review_comments`）で対象コメントの数値 ID を取得する。
2. `add_reply_to_pull_request_comment`（`commentId` に上記 ID、`pullNumber` に PR 番号）でそのスレッドに返信する。
3. 1 つのレビューコメントには 1 つのスレッド返信で対応する（複数指摘をまとめて PR 全体コメントにしない）。

> この指示は SessionStart フックが非同期モードのため `additionalContext` では届かない。全セッションで確実に反映させるためここ（ルートの CLAUDE.md）に記載している。

## 開発環境

依存関係は SessionStart フック（`.claude/hooks/session-start.sh`）が `pnpm install` で用意する。lint / テスト / 型チェックはそのまま実行できる。

- lint: `pnpm --filter front lint`
- テスト: `pnpm --filter front test`（全体は `pnpm -r test`）
- 型チェック: `Front` 配下で `npx tsc --noEmit`
