import { AuthenticatedLayout } from '../components/authenticated-layout'
import { AccountsContent } from './components/accounts-content'

export default function AccountsPage() {
  return (
    <AuthenticatedLayout>
      <AccountsContent />
    </AuthenticatedLayout>
  )
}
