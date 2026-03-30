import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = { title: "Authentication Error" };

interface Props {
  searchParams: Promise<{ error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign-in link is no longer valid.",
  OAuthSignin: "Could not start the sign-in process. Try again.",
  OAuthCallback: "Could not complete sign-in. Try again.",
  OAuthCreateAccount: "Could not create your account.",
  EmailCreateAccount: "Could not create your account.",
  Callback: "There was a problem during sign-in.",
  OAuthAccountNotLinked:
    "This email is already associated with another sign-in method.",
  EmailSignin: "The sign-in email could not be sent.",
  CredentialsSignin: "Invalid email or password.",
  SessionRequired: "Please sign in to access this page.",
  Default: "An unexpected error occurred during authentication.",
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const params = await searchParams;
  const errorCode = params.error ?? "Default";
  const message = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-8 py-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <ShieldAlert className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Authentication Error
          </h1>
          <p className="mt-2 text-sm text-gray-500">{message}</p>
          {errorCode !== "Default" && (
            <p className="mt-1 text-xs text-gray-400">Error code: {errorCode}</p>
          )}
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-[var(--brand-blue)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-blue-dark)]"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
