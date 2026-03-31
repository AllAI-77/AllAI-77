export default function CertificatesLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}
