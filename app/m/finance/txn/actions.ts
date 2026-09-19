'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireFinance } from '@/lib/finance-auth'
import { isVaultAccountType } from '@/lib/finance'
import { MOBILE_TXN_COOKIE, type MobileTxnDraft } from '@/lib/mobile-txn-draft'

function fail(message: string): never {
  redirect(`/m/finance/txn?error=${encodeURIComponent(message)}`)
}

export async function continueToAllocate(formData: FormData) {
  await requireFinance()

  const date = String(formData.get('date') ?? '').trim()
  const directionRaw = String(formData.get('direction') ?? '').trim()
  const direction =
    directionRaw === 'INFLOW' || directionRaw === 'OUTFLOW' || directionRaw === 'TRANSFER'
      ? directionRaw
      : null

  const amount = Number(String(formData.get('amount') ?? '').replace(/,/g, ''))
  const description = String(formData.get('description') ?? '').trim()
  const accountId = String(formData.get('accountId') ?? '').trim()
  const paidThroughAccountId =
    direction === 'TRANSFER'
      ? String(formData.get('paidThroughTransfer') ?? '').trim()
      : String(formData.get('paidThroughFlow') ?? '').trim()
  const transferToAccountId = String(formData.get('transferToAccountId') ?? '').trim()
  const categoryId =
    direction === 'INFLOW'
      ? String(formData.get('categoryInflow') ?? '').trim()
      : direction === 'OUTFLOW'
        ? String(formData.get('categoryOutflow') ?? '').trim()
        : ''
  const contactIdRaw = String(formData.get('contactId') ?? '').trim()
  const contactText = String(formData.get('contactText') ?? '').trim()

  if (!date) fail('Date is required')
  if (!direction) fail('Direction is required')
  if (!accountId) fail('Select who handled this')
  if (!paidThroughAccountId) {
    fail(direction === 'TRANSFER' ? 'Select From account' : 'Select bank account')
  }
  if (!(amount > 0)) fail('Enter an amount greater than 0')
  if (direction === 'TRANSFER') {
    if (!transferToAccountId) fail('Select To account')
    if (transferToAccountId === paidThroughAccountId) {
      fail('From and To accounts must be different')
    }
  }

  const [account, paidThrough, transferTo, category] = await Promise.all([
    prisma.financeAccount.findFirst({ where: { id: accountId, active: true }, select: { id: true, name: true } }),
    prisma.financeAccount.findFirst({
      where: { id: paidThroughAccountId, active: true },
      select: { id: true, name: true, type: true },
    }),
    direction === 'TRANSFER' && transferToAccountId
      ? prisma.financeAccount.findFirst({
          where: { id: transferToAccountId, active: true },
          select: { id: true, name: true, type: true },
        })
      : Promise.resolve(null),
    direction !== 'TRANSFER' && categoryId
      ? prisma.financeCategory.findFirst({
          where: { id: categoryId, active: true, direction },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ])

  if (!account) fail('Account not found')
  if (!paidThrough) fail(direction === 'TRANSFER' ? 'From account not found' : 'Bank account not found')
  if (direction === 'TRANSFER' && !transferTo) fail('To account not found')
  if (categoryId && !category) fail('Category not found for this direction')

  const amountUnit: MobileTxnDraft['amountUnit'] =
    isVaultAccountType(paidThrough.type) || isVaultAccountType(transferTo?.type)
      ? 'GRAMS'
      : 'INR'

  const draft: MobileTxnDraft = {
    date,
    direction,
    amount: String(amount),
    amountUnit,
    description,
    accountId: account.id,
    paidThroughAccountId: paidThrough.id,
    transferToAccountId: direction === 'TRANSFER' ? transferTo!.id : '',
    categoryId: direction === 'TRANSFER' ? '' : category?.id ?? '',
    contactId: direction === 'TRANSFER' ? null : contactIdRaw || null,
    contactText: direction === 'TRANSFER' ? '' : contactText,
    accountName: account.name,
    paidThroughName: paidThrough.name,
    transferToName: direction === 'TRANSFER' ? transferTo!.name : '',
    categoryName: direction === 'TRANSFER' ? '' : category?.name ?? '',
  }

  const jar = await cookies()
  jar.set(MOBILE_TXN_COOKIE, JSON.stringify(draft), {
    path: '/',
    maxAge: 60 * 60,
    sameSite: 'lax',
    httpOnly: true,
  })

  redirect('/m/finance/txn/allocate')
}
