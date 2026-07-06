#!/bin/bash
set -euo pipefail

# Claude Code on the web(リモート実行環境)でのみ動かす。ローカルの通常セッションでは何もしない。
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# 非同期モード: 以降の処理はバックグラウンドで実行され、セッションは待たずに開始する。
echo '{"async": true, "asyncTimeout": 300000}'

cd "$CLAUDE_PROJECT_DIR"

# packageManager フィールド(pnpm@11.9.0)を有効化する。失敗しても致命的ではない。
corepack enable > /dev/null 2>&1 || true

# 依存関係をインストールする。
pnpm install
