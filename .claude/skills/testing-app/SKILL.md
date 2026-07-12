---
name: testing-app
description: shop_system をローカルで起動して動作確認・テストするための汎用手順。環境の立ち上げ、ユニットテスト実行、DB確認、テストアカウント、ブラウザでのログインを自動化するスクリプトの使い方をまとめる。SE管理画面に限らず、アプリを実際に動かして確認する作業全般で使用する。
---

# アプリ動作確認・テスト手順（汎用）

アプリを実際に起動して確認・テストするときの共通手順。特定画面の手順は書かず、
「どうやって環境を立ち上げ、何を使って確認するか」に絞る。

## 環境の立ち上げ

Node.js 22 以降 + pnpm（`corepack enable` 済み）が前提。詳細は README 参照。

```bash
pnpm install
cp .env.example .env      # 未作成の場合のみ
pnpm db:up                # PostgreSQL(Docker) 起動
pnpm db:migrate           # マイグレーション適用
pnpm db:seed              # 初期データ投入
pnpm dev:backend          # Backend  → http://localhost:8787
pnpm dev:front            # Front    → http://localhost:3000
```

- 起動確認: `curl http://localhost:8787/api/health` が `{"status":"ok"}` を返す
- DB を完全リセットしたいとき: `docker compose down -v` → 上記の up/migrate/seed をやり直す

## ユニットテスト

```bash
pnpm test                 # 全パッケージ (pnpm -r test)
pnpm --filter backend test
pnpm --filter front test
```

## テストアカウント

seed（`DB/seed.ts`）で投入される SE 管理者アカウント:

- メールアドレス: `admin@example.com`
- パスワード: 初期パスワード `Admin1234`（シーダーが設定。`must_change_password=true` のため、初回ログイン後はパスワード変更画面へ強制遷移し、変更が必要）

パスワード変更後は新しいパスワードが DB に保存される。やり直したいときは DB をリセットする。

## ブラウザでのログイン自動化（トークン節約）

管理画面をブラウザで手動確認する前に、以下を実行するとログイン済みの状態を作れる。
起動中の Chrome に CDP 経由で接続し、ログイン（初回はパスワード変更も）を自動化する。
実行後はブラウザにセッションが残るので、そのまま手動操作を続けられる。

```bash
pnpm --filter e2e run login
```

環境変数で対象を上書きできる（既定値は上記テストアカウント / ローカル URL）:

```bash
EMAIL=admin@example.com PASSWORD=Admin1234 \
BASE_URL=http://localhost:3000 CDP_URL=http://localhost:29229 \
pnpm --filter e2e run login
```

スクリプト本体: `e2e/login.ts`。認証フローが変わったらここを更新する。

## DB の中身を確認する

監査ログなど DB を直接見たいときは Docker 経由で psql を使う（コンテナ名は `docker compose ps` で確認）。

```bash
docker exec -i shop_system-postgres-1 psql -U kojin_pos -d kojin_pos \
  -c "SELECT action_type, result, detail, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;"
```

接続情報は `.env`（`POSTGRES_USER` / `POSTGRES_DB` / `DATABASE_URL`）に従う。
