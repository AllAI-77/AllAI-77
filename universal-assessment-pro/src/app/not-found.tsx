import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      {/* Header accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#C8A951]" />

      <div className="w-full max-w-md text-center">
        {/* Logo area */}
        <div className="mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#003DA5] text-white shadow-lg">
            <span className="text-2xl font-bold">U</span>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-[#C8A951]">
            ATB Universalbank
          </p>
        </div>

        {/* 404 */}
        <h1 className="mb-2 text-8xl font-black text-[#003DA5]">404</h1>
        <h2 className="mb-3 text-xl font-semibold text-gray-800">Page Not Found</h2>
        <p className="mb-8 text-sm text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg bg-[#003DA5] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#002d7a]"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#C8A951]" />
    </div>
  );
}
