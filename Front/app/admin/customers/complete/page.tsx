import { Suspense } from 'react'
import { AuthenticatedLayout } from '../../components/AuthenticatedLayout'
import { CustomerCompleteContent } from './components/CustomerCompleteContent'

export default function CustomerCompletePage() {
  return (
    <AuthenticatedLayout>
      <Suspense fallback={<div className="text-gray-500">読み込み中...</div>}>
        <CustomerCompleteContent />
      </Suspense>
    </AuthenticatedLayout>
  )
}
