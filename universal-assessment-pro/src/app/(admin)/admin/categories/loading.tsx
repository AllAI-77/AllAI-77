export default function CategoriesLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-lg bg-gray-200" />
        <div className="h-9 w-36 rounded-lg bg-gray-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gray-200" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-28 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-100" />
              </div>
            </div>
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="h-8 w-full rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
