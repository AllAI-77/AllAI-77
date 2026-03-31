export default function ProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="h-7 w-32 rounded-lg bg-gray-200" />
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-36 rounded bg-gray-200" />
            <div className="h-4 w-48 rounded bg-gray-100" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-9 w-full rounded-lg bg-gray-100" />
            </div>
          ))}
          <div className="h-9 w-28 rounded-lg bg-gray-200 mt-2" />
        </div>
      </div>
    </div>
  );
}
