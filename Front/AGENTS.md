# Front 実装規約

`Front/` の実装では以下を守る。`app/admin/accounts/` を基準実装として参照する。

## 1コンポーネント＝1ファイル（page ファイルを肥大化させない）

`page.tsx` に画面ロジックや子コンポーネントを全部書かない。`page.tsx` はレイアウト（`AuthenticatedLayout` 等）とコンテナの配線だけを行う薄いファイルにする。テーブル・ツールバー・ダイアログ・ページネーションなどの**子コンポーネントはそれぞれ別ファイルに切り出す**（`app/<screen>/components/*.tsx`）。

- NG: `page.tsx` の中に `AccountsContent` / `DeleteConfirmDialog` などを全部定義して 400 行になる
- OK:
  - `app/admin/accounts/page.tsx` … `AuthenticatedLayout` + `<AccountsContent />` だけ
  - `app/admin/accounts/components/AccountsContent.tsx` … 状態管理・データ取得のコンテナ
  - `app/admin/accounts/components/{SeAdminUserTable,AccountsToolbar,PaginationControls,DeleteConfirmDialog}.tsx` … 各プレゼンテーション

**ただし、そのコンポーネント内に閉じている軽微な表示片（ローディング/エラー表示、テーブル本体の分岐、行など）は、同一ファイル内に名前付きコンポーネントとして定義してよい**。別ファイルに切り出すのは再利用され得る／独立した子コンポーネント。ファイル内に閉じるものでも**必ず名前を付けて意図を明確にする**（インラインの巨大な三項演算子や即時JSXの塊を避ける）。

- NG: `SummaryPanel` の中で `{error ? <p/> : loading ? <p/> : <div>...</div>}` と分岐を全部インラインに書く
- OK: 同一ファイル内に `SummaryBody` / `SummaryCards` / `SummaryFooter` のように名前付きで分割する

## ファイル内の定義順序（コンポーネントを先頭に）

コンポーネントファイルでは**コンポーネント（特に export する主コンポーネント）をファイルの先頭に置く**。ヘルパー関数・定数・（Props 以外の）型などの非コンポーネント定義は、コンポーネントの**後（ファイル下部）にまとめる**。関数宣言と型は巻き上げ（hoisting）されるため、下部に定義しても上部のコンポーネントから参照できる。ただし後述のとおり **Props 型はその対応コンポーネントの直上に置く**（例外）。

- NG: `systemStatusLabel()` などのヘルパー関数や定数をファイル先頭に置き、コンポーネントを下に書く
- OK: 先頭から `SummaryPanel` → 子コンポーネント群 → 型 / 定数 / ヘルパー関数（区切りコメントは付けない）

## Props は名前付き `type` で、対応コンポーネントの直上に定義する

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

## API 呼び出しは repository 層に置く（page/component 配下に書かない）

fetch を伴う API 呼び出しと、それに対応するドメイン型は、**特定の画面配下（`app/<screen>/`）ではなく、画面から切り離した repository 層 `lib/repositories/*.ts` に定義する**。同じ API が複数ページから呼ばれ得るため、責務をコンポーネントツリーの下に置かない。

- NG: `app/admin/accounts/api.ts` に `fetchSeAdminUsers` を置く（accounts 画面に責務が閉じてしまう）
- OK: `lib/repositories/se-admin-users.ts` に `fetchSeAdminUsers` / `unlockSeAdminUser` / `deleteSeAdminUser` と型（`SeAdminUser` / `Pagination`）を定義し、`lib/repositories/session.ts` に `fetchCurrentUser` を定義。各コンポーネントは `@/lib/repositories/...` から import する
- repository 関数は React 非依存の純粋関数にする（`useQuery`/`useMutation` の `queryFn`/`mutationFn` から呼ぶ）

## プロジェクト全体で使う設定値は上位レイヤーに一元化する

API のベースURLのような**プロジェクト全体に関わる定数を各ファイルで再定義しない**。単一の定義元（`lib/config.ts` の `API_BASE_URL`）を作り、そこから import する。

