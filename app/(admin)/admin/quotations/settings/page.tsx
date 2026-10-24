import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { DiscordUsersSettings } from './DiscordUsersSettings'
import { DiscordChannelSettings } from '@/components/admin/DiscordChannelSettings'

export const dynamic = 'force-dynamic'

export default async function QuotationSettingsPage() {
  const [users, channelSettings] = await Promise.all([
    prisma.quotationDiscordUser.findMany({
      orderBy: [{ active: 'desc' }, { handle: 'asc' }],
    }),
    prisma.quotationDiscordSettings.findUnique({ where: { id: 'default' } }),
  ])

  return (
    <div className="admin-page admin-page--quotations" style={{ maxWidth: 960 }}>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/admin/quotations" style={{ color: '#032b24', fontSize: '0.8125rem' }}>
          ← Quotations
        </Link>
      </p>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Quotation settings
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Configure Discord channels and @handle → user mappings for quote desk notifies.
      </p>

      <DiscordChannelSettings
        initial={{
          threadChannelId: channelSettings?.threadChannelId ?? null,
          pingChannelId: channelSettings?.pingChannelId ?? null,
          envThreadChannelId: process.env.DISCORD_QUOTE_CHANNEL_ID?.trim() || null,
        }}
      />

      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, margin: '0 0 1rem', color: '#111827' }}>
        User @handles
      </h2>
      <DiscordUsersSettings initial={users} />
    </div>
  )
}
