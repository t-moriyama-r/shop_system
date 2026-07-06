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

### route ハンドラ直下にサービスロジックを書かない（3層構成）

Backend は次の3層に分ける。route ハンドラ（`Backend/routes/*.ts` の `app.get(...)` 等の中身）に、**DB クエリ組み立て・バリデーション・分岐・オーケストレーションなどのロジックを直接書かないこと**。

1. **route 層（`Backend/routes/*.ts`）= 配線のみ**
   Hono に依存する薄い層。パス/メソッド/ミドルウェア登録、`c.req` からの生の入力取り出し（`c.req.query()` / `c.req.param()` / `await c.req.json()`）、`c.json(body, status)` での整形、Cookie の反映（`Backend/lib/http.ts` の `applySessionCookie`）だけを行う。
2. **handler 層（`Backend/handlers/*.ts`）= HTTP 非依存のロジック**
   検証（UUID/日時/必須チェック）・分岐（自己削除判定・存在チェック等）・オーケストレーション・監査ログ記録（`recordAuditLog`）を担う。**Hono に依存しない**（引数はプレーンな値、戻り値は `HandlerResult`＝`{ status, body, cookie? }`）ので、route を介さずユニットテストできる。Cookie は直接触らず `SessionCookieDirective` を返して route に委ねる。監査ログ用の IP/UA は route が `clientMeta(c)` で抽出して handler に渡す。
3. **データアクセス層（`db` パッケージ = `DB/xxx.ts`）= DB クエリ**
   `db.select()/insert()/update()/delete()` の組み立てはここに集約する。`db/xxx` サブパスを `DB/package.json` の `exports` に追加して `Backend` から利用する。CLI/バッチと API でロジックを共有できる。

- NG: route ハンドラ内で `db.select().from(...).where(and(...))` を書く／`if (typeof body.isLocked !== 'boolean') return c.json(...)` のような検証・分岐を書く
- OK: route は `const result = await listSeAdminUsersHandler({ page: c.req.query('page'), ... }); return c.json(result.body, result.status)` のように handler を呼ぶだけ。handler が検証・分岐・`listSeAdminUsers(filters)` 等のデータアクセス関数呼び出しを行う

> セッションID の採番のように「HTTP ではないがドメインの一部」の処理は handler 側で行い（`issueSession`）、その結果（Cookie に載せる値）を `HandlerResult.cookie` で route に返して route が Set-Cookie する。生成と Cookie 反映で層をまたぐ値は、handler が生成 → route が反映、の向きに統一する。

## フロントエンド（Next.js / React）実装規約

`Front/` の実装では以下を守る。`app/admin/accounts/` を基準実装として参照する。

### 1コンポーネント＝1ファイル（page ファイルを肥大化させない）

`page.tsx` に画面ロジックや子コンポーネントを全部書かない。`page.tsx` はレイアウト（`AuthenticatedLayout` 等）とコンテナの配線だけを行う薄いファイルにする。テーブル・ツールバー・ダイアログ・ページネーションなどの**子コンポーネントはそれぞれ別ファイルに切り出す**（`app/<screen>/components/*.tsx`）。

- NG: `page.tsx` の中に `AccountsContent` / `DeleteConfirmDialog` などを全部定義して 400 行になる
- OK:
  - `app/admin/accounts/page.tsx` … `AuthenticatedLayout` + `<AccountsContent />` だけ
  - `app/admin/accounts/components/AccountsContent.tsx` … 状態管理・データ取得のコンテナ
  - `app/admin/accounts/components/{SeAdminUserTable,AccountsToolbar,PaginationControls,DeleteConfirmDialog}.tsx` … 各プレゼンテーション

**ただし、そのコンポーネント内に閉じている軽微な表示片（ローディング/エラー表示、テーブル本体の分岐、行など）は、同一ファイル内に名前付きコンポーネントとして定義してよい**。別ファイルに切り出すのは再利用され得る／独立した子コンポーネント。ファイル内に閉じるものでも**必ず名前を付けて意図を明確にする**（インラインの巨大な三項演算子や即時JSXの塊を避ける）。

- NG: `SummaryPanel` の中で `{error ? <p/> : loading ? <p/> : <div>...</div>}` と分岐を全部インラインに書く
- OK: 同一ファイル内に `SummaryBody` / `SummaryCards` / `SummaryFooter` のように名前付きで分割する

### ファイル内の定義順序（コンポーネントを先頭に）

コンポーネントファイルでは**コンポーネント（特に export する主コンポーネント）をファイルの先頭に置く**。ヘルパー関数・定数・（Props 以外の）型などの非コンポーネント定義は、コンポーネントの**後（ファイル下部）にまとめる**。関数宣言と型は巻き上げ（hoisting）されるため、下部に定義しても上部のコンポーネントから参照できる。ただし後述のとおり **Props 型はその対応コンポーネントの直上に置く**（例外）。

- NG: `systemStatusLabel()` などのヘルパー関数や定数をファイル先頭に置き、コンポーネントを下に書く
- OK: 先頭から `SummaryPanel` → 子コンポーネント群 → `// 以下、コンポーネント以外の定義` の区切り → 型 / 定数 / ヘルパー関数

### Props は名前付き `type` で、対応コンポーネントの直上に定義する

コンポーネントの props 型は**インラインのオブジェクト型注釈にせず、名前付きの `type` として、その対応するコンポーネントの直上に定義する**。

