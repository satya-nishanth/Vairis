import {
  PRODUCT_EXTRA_START,
  PRODUCT_HOVER_INDEX,
  PRODUCT_VIDEO_SLOT_COUNT,
  normalizeProductImages,
  padProductImagesForSave,
  productFrontImage,
  productHoverImage,
} from '@/lib/product-media'

describe('normalizeProductImages', () => {
  it('pads angles, three videos, and an empty hover slot', () => {
    expect(normalizeProductImages(['front.jpg'])).toEqual([
      'front.jpg',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ])
    expect(normalizeProductImages(['front.jpg']).length).toBe(PRODUCT_EXTRA_START)
    expect(PRODUCT_HOVER_INDEX).toBe(7)
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
      '',
      'extra1.jpg',
      'extra2.jpg',
    ])
  })

  it('keeps hover at index 7 and extras after', () => {
    const next = normalizeProductImages([
      'f.jpg',
      'l.jpg',
      'r.jpg',
      'b.jpg',
      'a.mp4',
      'b.mp4',
      'c.mp4',
      'hover.jpg',
      'more.jpg',
    ])
    expect(next.slice(4, 7)).toEqual(['a.mp4', 'b.mp4', 'c.mp4'])
    expect(next[PRODUCT_HOVER_INDEX]).toBe('hover.jpg')
    expect(next.slice(PRODUCT_EXTRA_START)).toEqual(['more.jpg'])
    expect(PRODUCT_VIDEO_SLOT_COUNT).toBe(3)
  })

  it('pulls image extras out of former video slot positions', () => {
    expect(
      normalizeProductImages(['f.jpg', '', '', '', '', 'extra.jpg', 'other.png']),
    ).toEqual(['f.jpg', '', '', '', '', '', '', '', 'extra.jpg', 'other.png'])
  })
})

describe('padProductImagesForSave', () => {
  it('keeps empty slots through hover so index 7 is stable', () => {
    const saved = padProductImagesForSave(['front.jpg'])
    expect(saved.length).toBe(PRODUCT_EXTRA_START)
    expect(saved[0]).toBe('front.jpg')
    expect(saved[PRODUCT_HOVER_INDEX]).toBe('')
  })
})

describe('productFrontImage / productHoverImage', () => {
  it('uses front as primary and hover separately', () => {
    const imgs = [
      'front.jpg',
      '',
      '',
      '',
      '',
      '',
      '',
      'hover.jpg',
      'extra.jpg',
    ]
    expect(productFrontImage(imgs)).toBe('front.jpg')
    expect(productHoverImage(imgs)).toBe('hover.jpg')
  })

  it('does not use hover as front when front is set', () => {
    expect(
      productFrontImage(['front.jpg', '', '', '', '', '', '', 'hover.jpg']),
    ).toBe('front.jpg')
  })

  it('returns null hover when unset', () => {
    expect(productHoverImage(['front.jpg'])).toBeNull()
  })
})
