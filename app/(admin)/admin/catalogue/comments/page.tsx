import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, string> = {
  RINGS: 'Rings',
  EARRINGS: 'Earrings',
  PENDANTS: 'Pendants',
  BRACELETS: 'Bracelets',
}

export default async function CatalogueCommentsPage() {
  const [products, commentGroups, likeGroups, dislikeGroups] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, itemCode: true, category: true, images: true, isActive: true },
    }),
    prisma.catalogueComment.groupBy({
      by: ['productId'],
      _count: { _all: true },
    }),
    prisma.catalogueReaction.groupBy({
      by: ['productId'],
      where: { reaction: { equals: 'like', mode: 'insensitive' } },
      _count: { _all: true },
    }),
    prisma.catalogueReaction.groupBy({
      by: ['productId'],
      where: { reaction: { equals: 'dislike', mode: 'insensitive' } },
      _count: { _all: true },
    }),
  ])

  const commentMap = Object.fromEntries(commentGroups.map((r) => [r.productId, r._count._all]))
  const likeMap = Object.fromEntries(likeGroups.map((r) => [r.productId, r._count._all]))
  const dislikeMap = Object.fromEntries(dislikeGroups.map((r) => [r.productId, r._count._all]))

  const totalComments = commentGroups.reduce((n, r) => n + r._count._all, 0)
  const totalLikes = likeGroups.reduce((n, r) => n + r._count._all, 0)
  const totalDislikes = dislikeGroups.reduce((n, r) => n + r._count._all, 0)
  const withFeedback = products.filter(
    (p) => (commentMap[p.id] ?? 0) + (likeMap[p.id] ?? 0) + (dislikeMap[p.id] ?? 0) > 0
  )

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Catalogue</p>
        <h1 className="font-display text-3xl text-gray-900">Customer feedback</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-xl">
          Likes, dislikes, and comments from catalogue guests. Open a product to see full customer
          details.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Comments</p>
          <p className="font-display text-3xl text-gray-900">{totalComments}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Likes</p>
          <p className="font-display text-3xl text-brand-gold">{totalLikes}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Dislikes</p>
          <p className="font-display text-3xl text-gray-900">{totalDislikes}</p>
        </div>
      </div>

      {withFeedback.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-lg p-12 text-center text-gray-400">
          <p className="font-display text-xl mb-2">No catalogue feedback yet</p>
          <p className="text-sm">Comments and reactions will appear here once guests use the catalogue.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                  Product
                </th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                  Likes
                </th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                  Dislikes
                </th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                  Comments
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products
                .filter(
                  (p) =>
                    (commentMap[p.id] ?? 0) + (likeMap[p.id] ?? 0) + (dislikeMap[p.id] ?? 0) > 0
                )
                .map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-brand-cream rounded flex-shrink-0 overflow-hidden relative">
                          {p.images[0] ? (
                            <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand-gold/30 font-display text-lg">
                              V
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-sm text-gray-900 block">{p.name}</span>
                          <span className="text-xs text-gray-400 font-mono">{p.itemCode ?? '—'}</span>
                          <span className="text-xs text-gray-400 block">
                            {CATEGORY_LABELS[p.category] ?? p.category}
                            {!p.isActive && ' · Inactive'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm tabular-nums text-gray-700">{likeMap[p.id] ?? 0}</td>
                    <td className="px-6 py-4 text-sm tabular-nums text-gray-700">
                      {dislikeMap[p.id] ?? 0}
                    </td>
                    <td className="px-6 py-4 text-sm tabular-nums text-gray-700">
                      {commentMap[p.id] ?? 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/catalogue/comments/${p.id}`}
                        className="text-xs text-brand-gold hover:underline font-medium"
                      >
                        View details →
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-600 tracking-widest uppercase mb-4">
          All products ({products.length})
        </h2>
        <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                  Product
                </th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                  Likes
                </th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                  Dislikes
                </th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">
                  Comments
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <span className="font-medium text-sm text-gray-900">{p.name}</span>
                    <span className="text-xs text-gray-400 font-mono block">{p.itemCode ?? '—'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm tabular-nums text-gray-500">{likeMap[p.id] ?? 0}</td>
                  <td className="px-6 py-4 text-sm tabular-nums text-gray-500">{dislikeMap[p.id] ?? 0}</td>
                  <td className="px-6 py-4 text-sm tabular-nums text-gray-500">{commentMap[p.id] ?? 0}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/catalogue/comments/${p.id}`}
                      className="text-xs text-gray-500 hover:text-brand-gold"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
