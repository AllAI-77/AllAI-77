"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#C8A951]" />

          <div className="w-full max-w-md text-center">
            {/* Logo */}
            <div className="mb-8">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#003DA5] text-white shadow-lg">
                <span className="text-2xl font-bold">U</span>
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-[#C8A951]">
                ATB Universalbank
              </p>
            </div>

            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-8 w-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>
            <p className="mb-2 text-sm text-gray-500">
              An unexpected error occurred. Our team has been notified.
            </p>
            {error.digest && (
              <p className="mb-6 font-mono text-xs text-gray-400">
                Error ID: {error.digest}
              </p>
            )}

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={reset}
                className="inline-flex h-10 items-center rounded-lg bg-[#003DA5] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#002d7a]"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>

          {/* Bottom accent */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#C8A951]" />
        </div>
      </body>
    </html>
  );
}
