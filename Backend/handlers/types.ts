// ハンドラ層（HTTP 非依存）の共通型。
// route は Hono の関心事（入出力・Cookie）に専念する。
// `Backend/handlers/*.ts` の中では、export される `xxxHandler` は入力の形式
// バリデーション（必須項目・文字数・UUID形式・enum値など、フォーマット不正なら
// 400を返す）のみを担い、それ以外のオーケストレーション（DBの存在チェックによる
// 404/409判定・DB書き込み・通知トリガー・監査ログ記録・レスポンスbodyの組み立て
// など）は同ファイル内の非export な内部関数（`xxxService`）に委譲する。
// handler/service いずれも `HandlerResult` を返し、route はそれを
// `c.json(body, status)` と Cookie 適用に変換するだけにする。

// 本アプリのハンドラが返しうる HTTP ステータス（いずれも本文を持つコード）。
export type HandlerStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409

// 監査ログに付与する HTTP 由来のメタ情報（route が抽出して handler に渡す）。
export interface ClientMeta {
  ipAddress: string | null
  userAgent: string | null
}

// route 側にセッション Cookie の操作を指示するためのディレクティブ。
// handler は Cookie を直接触らず、発行/削除の意図だけを返す。
export interface SessionCookieDirective {
  action: 'set' | 'clear'
  sessionId?: string
  maxAgeSeconds?: number
}

export interface HandlerResult {
  status: HandlerStatus
  body: Record<string, unknown>
  cookie?: SessionCookieDirective
}
