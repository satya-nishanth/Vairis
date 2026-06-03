import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { guestFromMap, loadGuestMap } from '@/lib/catalogue-admin-guests'
import { normReaction } from '@/lib/catalogue-admin-stats'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, string> = {
  RINGS: 'Rings',
  EARRINGS: 'Earrings',
  PENDANTS: 'Pendants',
  BRACELETS: 'Bracelets',
}

function formatWhen(d: Date) {
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function normReaction(value: string) {
  return value.trim().toLowerCase()
}

type Props = { params: Promise<{ productId: string }> }

export default async function CatalogueProductFeedbackPage({ params }: Props) {
  const { productId } = await params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      itemCode: true,
      category: true,
      description: true,
      images: true,
      stoneType: true,
      caratWeight: true,
      isActive: true,
    },
  })

  if (!product) notFound()

  const [comments, reactions] = await Promise.all([
    prisma.catalogueComment.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.catalogueReaction.findMany({
      where: { productId },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
  ])

  const guestMap = await loadGuestMap([
    ...comments.map((c) => c.guestUserId),
    ...reactions.map((r) => r.guestUserId),
  ])

  const likes = reactions.filter((r) => normReaction(r.reaction) === 'like')
  const dislikes = reactions.filter((r) => normReaction(r.reaction) === 'dislike')

  return (
    <div className="p-4 md:p-8">
      <Link
        href="/admin/catalogue/comments"
        className="text-xs text-brand-gold hover:underline tracking-wide uppercase mb-4 inline-block"
      >
        ← All catalogue feedback
      </Link>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="w-full md:w-40 h-40 bg-brand-cream rounded-lg overflow-hidden relative shrink-0">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-brand-gold/30 font-display text-4xl">
              V
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 tracking-widest uppercase">
            {CATEGORY_LABELS[product.category] ?? product.category}
            {!product.isActive && ' · Inactive'}
          </p>
          <h1 className="font-display text-3xl text-gray-900 mt-1">{product.name}</h1>
          {product.itemCode && (
            <p className="text-sm text-gray-400 font-mono mt-1">{product.itemCode}</p>
          )}
          {product.stoneType && product.caratWeight != null && (
            <p className="text-sm text-gray-500 mt-1">
              {Number(product.caratWeight)}ctw · {product.stoneType}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2 max-w-2xl line-clamp-2">{product.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Likes</p>
          <p className="font-display text-3xl text-brand-gold">{likes.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Dislikes</p>
          <p className="font-display text-3xl text-gray-900">{dislikes.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Comments</p>
          <p className="font-display text-3xl text-gray-900">{comments.length}</p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-gray-600 tracking-widest uppercase mb-4">
          Comments ({comments.length})
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-lg px-6 py-8">
            No comments for this product yet.
          </p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                    Guest
                  </th>
                  <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                    Contact
                  </th>
                  <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                    Comment
                  </th>
                  <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {comments.map((c) => {
                  const guest = guestFromMap(guestMap, c.guestUserId)
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 align-top">
                      <td className="px-6 py-4">
                        <span className="font-medium text-sm text-gray-900">@{guest.username}</span>
                        {guest.createdAt.getTime() > 0 && (
                          <span className="text-xs text-gray-400 block">
                            Joined {formatWhen(guest.createdAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {guest.email !== '—' ? (
                          <a href={`mailto:${guest.email}`} className="hover:text-brand-gold block">
                            {guest.email}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        {guest.phone !== '—' && (
                          <a href={`tel:${guest.phone}`} className="hover:text-brand-gold block mt-1">
                            {guest.phone}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 max-w-md whitespace-pre-wrap">
                        {c.body}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatWhen(c.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-600 tracking-widest uppercase mb-4">
          Reactions ({reactions.length}
          {reactions.length >= 500 ? ', showing latest 500' : ''})
        </h2>
        {reactions.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-lg px-6 py-8">
            No likes or dislikes yet.
          </p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                    Guest
                  </th>
                  <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                    Contact
                  </th>
                  <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                    Reaction
                  </th>
                  <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reactions.map((r) => {
                  const guest = guestFromMap(guestMap, r.guestUserId)
                  const isLike = normReaction(r.reaction) === 'like'
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        @{guest.username}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <span className="block">{guest.email}</span>
                        <span className="block text-gray-400">{guest.phone}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isLike ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {isLike ? 'Like' : 'Dislike'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatWhen(r.updatedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
