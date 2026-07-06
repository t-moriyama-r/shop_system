# shop_system

## プロダクト構成

このプロダクトは将来的に以下の3つの画面群に分かれる想定で、`Front` / `Backend` / `DB` を共通のパッケージとして1つのモノレポで運用する。

| 画面群 | 概要 | 実装状況 |
| --- | --- | --- |
| SE管理画面 | システム管理者(SE)向けの管理画面。顧客(店舗)アカウントの発行・ダッシュボード等 | 実装中(`Front/app/admin` 配下) |
| 店舗管理画面 | 店舗オーナー向けの管理画面 | 未着手 |
| ユーザー予約画面 | エンドユーザー向けの予約画面 | 未着手(`Front/app/menu` 等は暫定実装) |

画面群ごとの要件定義・設計・テスト資料は `documents/<画面群名>/` 配下に格納する(例: [`documents/SE管理画面/`](documents/SE管理画面/))。運用手順(CLI等)は [`documents/運用/`](documents/運用/) 配下にまとめる。

現時点で動作確認できるのは **SE管理画面** のみ。手順は [「SE管理画面の動作確認」](#se管理画面の動作確認) を参照。

## パッケージ管理

このリポジトリはパッケージ管理に **pnpm** を使用します。npm / yarn の使用は禁止しています(`preinstall` スクリプトが `only-allow` で強制的にブロックします)。

Node.js 22 以降を使う場合、初回のみ以下を実行して Corepack を有効化してください(`packageManager` フィールドを機能させるため)。

```sh
corepack enable
```

新しくサブディレクトリ(`Front/`, `DB/` など)に `package.json` を作成する場合は、以下の `preinstall` スクリプトと `packageManager` フィールドを必ずコピーしてください。

```json
{
  "packageManager": "pnpm@11.9.0",
  "scripts": {
    "preinstall": "npx only-allow pnpm"
  }
}
```

## ローカル開発環境構築

### 構成

- `Front`: Next.js (App Router)。`http://localhost:3000`
- `Backend`: Hono + `@hono/node-server`。`http://localhost:8787`
- `DB`: Drizzle ORM のスキーマ・マイグレーション・シードを管理するパッケージ(アプリコードは持たない)
- DB 本体は PostgreSQL を Docker Compose でローカル起動する

本番環境では `.env` の `DATABASE_URL` を接続先(例: Amazon RDS for PostgreSQL)に差し替えるだけで動作する構成にしている。

### 前提条件

- Node.js 22 以降(`corepack enable` 済みであること。上記「パッケージ管理」参照)
- pnpm(`packageManager` フィールドにより `pnpm@11.9.0` に固定される)
- Docker Desktop(起動していること。インストールのみでは不可)

### セットアップ手順

```sh
# 1. 依存関係をインストール
pnpm install

# 2. 環境変数ファイルを作成(値はローカル用のデフォルトのままでよい)
cp .env.example .env

# 3. Postgres をコンテナで起動
pnpm db:up

# 4. マイグレーションを適用してテーブルを作成
pnpm db:migrate

# 5. 初期データを投入
pnpm db:seed

# 6. アプリを起動(別々のターミナルでそれぞれ実行)
pnpm dev:backend
pnpm dev:front
```

### 動作確認

- Backend: `curl http://localhost:8787/api/menu` で DB から読み出したメニュー一覧が JSON で返れば OK
- Front: ブラウザで `http://localhost:3000/menu` を開き、同じメニューが表示されれば OK

### SE管理画面の動作確認

現在実装が進んでいるのは SE管理画面(`Front/app/admin` 配下)。以下の流れで動作確認する。

1. 上記の「セットアップ手順」で Backend / Front を起動する(`pnpm db:seed` により SE管理者アカウント `admin@example.com` がパスワード未設定の状態で登録済み)。
   - 別のメールアドレスでアカウントを作りたい場合は CLI で追加する(Web 画面からの追加は不可。[`documents/運用/SE管理者アカウントCLI.md`](documents/運用/SE管理者アカウントCLI.md) 参照)。
     ```sh
     pnpm db:create-se-admin <email>
     ```
2. ブラウザで `http://localhost:3000/admin/login` を開き、メールアドレスとパスワードを入力してログインする。
   - 初回ログイン(パスワード未設定)の場合はパスワード設定画面(`/admin/password/setup`)へ自動的に遷移するので、任意のパスワードを設定する(ローカルでは `Admin1234` を使う運用にしている)。
   - 設定後はダッシュボード(`/admin/dashboard`)へ遷移し、以降は設定したパスワードで再ログインできる。
3. ダッシュボードから「顧客アカウント発行」「アカウント一覧」等の画面(`/admin/customers/new`, `/admin/accounts` 等)へ遷移して操作を確認する。

ブラウザ操作を手動で行う代わりに、CDP 接続でログインまで自動化するスクリプトもある(`e2e/login.ts`、`pnpm --filter e2e run login`)。

画面ごとの詳細な仕様は [`documents/SE管理画面/`](documents/SE管理画面/) 配下の要件定義・設計・テスト資料を参照する。

### よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm db:up` | Postgres コンテナを起動 |
| `pnpm db:down` | Postgres コンテナを停止(データは Docker ボリュームに残る) |
| `pnpm db:generate` | `DB/schema.ts` の変更からマイグレーション SQL を生成(`DB/migrations/` に追加) |
| `pnpm db:migrate` | 未適用のマイグレーションを DB に反映 |
| `pnpm db:seed` | 初期データを投入(`DB/seed.ts`) |
| `pnpm db:cleanup-sessions` | 期限切れセッションを削除(運用手順は [`documents/運用/セッションクリーンアップ.md`](documents/運用/セッションクリーンアップ.md)) |
| `pnpm db:cleanup-audit-logs` | 保持期間(1ヶ月)超過の監査ログを削除(運用手順は [`documents/運用/監査ログクリーンアップ.md`](documents/運用/監査ログクリーンアップ.md)) |
| `pnpm db:create-se-admin <email>` | SE管理者アカウントを追加(運用手順は [`documents/運用/SE管理者アカウントCLI.md`](documents/運用/SE管理者アカウントCLI.md)) |
| `pnpm db:delete-se-admin <email\|id>` | SE管理者アカウントを削除(論理削除・運用手順は [`documents/運用/SE管理者アカウントCLI.md`](documents/運用/SE管理者アカウントCLI.md)) |
| `pnpm dev:backend` | Backend を起動(ホットリロードあり) |
| `pnpm dev:front` | Front を起動(ホットリロードあり) |

### トラブルシューティング

- `docker compose up` が `open //./pipe/dockerDesktopLinuxEngine: ...` のようなエラーで失敗する
  → Docker Desktop アプリ自体が起動していない。タスクバーから起動し、クジラのアイコンが安定するまで待ってから再実行する
- `pnpm db:migrate` / `pnpm db:seed` が接続エラーになる
  → `docker compose ps` でコンテナが `healthy` になっているか確認する。起動直後は数秒かかる
- Postgres のデータを完全にリセットしたい
  → `docker compose down -v`(ボリュームごと削除)してから `pnpm db:up` → `pnpm db:migrate` → `pnpm db:seed` をやり直す
