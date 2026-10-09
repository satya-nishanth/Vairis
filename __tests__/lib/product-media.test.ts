import {
  PRODUCT_EXTRA_START,
  PRODUCT_VIDEO_SLOT_COUNT,
  normalizeProductImages,
} from '@/lib/product-media'

describe('normalizeProductImages', () => {
  it('pads angles and three empty video slots', () => {
    expect(normalizeProductImages(['front.jpg'])).toEqual([
      'front.jpg',
      '',
      '',
      '',
      '',
      '',
      '',
    ])
    expect(normalizeProductImages(['front.jpg']).length).toBe(PRODUCT_EXTRA_START)
  })

  it('migrates old single-video layout (extras at index 5+)', () => {
    const old = [
      'front.jpg',
      'left.jpg',
      'right.jpg',
      'back.jpg',
      'clip.mp4',
      'extra1.jpg',
      'extra2.jpg',
    ]
    expect(normalizeProductImages(old)).toEqual([
      'front.jpg',
      'left.jpg',
      'right.jpg',
      'back.jpg',
      'clip.mp4',
      '',
      '',
      'extra1.jpg',
      'extra2.jpg',
    ])
  })

  it('keeps up to three videos then extras', () => {
    const next = normalizeProductImages([
      'f.jpg',
      'l.jpg',
      'r.jpg',
      'b.jpg',
      'a.mp4',
      'b.mp4',
      'c.mp4',
      'more.jpg',
    ])
    expect(next.slice(4, 7)).toEqual(['a.mp4', 'b.mp4', 'c.mp4'])
    expect(next.slice(PRODUCT_EXTRA_START)).toEqual(['more.jpg'])
    expect(PRODUCT_VIDEO_SLOT_COUNT).toBe(3)
  })

  it('pulls image extras out of former video slot positions', () => {
    // No video — old extras sat at index 5/6 and must not become video slots.
    expect(
      normalizeProductImages(['f.jpg', '', '', '', '', 'extra.jpg', 'other.png']),
    ).toEqual(['f.jpg', '', '', '', '', '', '', 'extra.jpg', 'other.png'])
  })
})
