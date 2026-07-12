# Backend 実装規約

本リポジトリ（`shop_system`）で `Backend/` および `DB/` の実装を行う際に守る規約をまとめる。

## re-export（バレル再エクスポート）を禁止する

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

## route ハンドラ直下にサービスロジックを書かない（3層構成）

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

## handler ファイル内の定義順序（エントリーポイントを先頭に）

1つの `Backend/handlers/*.ts` の中で、ビジネスロジックが厚くなる場合は export する `xxxHandler`（検証のみを担うエントリーポイント）と、非export の `xxxService`（DBの存在チェック・書き込み・通知トリガー・監査ログ記録などのオーケストレーション）に分けてよい。その場合、**ファイル内では全ての `xxxHandler` を先頭にまとめ、`xxxService` 群はその後（ファイル下部）にまとめる**。ファイルは上から読まれるものなので、外部から呼ばれるエントリーポイント（＝そのファイルが何を公開しているか）が先に目に入るようにする。`function` 宣言は巻き上げられるため、handler が下部の service を先に参照しても問題ない。

- NG: `handlerA` → `serviceA` → `handlerB` → `serviceB` のように handler と service を1組ずつ交互に並べる
- OK: `handlerA` → `handlerB` → ... → `serviceA` → `serviceB` ...（対応する `Input` 型は各 handler の直上に置く）
