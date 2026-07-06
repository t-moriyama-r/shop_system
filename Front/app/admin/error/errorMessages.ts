/**
 * 共通エラー画面（SCR-008）で表示するエラーコードと文言の対応定義。
 *
 * エラーコードは HTTP ステータスコードを基本とし、対応する定義がない場合は
 * 汎用のシステムエラー（500 相当）にフォールバックする。技術的な内部情報
 * （スタックトレース等）は含めず、SE管理者向けのわかりやすい文言のみを扱う。
 */

/** 画面が扱うエラーコードの一覧。 */
export type ErrorCode = '400' | '403' | '404' | '500' | '503'

export type ErrorDefinition = {
  /** 表示用のエラーコード（例: '500', '404'） */
  code: ErrorCode
  /** エラーの種別を端的に表すタイトル */
  title: string
  /** SE管理者向けのわかりやすい説明文 */
  message: string
}

const DEFAULT_CODE: ErrorCode = '500'

const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  '400': {
    code: '400',
    title: 'リクエストに誤りがあります',
    message:
      '送信された内容を処理できませんでした。入力内容をご確認のうえ、操作をやり直してください。',
  },
  '403': {
    code: '403',
    title: 'アクセス権限がありません',
    message:
      'この操作を行う権限がありません。権限が必要な場合はシステム管理者にお問い合わせください。',
  },
  '404': {
    code: '404',
    title: 'ページが見つかりません',
    message:
      'お探しのページは存在しないか、移動または削除された可能性があります。URL をご確認ください。',
  },
  '500': {
    code: '500',
    title: 'サーバーエラーが発生しました',
    message:
      '予期しないエラーが発生しました。しばらく時間をおいて再試行するか、システム管理者にお問い合わせください。',
  },
  '503': {
    code: '503',
    title: 'ただいまご利用いただけません',
    message:
      'システムが一時的に利用できない状態です。しばらく時間をおいてから再度お試しください。',
  },
}

function isErrorCode(code: string): code is ErrorCode {
  return code in ERROR_DEFINITIONS
}

/**
 * エラーコードに対応する表示定義を返す。未定義・未指定のコードは
 * 汎用のシステムエラー（500）にフォールバックする。
 */
export function resolveError(code?: string | null): ErrorDefinition {
  const normalized = code?.trim()
  if (normalized && isErrorCode(normalized)) {
    return ERROR_DEFINITIONS[normalized]
  }
  return ERROR_DEFINITIONS[DEFAULT_CODE]
}
