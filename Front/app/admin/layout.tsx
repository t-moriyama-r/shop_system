import './globals.css'

export const metadata = {
  title: 'SE管理画面',
  description: 'システム管理者専用管理画面',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 antialiased">
      {children}
    </div>
  )
}
