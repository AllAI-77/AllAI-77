import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

export const metadata: Metadata = { title: "Verifying Sign-In Link" };

interface Props {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function MagicLinkVerifyPage({ searchParams }: Props) {
  const params = await searchParams;

  if (params.error) {
    return (
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="px-8 py-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Link Expired</h1>
            <p className="mt-2 text-sm text-gray-500">
              This sign-in link has expired or has already been used. Please
              request a new one.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-[var(--brand-blue)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-blue-dark)]"
            >
              Request new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If we have a token, NextAuth will have already signed the user in
  // and redirected them. If we reach here without error, it was successful.
  redirect("/");

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-8 py-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Signed In!</h1>
          <p className="mt-2 text-sm text-gray-500">Redirecting you…</p>
        </div>
      </div>
    </div>
  );
}
