import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockGetJson = vi.fn()
const mockGet = vi.fn()

vi.mock('@/lib/api', () => ({
  apiClient: {
    api: {
      menu: {
        $get: () => {
          mockGet()
          return Promise.resolve({ json: () => Promise.resolve(mockGetJson()) })
        },
      },
    },
  },
}))

const { OrderMenu } = await import('./order-menu')

describe('OrderMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders menu items after fetching', async () => {
    mockGetJson.mockReturnValue([
      { id: '1', name: 'コーヒー', price: 400 },
      { id: '2', name: 'カフェラテ', price: 480 },
    ])

    render(<OrderMenu />)

    await waitFor(() => {
      expect(screen.getByText('コーヒー - ¥400')).toBeInTheDocument()
      expect(screen.getByText('カフェラテ - ¥480')).toBeInTheDocument()
    })

    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('renders an empty list when there are no menu items', async () => {
    mockGetJson.mockReturnValue([])

    const { container } = render(<OrderMenu />)

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1)
    })

    const listItems = container.querySelectorAll('li')
    expect(listItems).toHaveLength(0)
  })

  it('renders the correct number of list items', async () => {
    mockGetJson.mockReturnValue([
      { id: '1', name: 'コーヒー', price: 400 },
      { id: '2', name: 'カフェラテ', price: 480 },
      { id: '3', name: 'チーズケーキ', price: 550 },
    ])

    const { container } = render(<OrderMenu />)

    await waitFor(() => {
      const listItems = container.querySelectorAll('li')
      expect(listItems).toHaveLength(3)
    })
  })
})
