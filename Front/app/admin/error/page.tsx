import { Suspense } from 'react'
import { LoadingIndicator } from '../components/LoadingIndicator'
import { ErrorContent } from './components/ErrorContent'

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <LoadingIndicator />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  )
}
