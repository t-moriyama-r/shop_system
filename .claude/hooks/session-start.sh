#!/bin/bash
set -euo pipefail

# Claude Code on the web(リモート実行環境)でのみ動かす。ローカルの通常セッションでは何もしない。
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# packageManager フィールド(pnpm@11.9.0)を有効化する。失敗しても致命的ではない。
corepack enable > /dev/null 2>&1 || true

# 依存関係をインストールする。
# インストールログは stderr に流し、stdout は末尾の SessionStart JSON 出力専用にする。
pnpm install 1>&2

# セッションへ追加コンテキストを注入し、担当ブランチの PR を自動監視させる。
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"開発環境の依存関係は SessionStart フックで `pnpm install` 済みです。lint / テスト / 型チェックはそのまま実行できます(例: `pnpm --filter front lint`、`pnpm --filter front test`、`pnpm -r test`)。\n\nこのセッションが担当ブランチ上での作業で、そのブランチに紐づくオープンな Pull Request がある場合は、ユーザーが明示的に望まない旨を示さない限り、`subscribe_pr_activity` でその PR を監視対象に登録し、レビューコメントや CI 失敗に自動対応してください。PR がマージまたはクローズされたら `unsubscribe_pr_activity` で監視を終了します。"}}
JSON