- NG: 複数ファイルで `const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'` を各自定義
- OK: `lib/config.ts` に `export const API_BASE_URL = ...` を置き、`import { API_BASE_URL } from '@/lib/config'` で参照（`lib/api.ts` の Hono クライアントも同じ定義を使う）

## コンポーネントのファイル名はパスカルケースにする

React コンポーネントを定義するファイル名は**パスカルケース（PascalCase）**にする。ケバブケース（kebab-case）にしない。ファイル名はエクスポートするコンポーネント名と一致させる。

- NG: `accounts-content.tsx` / `delete-confirm-dialog.tsx` / `admin-header.tsx`
- OK: `AccountsContent.tsx` / `DeleteConfirmDialog.tsx` / `AdminHeader.tsx`
- 例外: Next.js App Router の予約ファイル（`page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx` / `route.ts` など）はフレームワーク規約に従い小文字のまま。コンポーネントを定義しない純粋なユーティリティ/設定モジュール（例: `lib/config.ts`、`lib/repositories/se-admin-users.ts`）はキャメル/ケバブ等の従来命名でよい

## `useState` にはジェネリクスを明示する

`useState<T>(initial)` のように**必ず型引数を明示する**。初期値からの型推論に任せない（`useState('')` は `string`、`useState(0)` は `number` に推論されるが、明示する）。

- NG: `const [page, setPage] = useState(1)` / `const [sort, setSort] = useState('createdAt:desc')`
- OK: `const [page, setPage] = useState<number>(1)` / `const [sort, setSort] = useState<string>('createdAt:desc')`

## データ取得は自前実装せず TanStack Query を使う

`useEffect` + `fetch` + `useState` でローディング/エラー/データを手組みしない。**サーバ状態は `@tanstack/react-query` の `useQuery` / `useMutation` で扱う**。ローディング・エラー・キャッシュ・再取得は Query に任せる。`QueryClientProvider` は `app/Providers.tsx`（`app/layout.tsx` で全体をラップ）で提供済み。

- 更新系（削除・ロック解除）は `useMutation`。成功後は `queryClient.invalidateQueries({ queryKey: [...] })` で再取得する
- NG: `useEffect(() => { fetch(...).then(setItems).catch(setError) }, [...])`
- OK: `const { data, isPending, isError } = useQuery(dashboardSummaryQuery())`

## クエリキー・queryOptions は repository 層に集約する

`queryKey` を**コンポーネント内にベタ書きしない**。同じデータを別ページから取得する場合や、更新後に `invalidateQueries` でキャッシュを無効化する場合に、キーが一致していないと意図しない挙動になる。**キーと `queryFn` を repository 層（`lib/repositories/*.ts`）に集約する**。

- クエリキーは**キーファクトリ**として定義する（例: `export const dashboardKeys = { all: ['dashboard'] as const, summary: () => [...dashboardKeys.all, 'summary'] as const, activities: (limit: number) => [...] }`）
- `queryKey` と `queryFn` を束ねた **`queryOptions` ファクトリ**を repository に置き、コンポーネントは `useQuery(dashboardSummaryQuery())` のように呼ぶだけにする
- 無効化は同じキーファクトリを使う（例: `queryClient.invalidateQueries({ queryKey: dashboardKeys.all })`）
- NG: `useQuery({ queryKey: ['dashboard', 'summary'], queryFn: fetchDashboardSummary })` をコンポーネントに直接書く
- OK: `lib/repositories/dashboard.ts` に `dashboardKeys` と `dashboardSummaryQuery()` / `shopAccountActivitiesQuery(limit)` を置き、コンポーネントは `useQuery(dashboardSummaryQuery())`

## 長い副作用を書かない・ロジックは関数に分ける

`useEffect` の中に長い処理を直接書かない。副作用が必要なら短く保ち、**具体的な処理は名前付き関数に切り出す**。特に `fetch` の組み立ては `api.ts` の純粋関数（`fetchSeAdminUsers` / `deleteSeAdminUser` など、React 非依存でユニットテスト可能）に分離し、コンポーネントからはそれを呼ぶだけにする。TanStack Query 採用により、通常はデータ取得目的の `useEffect` は不要になる。
