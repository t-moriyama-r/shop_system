'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL as API_BASE } from '@/lib/config'
import { AdminHeader } from './admin-header'
import { AdminSidebar } from './admin-sidebar'

interface SessionUser {
  seAdminUserId: string
  email: string
  isPasswordSet: boolean
}

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' })
        if (!res.ok) {
          router.replace('/admin/login')
          return
        }
        const data: SessionUser = await res.json()
        if (!data.isPasswordSet) {
          router.replace('/admin/password/setup')
          return
        }
        setUser(data)
      } catch {
        router.replace('/admin/login')
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      router.replace('/admin/login')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen">
      <AdminHeader email={user.email} onLogout={handleLogout} />
      <AdminSidebar />
      <main className="ml-56 min-h-[calc(100vh-4rem)] p-6">{children}</main>
    </div>
  )
}
