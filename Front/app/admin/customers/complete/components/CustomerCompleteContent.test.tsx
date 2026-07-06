import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { CustomerCompleteContent } from './CustomerCompleteContent'

const replaceMock = vi.fn()
let searchParamsValue = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsValue,
}))

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CustomerCompleteContent />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  replaceMock.mockClear()
  searchParamsValue = new URLSearchParams()
})

describe('CustomerCompleteContent', () => {
  it('redirects to the dashboard when shopAccountId is missing', () => {
    renderWithClient()
    expect(replaceMock).toHaveBeenCalledWith('/admin/dashboard')
  })

  it('shows the account summary and pending notification status', async () => {
    searchParamsValue = new URLSearchParams({ shopAccountId: 'shop-1' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          shopAccountId: 'shop-1',
          shopName: 'サンプル商店',
          contactName: '山田 太郎',
          email: 'owner@example.com',
          accountStatus: 'active',
          issuedBySeAdminUserId: 'se-1',
          notificationSentAt: null,
          isDeleted: false,
          deletedAt: null,
          createdAt: '2026-07-06T00:00:00Z',
          updatedAt: '2026-07-06T00:00:00Z',
          emailNotificationLogs: [
            {
              emailNotificationLogId: 'log-1',
              shopAccountId: 'shop-1',
              toEmail: 'owner@example.com',
              notificationType: 'INITIAL_LOGIN',
              sendStatus: 'PENDING',
              sentAt: null,
              errorMessage: null,
              retryCount: 0,
              createdAt: '2026-07-06T00:00:00Z',
              updatedAt: '2026-07-06T00:00:00Z',
            },
          ],
        }),
      }),
    )

    renderWithClient()

    await waitFor(() => expect(screen.getByText('サンプル商店')).toBeInTheDocument())
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
    expect(screen.getByText('送信処理中')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ダッシュボードへ戻る' })).toHaveAttribute(
      'href',
      '/admin/dashboard',
    )
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
