import { prisma } from '@/lib/prisma'
import { SectionsManager } from './SectionsManager'

export const dynamic = 'force-dynamic'

export default async function AdminSectionsPage() {
  const [sections, collections] = await Promise.all([
    prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.collection.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, title: true },
    }),
  ])

  return (
    <div className="admin-page" style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Home Sections
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Ordered blocks rendered on the home page below the hero. Schedule with
        start/end dates for launches and festive edits. No sections = the
        built-in home layout, unchanged.
      </p>
      <SectionsManager
        sections={sections.map((s) => ({
          id: s.id,
          kind: s.kind,
          title: s.title ?? '',
          subtitle: s.subtitle ?? '',
          config: JSON.stringify(s.config, null, 2),
          active: s.active,
          sortOrder: s.sortOrder,
          startsAt: s.startsAt?.toISOString().slice(0, 10) ?? '',
          endsAt: s.endsAt?.toISOString().slice(0, 10) ?? '',
        }))}
        collections={collections}
      />
    </div>
  )
}
