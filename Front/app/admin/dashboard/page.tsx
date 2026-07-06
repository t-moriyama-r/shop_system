import { AuthenticatedLayout } from '../components/AuthenticatedLayout'
import { DashboardContent } from './components/DashboardContent'

export default function DashboardPage() {
  return (
    <AuthenticatedLayout>
      <DashboardContent />
    </AuthenticatedLayout>
  )
}
