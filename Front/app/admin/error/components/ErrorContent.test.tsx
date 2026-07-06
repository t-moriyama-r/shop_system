import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const searchParamsStore = new Map<string, string>()

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParamsStore.get(key) ?? null,
  }),
}))

const { ErrorContent } = await import('./ErrorContent')

describe('ErrorContent', () => {
  beforeEach(() => {
    searchParamsStore.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the resolved title and message for the given code', async () => {
    searchParamsStore.set('code', '404')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<ErrorContent />)

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('ページが見つかりません')).toBeInTheDocument()
  })

  it('shows only the login link when the session is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<ErrorContent />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ログイン画面へ' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: 'ダッシュボードへ戻る' })).not.toBeInTheDocument()
  })

  it('shows the dashboard link when the session is valid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    render(<ErrorContent />)

    await waitFor(() => {
      const dashboardLink = screen.getByRole('link', { name: 'ダッシュボードへ戻る' })
      expect(dashboardLink).toHaveAttribute('href', '/admin/dashboard')
    })
    expect(screen.getByRole('link', { name: 'ログイン画面へ' })).toHaveAttribute(
      'href',
      '/admin/login',
    )
  })

  it('uses the reference id supplied via the query string', async () => {
    searchParamsStore.set('ref', 'ref-12345')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<ErrorContent />)

    expect(screen.getByText('ref-12345')).toBeInTheDocument()
  })
})
