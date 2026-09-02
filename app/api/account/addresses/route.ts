import { NextRequest, NextResponse } from 'next/server'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addressSchema } from '@/lib/address-schema'
import { checkPincodeServiceability } from '@/lib/shipping/sequel247-validate'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(addresses)
}

export async function POST(req: NextRequest) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = addressSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid address' },
      { status: 400 },
    )
  }
  const d = parsed.data

  // India addresses are checked against Sequel247's serviceability API —
  // confirms both "is this pincode real" and "can our courier deliver
  // there" in one free call (lib/shipping/sequel247-validate.ts). On a
  // real (non-skipped) match, the returned city/state are authoritative
  // and override whatever the user typed.
  let city = d.city
  let state = d.state
  if (d.country === 'IN') {
    const serviceability = await checkPincodeServiceability(d.pincode)
    if (!serviceability.ok) {
      return NextResponse.json({ error: 'Enter a valid pincode' }, { status: 400 })
    }
    if (!('skipped' in serviceability)) {
      city = serviceability.city
      state = serviceability.state
    }
  }

  const count = await prisma.address.count({ where: { userId: user.id } })
  const makeDefault = d.isDefault || count === 0

  const address = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } })
    }
    return tx.address.create({
      data: {
        userId: user.id,
        label: d.label || null,
        contactName: d.contactName,
        contactPhone: d.contactPhone,
        line1: d.line1,
        line2: d.line2 || null,
        city,
        state,
        pincode: d.pincode,
        country: d.country,
        isDefault: makeDefault,
      },
    })
  })
  return NextResponse.json(address, { status: 201 })
}
