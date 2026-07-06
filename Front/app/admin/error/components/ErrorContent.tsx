'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { API_BASE_URL as API_BASE } from '@/lib/config'
import { AdminHeader } from '../../components/AdminHeader'
import { resolveError } from '../errorMessages'

type SessionState = 'unknown' | 'authenticated' | 'unauthenticated'

function generateReferenceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // randomUUID 非対応環境向けのフォールバック
  return `err-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
}

export function ErrorContent() {
  const searchParams = useSearchParams()
  const error = resolveError(searchParams.get('code'))

  // エラー参照ID: クエリで渡された値を優先し、なければ一度だけ生成する。
  const referenceId = useMemo(
    () => searchParams.get('ref')?.trim() || generateReferenceId(),
    [searchParams],
  )

  const [session, setSession] = useState<SessionState>('unknown')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' })
        if (active) setSession(res.ok ? 'authenticated' : 'unauthenticated')
      } catch {
        if (active) setSession('unauthenticated')
      }
    }
    checkSession()
    return () => {
      active = false
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referenceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボードが利用できない場合は何もしない
    }
  }

  const isAuthenticated = session === 'authenticated'

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader showNav={false} />
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <svg
                className="h-7 w-7 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
            </div>

            <p className="text-4xl font-bold tracking-tight text-gray-800">{error.code}</p>
            <h2 className="mt-2 text-lg font-bold text-gray-800">{error.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">{error.message}</p>

            <div className="mt-6 flex flex-col gap-3">
              {isAuthenticated && (
                <Link
                  href="/admin/dashboard"
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  ダッシュボードへ戻る
                </Link>
              )}
              <Link
                href="/admin/login"
                className={`w-full rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isAuthenticated
                    ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                ログイン画面へ
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">エラー参照ID</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="break-all font-mono text-xs text-gray-700">{referenceId}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                {copied ? 'コピーしました' : 'コピー'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              お問い合わせの際は、この参照IDをお伝えください。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
