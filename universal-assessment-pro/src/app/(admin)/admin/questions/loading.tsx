export default function QuestionsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 rounded-lg bg-gray-200" />
        <div className="h-9 w-36 rounded-lg bg-gray-200" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 flex-1 rounded-lg bg-gray-200" />
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="h-10 bg-gray-50 border-b border-gray-100" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50">
            <div className="h-4 flex-1 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-6 w-14 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
