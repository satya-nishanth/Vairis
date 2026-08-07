import { NextRequest, NextResponse } from 'next/server'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addressSchema } from '@/lib/address-schema'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.address.findUnique({ where: { id } })
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = addressSchema.partial().safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid address' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const address = await prisma.$transaction(async (tx) => {
    if (d.isDefault) {
      await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } })
    }
    return tx.address.update({
      where: { id },
      data: {
        ...(d.label !== undefined && { label: d.label || null }),
        ...(d.contactName !== undefined && { contactName: d.contactName }),
        ...(d.contactPhone !== undefined && { contactPhone: d.contactPhone }),
        ...(d.line1 !== undefined && { line1: d.line1 }),
        ...(d.line2 !== undefined && { line2: d.line2 || null }),
        ...(d.city !== undefined && { city: d.city }),
        ...(d.state !== undefined && { state: d.state }),
        ...(d.pincode !== undefined && { pincode: d.pincode }),
        ...(d.isDefault !== undefined && { isDefault: d.isDefault }),
      },
    })
  })
  return NextResponse.json(address)
}

export async function DELETE(_: NextRequest, { params }: { params: Params }) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.address.findUnique({ where: { id } })
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await prisma.address.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
