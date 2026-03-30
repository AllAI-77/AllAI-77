import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-blue-light)]">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-blue)]">
            <span className="text-2xl font-bold text-white">U</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--brand-blue)]">
            Universal Assessment Pro
          </h1>
          <p className="mt-1 text-sm text-gray-500">ATB Universalbank</p>
        </div>

        {/* Login form will be built in Step 2 */}
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          Login form — implemented in Step 2 (Authentication)
        </div>
      </div>
    </main>
  );
}
