import HeroImageManager from '@/components/admin/HeroImageManager'

export const dynamic = 'force-dynamic'

export default function AdminHeroImagesPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-4 md:p-6 max-w-7xl w-full">
      <header className="shrink-0 pb-4">
        <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-1">Storefront</p>
        <h1 className="font-display text-2xl md:text-3xl text-gray-900">Landing Page</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Upload and arrange hero banner slides. Drag to reorder — changes apply on the homepage banner. Only active slides appear on the site.
        </p>
      </header>

      <HeroImageManager />
    </div>
  )
}
