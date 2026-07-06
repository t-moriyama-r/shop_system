import { Suspense } from 'react'
import { AuthenticatedLayout } from '../../components/AuthenticatedLayout'
import { LoadingIndicator } from '../../components/LoadingIndicator'
import { CustomerCompleteContent } from './components/CustomerCompleteContent'

export default function CustomerCompletePage() {
  return (
    <AuthenticatedLayout>
      <Suspense fallback={<LoadingIndicator />}>
        <CustomerCompleteContent />
      </Suspense>
    </AuthenticatedLayout>
  )
}
