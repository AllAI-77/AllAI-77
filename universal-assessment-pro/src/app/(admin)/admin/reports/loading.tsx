export default function ReportsLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-14 w-full animate-pulse rounded-xl bg-gray-100" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}
