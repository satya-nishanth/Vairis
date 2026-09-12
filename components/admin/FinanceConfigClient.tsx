'use client'

import { useState } from 'react'
import { FinanceAccountsManager, type AccountRow } from '@/components/admin/FinanceAccountsManager'
import { FinanceContactsManager, type ContactRow } from '@/components/admin/FinanceContactsManager'
import { FinanceCategoriesManager, type CategoryRow } from '@/components/admin/FinanceCategoriesManager'
import { FinanceDashboardKpiSettings } from '@/components/admin/FinanceDashboardKpiSettings'
import type { FinanceKpiSettings } from '@/lib/finance-settings'

const TABS = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'ledgers', label: 'Ledgers' },
  { id: 'categories', label: 'Categories' },
  { id: 'dashboard', label: 'Dashboard KPIs' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'tags', label: 'Tags' },
] as const

type TabId = (typeof TABS)[number]['id']

const pill: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 999,
  padding: '6px 14px',
  fontSize: '0.8125rem',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
}

const pillActive: React.CSSProperties = {
  ...pill,
  background: '#032b24',
  borderColor: '#032b24',
  color: '#fff',
  fontWeight: 600,
}

function ComingSoon({ label }: { label: string }) {
  return (
    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '12px 0' }}>
      {label} config is coming next — structure is ready in this tab.
    </p>
  )
}

export function FinanceConfigClient({
  accounts,
  contacts,
  categories,
  kpiSettings,
}: {
  accounts: AccountRow[]
  contacts: ContactRow[]
  categories: CategoryRow[]
  kpiSettings: FinanceKpiSettings
}) {
  const [tab, setTab] = useState<TabId>('accounts')

  return (
    <div>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}
        role="tablist"
        aria-label="Config sections"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            style={tab === t.id ? pillActive : pill}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' && (
        <>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0 }}>
            Partners, company bank, cash. Attach an email so login defaults to that account.
          </p>
          <FinanceAccountsManager initial={accounts} />
        </>
      )}
      {tab === 'contacts' && (
        <>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0 }}>
            Customers and vendors for tagging on transactions.
          </p>
          <FinanceContactsManager initial={contacts} />
        </>
      )}
      {tab === 'categories' && (
        <>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0 }}>
            Separate labels for inflow and outflow cashbook transactions.
          </p>
          <FinanceCategoriesManager initial={categories} />
        </>
      )}
      {tab === 'dashboard' && (
        <FinanceDashboardKpiSettings categories={categories} initial={kpiSettings} />
      )}
      {tab === 'ledgers' && <ComingSoon label="Ledgers" />}
      {tab === 'tags' && <ComingSoon label="Tags" />}
    </div>
  )
}
