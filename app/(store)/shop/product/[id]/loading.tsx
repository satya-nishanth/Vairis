export default function ProductLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-12 animate-pulse">
      <div className="flex gap-2 mb-8">
        <div className="h-3 w-8 bg-gray-200 rounded" />
        <div className="h-3 w-2 bg-gray-200 rounded" />
        <div className="h-3 w-16 bg-gray-200 rounded" />
        <div className="h-3 w-2 bg-gray-200 rounded" />
        <div className="h-3 w-28 bg-gray-200 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 lg:gap-20">
        <div className="aspect-square bg-gray-200 rounded-sm" />

        <div className="space-y-6">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
          <div className="h-16 w-full bg-gray-200 rounded" />
          <div className="h-px bg-gray-200" />
          <div className="space-y-3">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-24 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
          <div className="pt-4 space-y-3">
            <div className="h-14 w-full bg-gray-200 rounded" />
            <div className="h-12 w-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
