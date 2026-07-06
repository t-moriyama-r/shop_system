import { AuthenticatedLayout } from '../../components/AuthenticatedLayout'
import { NewCustomerContent } from './components/NewCustomerContent'

export default function NewCustomerPage() {
  return (
    <AuthenticatedLayout>
      <NewCustomerContent />
    </AuthenticatedLayout>
  )
}
