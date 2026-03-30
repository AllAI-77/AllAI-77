import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";

export const metadata: Metadata = { title: "Check Your Email" };

export default function MagicLinkSentPage() {
  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-8 py-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <Mail className="h-8 w-8 text-[var(--brand-blue)]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500">
            A sign-in link has been sent to your corporate email address.
            The link expires in 10 minutes.
          </p>
          <div className="mt-6 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-400">
            Did not receive the email? Check your spam folder or contact IT
            Support at{" "}
            <a
              href="mailto:it-support@universalbank.uz"
              className="text-[var(--brand-blue)]"
            >
              it-support@universalbank.uz
            </a>
          </div>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-[var(--brand-blue)] hover:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
