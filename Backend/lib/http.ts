import type { Context } from 'hono'
import { setCookie } from 'hono/cookie'
import type { SessionCookieDirective } from '../handlers/types'

// 監査ログ用に HTTP ヘッダから IP / User-Agent を取り出す。
export function clientMeta(c: Context): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  }
}

// handler が返したセッション Cookie ディレクティブを実際の Set-Cookie に反映する。
export function applySessionCookie(c: Context, cookie: SessionCookieDirective): void {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax' as const,
    path: '/',
  }

  if (cookie.action === 'clear') {
    setCookie(c, 'sessionId', '', { ...options, maxAge: 0 })
    return
  }

  setCookie(c, 'sessionId', cookie.sessionId ?? '', {
    ...options,
    maxAge: cookie.maxAgeSeconds ?? 0,
  })
}
