import { Suspense } from 'react'
import { ErrorContent } from './components/ErrorContent'

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  )
}
