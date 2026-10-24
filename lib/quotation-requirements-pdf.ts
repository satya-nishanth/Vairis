import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { colorMeta, purityMeta } from '@/lib/metal'

export type RequirementsPdfInput = {
  displayId: string
  orderType: string
  details: string | null
  metalType: string | null
  metalColor: string | null
  /** Front image URL (product.images[0]) when a catalogue product is linked. */
  productImageUrl: string | null
}

async function fetchImageAsJpeg(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return new Uint8Array(
      await sharp(buf)
        .rotate()
        .jpeg({ quality: 88 })
        .toBuffer(),
    )
  } catch (err) {
    console.error('[quotation-requirements-pdf] image fetch/convert failed', err)
    return null
  }
}

/** StandardFonts only cover WinAnsi — drop unsupported glyphs so drawText never throws. */
function winAnsiSafe(text: string): string {
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?')
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, size: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  for (const paragraph of winAnsiSafe(text).split(/\r?\n/)) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }
  return lines.length ? lines : ['—']
}

/** Option A: quote → purity/color → requirements → product image. */
export async function buildQuotationRequirementsPdf(
  input: RequirementsPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const marginX = 52
  const marginTop = 52
  const marginBottom = 52
  const contentW = pageWidth - marginX * 2

  const ink = rgb(0.067, 0.169, 0.141) // #032b24
  const muted = rgb(0.45, 0.48, 0.52)
  const rule = rgb(0.88, 0.89, 0.91)

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - marginTop

  const ensureSpace = (needed: number) => {
    if (y - needed < marginBottom) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - marginTop
    }
  }

  const drawHairline = () => {
    ensureSpace(16)
    page.drawLine({
      start: { x: marginX, y },
      end: { x: marginX + contentW, y },
      thickness: 0.6,
      color: rule,
    })
    y -= 18
  }

  const drawMicroLabel = (label: string) => {
    ensureSpace(12)
    page.drawText(label.toUpperCase(), {
      x: marginX,
      y,
      size: 7.5,
      font: fontBold,
      color: muted,
    })
    y -= 13
  }

  // —— Header ——
  page.drawText('VAIRIS', {
    x: marginX,
    y,
    size: 16,
    font: fontBold,
    color: ink,
  })
  y -= 14
  page.drawText('Quotation requirements', {
    x: marginX,
    y,
    size: 10,
    font,
    color: muted,
  })
  y -= 16
  drawHairline()

  // —— Quote id + order type ——
  drawMicroLabel('Quote')
  const quoteLine = winAnsiSafe(`${input.displayId}  ·  ${input.orderType}`)
  ensureSpace(18)
  page.drawText(quoteLine, {
    x: marginX,
    y,
    size: 12,
    font: fontBold,
    color: ink,
  })
  y -= 28

  // —— Purity + color side by side ——
  const colGap = 24
  const colW = (contentW - colGap) / 2
  const purity = purityMeta(input.metalType ?? '')?.label ?? '—'
  const color = colorMeta(input.metalColor ?? '')?.label ?? '—'
  const specTop = y

  page.drawText('GOLD PURITY', {
    x: marginX,
    y: specTop,
    size: 7.5,
    font: fontBold,
    color: muted,
  })
  page.drawText('GOLD COLOR', {
    x: marginX + colW + colGap,
    y: specTop,
    size: 7.5,
    font: fontBold,
    color: muted,
  })

  page.drawText(winAnsiSafe(purity), {
    x: marginX,
    y: specTop - 18,
    size: 14,
    font: fontBold,
    color: ink,
  })
  page.drawText(winAnsiSafe(color), {
    x: marginX + colW + colGap,
    y: specTop - 18,
    size: 14,
    font: fontBold,
    color: ink,
  })
  y = specTop - 40
  drawHairline()

  // —— Requirements ——
  drawMicroLabel('Requirements')
  const bodySize = 11
  const bodyLeading = 16
  const reqLines = wrapText(
    input.details?.trim() || '—',
    font,
    bodySize,
    contentW,
  )
  for (const line of reqLines) {
    ensureSpace(bodyLeading)
    page.drawText(line || ' ', {
      x: marginX,
      y,
      size: bodySize,
      font,
      color: ink,
    })
    y -= bodyLeading
  }
  y -= 20

  // —— Product image (bottom) ——
  if (input.productImageUrl) {
    const jpeg = await fetchImageAsJpeg(input.productImageUrl)
    if (jpeg) {
      try {
        const image = await doc.embedJpg(jpeg)
        const maxW = contentW
        const maxH = 320
        const scale = Math.min(maxW / image.width, maxH / image.height, 1)
        const w = image.width * scale
        const h = image.height * scale

        ensureSpace(h + 36)
        drawMicroLabel('Product')
        y -= 2
        // Light frame
        page.drawRectangle({
          x: marginX - 1,
          y: y - h - 1,
          width: w + 2,
          height: h + 2,
          borderColor: rule,
          borderWidth: 0.75,
        })
        page.drawImage(image, {
          x: marginX,
          y: y - h,
          width: w,
          height: h,
        })
        y -= h + 16
      } catch (err) {
        console.error('[quotation-requirements-pdf] embed image failed', err)
      }
    }
  }

  return doc.save()
}
