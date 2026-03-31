export default function UsersLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}