- **そのファイルのコア（主に export する）コンポーネントの Props 型名は `Props` でよい**（ファイル名＝コンポーネント名から自明なため冗長な接頭辞を付けない）
- 同一ファイル内のサブコンポーネントは名前が衝突するため、`ActivityRowProps` のように `<コンポーネント名>Props` とする
- 配置は各コンポーネントの**直上**（ファイル下部にまとめない）

- NG: `function ActivitiesPanel({ activities }: { activities: ShopAccountActivity[]; loading: boolean }) {`（インライン注釈）
- NG: コアコンポーネントに `ActivitiesPanelProps` のような冗長名を付ける
- OK:
  ```tsx
  type Props = {
    activities: ShopAccountActivity[]
    loading: boolean
    // ...
  }

  export function ActivitiesPanel({ activities, loading }: Props) { ... }

  type ActivityRowProps = { activity: ShopAccountActivity }

  function ActivityRow({ activity }: ActivityRowProps) { ... }
  ```

### API 呼び出しは repository 層に置く（page/component 配下に書かない）

fetch を伴う API 呼び出しと、それに対応するドメイン型は、**特定の画面配下（`app/<screen>/`）ではなく、画面から切り離した repository 層 `lib/repositories/*.ts` に定義する**。同じ API が複数ページから呼ばれ得るため、責務をコンポーネントツリーの下に置かない。

- NG: `app/admin/accounts/api.ts` に `fetchSeAdminUsers` を置く（accounts 画面に責務が閉じてしまう）
- OK: `lib/repositories/se-admin-users.ts` に `fetchSeAdminUsers` / `unlockSeAdminUser` / `deleteSeAdminUser` と型（`SeAdminUser` / `Pagination`）を定義し、`lib/repositories/session.ts` に `fetchCurrentUser` を定義。各コンポーネントは `@/lib/repositories/...` から import する
- repository 関数は React 非依存の純粋関数にする（`useQuery`/`useMutation` の `queryFn`/`mutationFn` から呼ぶ）

### プロジェクト全体で使う設定値は上位レイヤーに一元化する

API のベースURLのような**プロジェクト全体に関わる定数を各ファイルで再定義しない**。単一の定義元（`lib/config.ts` の `API_BASE_URL`）を作り、そこから import する。

- NG: 複数ファイルで `const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'` を各自定義
- OK: `lib/config.ts` に `export const API_BASE_URL = ...` を置き、`import { API_BASE_URL } from '@/lib/config'` で参照（`lib/api.ts` の Hono クライアントも同じ定義を使う）

### コンポーネントのファイル名はパスカルケースにする

React コンポーネントを定義するファイル名は**パスカルケース（PascalCase）**にする。ケバブケース（kebab-case）にしない。ファイル名はエクスポートするコンポーネント名と一致させる。

- NG: `accounts-content.tsx` / `delete-confirm-dialog.tsx` / `admin-header.tsx`
- OK: `AccountsContent.tsx` / `DeleteConfirmDialog.tsx` / `AdminHeader.tsx`
- 例外: Next.js App Router の予約ファイル（`page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx` / `route.ts` など）はフレームワーク規約に従い小文字のまま。コンポーネントを定義しない純粋なユーティリティ/設定モジュール（例: `lib/config.ts`、`lib/repositories/se-admin-users.ts`）はキャメル/ケバブ等の従来命名でよい

### `useState` にはジェネリクスを明示する

`useState<T>(initial)` のように**必ず型引数を明示する**。初期値からの型推論に任せない（`useState('')` は `string`、`useState(0)` は `number` に推論されるが、明示する）。

- NG: `const [page, setPage] = useState(1)` / `const [sort, setSort] = useState('createdAt:desc')`
- OK: `const [page, setPage] = useState<number>(1)` / `const [sort, setSort] = useState<string>('createdAt:desc')`

### データ取得は自前実装せず TanStack Query を使う

`useEffect` + `fetch` + `useState` でローディング/エラー/データを手組みしない。**サーバ状態は `@tanstack/react-query` の `useQuery` / `useMutation` で扱う**。ローディング・エラー・キャッシュ・再取得は Query に任せる。`QueryClientProvider` は `app/providers.tsx`（`app/layout.tsx` で全体をラップ）で提供済み。

- 一覧取得は `useQuery({ queryKey: ['se-admin-users', { page, sort, keyword }], queryFn })`。ページ切替時に前ページを保持したい場合は `placeholderData: (prev) => prev`
- 更新系（削除・ロック解除）は `useMutation`。成功後は `queryClient.invalidateQueries({ queryKey: [...] })` で再取得する
- NG: `useEffect(() => { fetch(...).then(setItems).catch(setError) }, [...])`
- OK: `const { data, isLoading, isError } = useQuery({ queryKey, queryFn })`

### 長い副作用を書かない・ロジックは関数に分ける

`useEffect` の中に長い処理を直接書かない。副作用が必要なら短く保ち、**具体的な処理は名前付き関数に切り出す**。特に `fetch` の組み立ては `api.ts` の純粋関数（`fetchSeAdminUsers` / `deleteSeAdminUser` など、React 非依存でユニットテスト可能）に分離し、コンポーネントからはそれを呼ぶだけにする。TanStack Query 採用により、通常はデータ取得目的の `useEffect` は不要になる。
