export default function OrganizationLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-40 rounded-lg bg-gray-200" />
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="h-7 w-16 rounded bg-gray-200" />
          </div>
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-4 px-5 py-3">
                <div className="h-4 w-36 rounded bg-gray-200 flex-1" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-12 rounded bg-gray-100" />
                <div className="h-6 w-14 rounded bg-gray-100 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
