import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { defaultFinanceAccountId, requireFinance } from '@/lib/finance-auth'
import { toDateInput } from '@/lib/finance'
import { continueToAllocate } from '@/app/m/finance/txn/actions'
import {
  FinanceAccountSelectOptions,
  type FinanceAccountOpt,
} from '@/components/admin/FinanceAccountSelectOptions'

export const dynamic = 'force-dynamic'

function todayIst(): string {
  try {
    return toDateInput(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export default async function MobileFinanceTxnPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await requireFinance()
  const sp = await searchParams
  const error = sp.error?.trim() || ''

  const [accounts, contacts, categories, defaultAccountId] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, isVendorWallet: true },
    }),
    prisma.financeContact.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
    prisma.financeCategory.findMany({
      where: {
        active: true,
        direction: { in: ['INFLOW', 'OUTFLOW'] },
      },
      orderBy: [{ direction: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, direction: true },
    }),
    defaultFinanceAccountId(session.user.email),
  ])

  const accountOpts: FinanceAccountOpt[] = accounts
  const inflowCats = categories.filter((c) => c.direction === 'INFLOW')
  const outflowCats = categories.filter((c) => c.direction === 'OUTFLOW')
  const date = todayIst()

  return (
    <div className="m-txn">
      <header className="m-txn__top">
        <Link className="m-txn__back" href="/admin/finance/transactions" aria-label="Back to finance">
          ‹
        </Link>
        <div className="m-txn__titles">
          <h1 className="m-txn__title">Add transaction</h1>
          <p className="m-txn__step">1 · Details</p>
        </div>
      </header>

      <div className="m-txn__body">
        <form action={continueToAllocate} method="post" className="m-txn__details-form">
          <label className="m-txn__field">
            <span>
              Date <span className="m-txn__req">*</span>
            </span>
            <input type="date" name="date" defaultValue={date} required />
          </label>

          <fieldset className="m-txn__dirs-fieldset">
            <legend className="m-txn__field" style={{ marginBottom: 8 }}>
              Direction <span className="m-txn__req">*</span>
            </legend>
            <div className="m-txn__dirs">
              <label className="m-txn__dir-label">
                <input
                  type="radio"
                  name="direction"
                  value="INFLOW"
                  defaultChecked
                  className="m-txn__dir-radio"
                />
                <span className="m-txn__dir">Inflow</span>
              </label>
              <label className="m-txn__dir-label">
                <input type="radio" name="direction" value="OUTFLOW" className="m-txn__dir-radio" />
                <span className="m-txn__dir">Outflow</span>
              </label>
              <label className="m-txn__dir-label">
                <input type="radio" name="direction" value="TRANSFER" className="m-txn__dir-radio" />
                <span className="m-txn__dir">Transfer</span>
              </label>
            </div>
          </fieldset>

          <div className="m-txn__row">
            <label className="m-txn__field">
              <span>
                Who handled this transaction <span className="m-txn__req">*</span>
              </span>
              <select name="accountId" defaultValue={defaultAccountId ?? ''} required>
                <option value="">— Select —</option>
                <FinanceAccountSelectOptions accounts={accountOpts} />
              </select>
            </label>

            <label className="m-txn__field m-txn__when-flow">
              <span>
                Which bank account was used <span className="m-txn__req">*</span>
              </span>
              <select name="paidThroughFlow" defaultValue="">
                <option value="">— Select —</option>
                <FinanceAccountSelectOptions accounts={accountOpts} />
              </select>
            </label>
          </div>

          <div className="m-txn__row m-txn__when-transfer">
            <label className="m-txn__field">
              <span>
                From <span className="m-txn__req">*</span>
              </span>
              <select name="paidThroughTransfer" defaultValue="">
                <option value="">— Select —</option>
                <FinanceAccountSelectOptions accounts={accountOpts} />
              </select>
            </label>
            <label className="m-txn__field">
              <span>
                To <span className="m-txn__req">*</span>
              </span>
              <select name="transferToAccountId" defaultValue="">
                <option value="">— Select —</option>
                <FinanceAccountSelectOptions accounts={accountOpts} />
              </select>
            </label>
          </div>

          <div className="m-txn__row m-txn__when-flow">
            <label className="m-txn__field">
              <span>Contact</span>
              <input
                name="contactText"
                list="m-txn-contacts"
                placeholder="Vendor / customer"
                autoComplete="off"
              />
              <datalist id="m-txn-contacts">
                {contacts.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
            <input type="hidden" name="contactId" value="" />

            <label className="m-txn__field m-txn__when-inflow">
              <span>Category</span>
              <select name="categoryInflow" defaultValue="">
                <option value="">— Select —</option>
                {inflowCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="m-txn__field m-txn__when-outflow">
              <span>Category</span>
              <select name="categoryOutflow" defaultValue="">
                <option value="">— Select —</option>
                {outflowCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="m-txn__field">
            Description
            <textarea name="description" placeholder="Optional note" rows={2} />
          </label>

          <label className="m-txn__field m-txn__amount">
            <span>
              Amount <span className="m-txn__req">*</span>
            </span>
            <input
              type="number"
              name="amount"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0"
              required
            />
            <span className="m-txn__hint">Vault accounts: enter grams</span>
          </label>

          {error ? <p className="m-txn__error">{error}</p> : null}

          <div className="m-txn__actions">
            <button type="submit" className="m-txn__btn m-txn__btn--primary">
              Next · Allocate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
