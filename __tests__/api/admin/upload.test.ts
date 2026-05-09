import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/upload/route'
import { requireAdmin } from '@/lib/auth'

// Sharp mock — factory inline (jest.mock is hoisted, can't reference outer vars)
jest.mock('sharp', () => {
  const mockToBuffer = jest.fn().mockResolvedValue(Buffer.from('resized'))
  const mockJpeg = jest.fn().mockReturnValue({ toBuffer: mockToBuffer })
  const mockResize = jest.fn().mockReturnValue({ jpeg: mockJpeg })
  const instance = { resize: mockResize }
  const sharp = jest.fn().mockReturnValue(instance)
  return { __esModule: true, default: sharp }
})

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))

const mockUpload = jest.fn()
const mockGetPublicUrl = jest.fn()
const mockCreateBucket = jest.fn()

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    storage: {
      createBucket: (...args: any[]) => mockCreateBucket(...args),
      from: () => ({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
        remove: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}))

const fakeSession = { user: { email: 'admin@vairis.com', id: 'uid-1' } }
const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>

// Access the hoisted sharp mock after module load
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp').default as jest.Mock

function makeImageRequest(filename = 'photo.png', type = 'image/png', sizeMB = 1) {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024)
  const file = new File([bytes], filename, { type })
  const fd = new FormData()
  fd.append('file', file)
  return new NextRequest('http://localhost/api/admin/upload', { method: 'POST', body: fd })
}

function makeVideoRequest(filename = 'clip.mp4', type = 'video/mp4', sizeMB = 10) {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024)
  const file = new File([bytes], filename, { type })
  const fd = new FormData()
  fd.append('file', file)
  return new NextRequest('http://localhost/api/admin/upload', { method: 'POST', body: fd })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue(fakeSession as any)
  mockCreateBucket.mockResolvedValue({ error: null })
  mockUpload.mockResolvedValue({ error: null })
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/file.jpg' } })

  // Re-wire Sharp chain after clearAllMocks
  const mockToBuffer = jest.fn().mockResolvedValue(Buffer.from('resized'))
  const mockJpeg = jest.fn().mockReturnValue({ toBuffer: mockToBuffer })
  const mockResize = jest.fn().mockReturnValue({ jpeg: mockJpeg })
  sharp.mockReturnValue({ resize: mockResize })
})

// ── Image upload ─────────────────────────────────────────────────────────────

describe('POST /api/admin/upload — image', () => {
  it('returns 200 with url and type=image', async () => {
    const res = await POST(makeImageRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.type).toBe('image')
    expect(data.url).toBe('https://example.com/file.jpg')
  })

  it('passes image through Sharp resize', async () => {
    await POST(makeImageRequest())
    expect(sharp).toHaveBeenCalled()
    const instance = sharp.mock.results[0].value
    expect(instance.resize).toHaveBeenCalledWith(1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  })

  it('uploads resized buffer with image/jpeg content type', async () => {
    await POST(makeImageRequest('photo.png', 'image/png'))
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/images\/.+\.jpg$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg' })
    )
  })

  it('stores file in products/images/ with .jpg extension regardless of input format', async () => {
    await POST(makeImageRequest('product.webp', 'image/webp'))
    const [path] = mockUpload.mock.calls[0]
    expect(path).toMatch(/^products\/images\//)
    expect(path).toMatch(/\.jpg$/)
  })

  it('returns 400 for unsupported file type', async () => {
    const file = new File([new Uint8Array(100)], 'doc.pdf', { type: 'application/pdf' })
    const fd = new FormData()
    fd.append('file', file)
    const req = new NextRequest('http://localhost/api/admin/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Unsupported/)
  })

  it('returns 400 when no file provided', async () => {
    const fd = new FormData()
    const req = new NextRequest('http://localhost/api/admin/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('requires admin auth', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('REDIRECT:/auth/login'))
    await expect(POST(makeImageRequest())).rejects.toThrow('REDIRECT:/auth/login')
    expect(sharp).not.toHaveBeenCalled()
  })
})

// ── Video upload ─────────────────────────────────────────────────────────────

describe('POST /api/admin/upload — video', () => {
  it('returns 200 with url and type=video', async () => {
    const res = await POST(makeVideoRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.type).toBe('video')
  })

  it('does NOT call Sharp for videos', async () => {
    await POST(makeVideoRequest())
    expect(sharp).not.toHaveBeenCalled()
  })

  it('stores video in products/videos/ path', async () => {
    await POST(makeVideoRequest('clip.mp4', 'video/mp4'))
    const [path] = mockUpload.mock.calls[0]
    expect(path).toMatch(/^products\/videos\//)
  })

  it('returns 413 when video exceeds 50MB', async () => {
    const res = await POST(makeVideoRequest('big.mp4', 'video/mp4', 51))
    expect(res.status).toBe(413)
    const data = await res.json()
    expect(data.error).toMatch(/50MB/)
  })

  it('accepts video just under 50MB', async () => {
    const res = await POST(makeVideoRequest('ok.mp4', 'video/mp4', 49))
    expect(res.status).toBe(200)
  })
})
