import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Dashboard" };

export default function EmployeeDashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[var(--brand-blue)]">
        My Dashboard
      </h1>
      <p className="mt-2 text-gray-500">
        Assigned exams, results, and certificates — implemented in Step 5.
      </p>
    </div>
  );
}
