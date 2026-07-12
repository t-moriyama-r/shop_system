import * as Sentry from '@sentry/node'

let sentryEnabled = false

export function initSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    return
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
  })
  sentryEnabled = true
}

export function isSentryEnabled() {
  return sentryEnabled
}

export function captureException(err: unknown) {
  if (!sentryEnabled) {
    return
  }
  Sentry.captureException(err)
}
