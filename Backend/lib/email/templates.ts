// メール本文テンプレート（BP-005/BP-011 備考: テンプレート詳細は※要確認のため、
// 現時点では最小限の情報（メールアドレス・一時パスワード・利用案内）のみを含む）。

export interface ShopAccountIssuedTemplateInput {
  shopName: string
  contactName: string
  email: string
  temporaryPassword: string
  loginUrl: string
}

export interface EmailContent {
  subject: string
  text: string
}

export interface SeAdminAccountIssuedTemplateInput {
  email: string
  temporaryPassword: string
  loginUrl: string
}

export function buildSeAdminAccountIssuedEmail(
  input: SeAdminAccountIssuedTemplateInput,
): EmailContent {
  const subject = '【ショップ管理システム】SE管理者アカウント発行のお知らせ'
  const text = [
    'SE管理者アカウントを発行しました。',
    '以下の情報でログインしてください。',
    '',
    `ログインURL: ${input.loginUrl}`,
    `メールアドレス: ${input.email}`,
    `初期パスワード: ${input.temporaryPassword}`,
    '',
    '初回ログイン後、パスワードの変更が必要です。',
    '本メールに心当たりがない場合は、破棄していただきますようお願いいたします。',
  ].join('\n')

  return { subject, text }
}

export function buildShopAccountIssuedEmail(input: ShopAccountIssuedTemplateInput): EmailContent {
  const subject = '【ショップ管理システム】アカウント発行のお知らせ'
  const text = [
    `${input.contactName} 様`,
    '',
    `${input.shopName} 様のショップアカウントを発行しました。`,
    '以下の情報でログインしてください。',
    '',
    `ログインURL: ${input.loginUrl}`,
    `メールアドレス: ${input.email}`,
    `一時パスワード: ${input.temporaryPassword}`,
    '',
    '初回ログイン後は、速やかにパスワードを変更してください。',
    '本メールに心当たりがない場合は、破棄していただきますようお願いいたします。',
  ].join('\n')

  return { subject, text }
}
