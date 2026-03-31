export default function ExamsLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}
