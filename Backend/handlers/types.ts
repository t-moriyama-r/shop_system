// ハンドラ層（HTTP 非依存）の共通型。分離方針は coder-guidelines スキルを参照。

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
