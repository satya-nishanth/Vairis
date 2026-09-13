'use client'

export type FinanceAccountOpt = {
  id: string
  name: string
  type?: string
  isVendorWallet?: boolean
}

export function isVendorFinanceAccount(a: Pick<FinanceAccountOpt, 'type' | 'isVendorWallet'>) {
  return a.type === 'VENDOR' || Boolean(a.isVendorWallet)
}

/** `<option>`s for account selects, grouped Accounts vs Vendors (A–Z within each). */
export function FinanceAccountSelectOptions({
  accounts,
  excludeId,
}: {
  accounts: FinanceAccountOpt[]
  excludeId?: string
}) {
  const list = (excludeId ? accounts.filter((a) => a.id !== excludeId) : accounts)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const company = list.filter((a) => !isVendorFinanceAccount(a))
  const vendors = list.filter((a) => isVendorFinanceAccount(a))

  return (
    <>
      {company.length > 0 ? (
        <optgroup label="Accounts">
          {company.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {vendors.length > 0 ? (
        <optgroup label="Vendors">
          {vendors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  )
}
