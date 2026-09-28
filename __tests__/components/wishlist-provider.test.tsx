/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { WishlistProvider, useWishlist } from '@/components/commerce/WishlistProvider'

// Mock Supabase SSR client
const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  })),
}))

function TestComponent() {
  const { ids, count, has, toggle, isLoggedIn } = useWishlist()
  return (
    <div>
      <span data-testid="count">{count}</span>
      <span data-testid="has-item">{has('prod-123') ? 'yes' : 'no'}</span>
      <span data-testid="is-logged-in">{isLoggedIn ? 'yes' : 'no'}</span>
      <button onClick={() => toggle('prod-123')}>Toggle</button>
    </div>
  )
}

describe('WishlistProvider persistence and logout retention', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })
  })

  it('initializes from localStorage for guest users', async () => {
    localStorage.setItem('vairis-wishlist-ids', JSON.stringify(['prod-123']))

    await act(async () => {
      render(
        <WishlistProvider>
          <TestComponent />
        </WishlistProvider>
      )
    })

    expect(await screen.findByText('1')).toBeInTheDocument()
    expect(screen.getByTestId('has-item')).toHaveTextContent('yes')
  })

  it('updates localStorage immediately when toggling items', async () => {
    await act(async () => {
      render(
        <WishlistProvider>
          <TestComponent />
        </WishlistProvider>
      )
    })

    expect(screen.getByTestId('count')).toHaveTextContent('0')
    const button = screen.getByText('Toggle')

    act(() => {
      button.click()
    })

    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(screen.getByTestId('has-item')).toHaveTextContent('yes')
    expect(JSON.parse(localStorage.getItem('vairis-wishlist-ids') || '[]')).toContain('prod-123')
  })

  it('clears wishlisted items from device when user logs out (TC-091)', async () => {
    let authCallback: (event: string, session: any) => void = () => {}
    mockOnAuthStateChange.mockImplementation((cb) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: jest.fn() } } }
    })

    // User is logged in initially with an item
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    localStorage.setItem('vairis-wishlist-ids', JSON.stringify(['prod-123']))

    // Mock fetch for /api/wishlist
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ productId: 'prod-123' }],
    } as any)

    await act(async () => {
      render(
        <WishlistProvider>
          <TestComponent />
        </WishlistProvider>
      )
    })

    expect(await screen.findByText('1')).toBeInTheDocument()

    // Trigger SIGNED_OUT
    act(() => {
      authCallback('SIGNED_OUT', null)
    })

    // Items must be cleared from device on sign-out (TC-091)
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByTestId('has-item')).toHaveTextContent('no')
    expect(localStorage.getItem('vairis-wishlist-ids')).toBeNull()
  })
})
