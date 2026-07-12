import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (dsn) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
      })
    }
  }
}

export const onRequestError = Sentry.captureRequestError
