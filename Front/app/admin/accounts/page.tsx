import { AuthenticatedLayout } from '../components/AuthenticatedLayout'
import { AccountsContent } from './components/AccountsContent'

export default function AccountsPage() {
  return (
    <AuthenticatedLayout>
      <AccountsContent />
    </AuthenticatedLayout>
  )
}
