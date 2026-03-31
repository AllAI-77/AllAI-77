export default function AdminLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-gray-100"
          />
        ))}
      </div>
      {/* Chart row skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
      </div>
      {/* Table skeleton */}
      <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}
