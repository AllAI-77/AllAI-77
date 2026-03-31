export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="h-4 w-24 rounded bg-gray-200 mb-3" />
            <div className="h-8 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="h-4 w-32 rounded bg-gray-200 mb-4" />
          <div className="h-48 rounded bg-gray-100" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="h-4 w-32 rounded bg-gray-200 mb-4" />
          <div className="h-48 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
