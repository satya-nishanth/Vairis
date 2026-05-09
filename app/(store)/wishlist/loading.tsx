export default function WishlistLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-14 animate-pulse">
      <div className="text-center mb-12">
        <div className="h-3 w-20 bg-gray-200 rounded mx-auto mb-3" />
        <div className="h-10 w-48 bg-gray-200 rounded mx-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-square bg-gray-200 rounded-sm" />
            <div className="mt-3 space-y-2">
              <div className="h-2.5 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
