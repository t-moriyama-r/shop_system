'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ja">
      <body>
        <h1>予期しないエラーが発生しました</h1>
        <p>しばらくしてから再度お試しください。</p>
        <button type="button" onClick={reset}>
          再試行
        </button>
      </body>
    </html>
  )
}
