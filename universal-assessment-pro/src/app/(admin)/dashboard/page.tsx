import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default function AdminDashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[var(--brand-blue)]">
        Admin Dashboard
      </h1>
      <p className="mt-2 text-gray-500">
        Analytics and management tools — implemented in Step 4.
      </p>
    </div>
  );
}
