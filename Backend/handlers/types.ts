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

// service 層（xxxService）が返しうる意味的なエラー理由。HTTP ステータスコードは持たない。
export type ServiceErrorReason = 'not_found' | 'conflict'

// service 層の実行結果。成功時は意味的なデータを、失敗時は判別可能なエラー理由とメッセージを返す。
// HTTP ステータス・レスポンスbodyへのマッピングは呼び出し元の xxxHandler が行う。
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ServiceErrorReason; message: string }

const SERVICE_ERROR_STATUS: Record<ServiceErrorReason, HandlerStatus> = {
  not_found: 404,
  conflict: 409,
}

// ServiceResult の失敗結果を HandlerResult に変換する共通ヘルパー。
// xxxHandler 側で `if (!result.ok) return serviceErrorResult(result)` の形で使う。
export function serviceErrorResult(
  result: Extract<ServiceResult<unknown>, { ok: false }>,
): HandlerResult {
  return { status: SERVICE_ERROR_STATUS[result.reason], body: { error: result.message } }
}
