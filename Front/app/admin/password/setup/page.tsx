'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL as API_BASE } from '@/lib/config'
import { AdminHeader } from '../../components/admin-header'

export default function PasswordSetupPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // パスワードポリシーのリアルタイム表示
  const hasMinLength = password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' })
        if (!res.ok) {
          router.replace('/admin/login')
          return
        }
        const data = await res.json()
        if (data.isPasswordSet) {
          router.replace('/admin/dashboard')
        }
      } catch {
        router.replace('/admin/login')
      } finally {
        setCheckingSession(false)
      }
    }
    checkSession()
  }, [router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setConfirmError('')

    if (!password) {
      setError('パスワードを入力してください')
      return
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError('パスワードポリシーを満たしていません')
      return
    }
    if (password !== passwordConfirm) {
      setConfirmError('パスワードが一致しません')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, passwordConfirm }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'パスワードの設定に失敗しました')
        return
      }

      router.replace('/admin/dashboard')
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader showNav={false} />
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="mb-2 text-center text-xl font-bold text-gray-800">
              初回パスワード設定
            </h2>
            <p className="mb-6 text-center text-sm text-gray-600">
              セキュリティのため、パスワードを設定してください。
            </p>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                  新しいパスワード
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={loading}
                />
                <div className="mt-2 space-y-1">
                  <PolicyIndicator met={hasMinLength} label="8文字以上" />
                  <PolicyIndicator met={hasLetter} label="英字を含む" />
                  <PolicyIndicator met={hasNumber} label="数字を含む" />
                </div>
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="mb-1 block text-sm font-medium text-gray-700">
                  パスワード確認
                </label>
                <input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  onBlur={() => {
                    if (passwordConfirm && password !== passwordConfirm) {
                      setConfirmError('パスワードが一致しません')
                    } else {
                      setConfirmError('')
                    }
                  }}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={loading}
                />
                {confirmError && (
                  <p className="mt-1 text-xs text-red-600">{confirmError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? '設定中...' : 'パスワードを設定する'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function PolicyIndicator({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
      <span>{met ? '○' : '・'}</span>
      <span>{label}</span>
    </div>
  )
}
