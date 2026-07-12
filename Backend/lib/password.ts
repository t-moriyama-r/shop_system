import bcrypt from 'bcrypt'
import crypto from 'node:crypto'

export const BCRYPT_SALT_ROUNDS = 10

// アカウント発行時に付与する初期（一時）パスワードを生成する。平文はメール本文でのみ
// 利用され、DB にはハッシュ値のみを保存する（設計 BP-003 備考）。
export function generateInitialPassword(): string {
  return crypto.randomBytes(18).toString('base64url')
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS)
}
