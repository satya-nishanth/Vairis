export default function AccountLoading() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 animate-pulse">
      <div className="h-9 w-48 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-28 bg-gray-200 rounded mb-12" />

      <div className="bg-gray-100 rounded-sm p-6 mb-6 space-y-3">
        <div className="h-2.5 w-16 bg-gray-200 rounded" />
        <div className="h-6 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-52 bg-gray-200 rounded" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-gray-100 rounded-sm p-5 h-28" />
        <div className="bg-gray-100 rounded-sm p-5 h-28" />
      </div>

      <div className="h-11 w-full bg-gray-200 rounded" />
    </div>
  )
}
