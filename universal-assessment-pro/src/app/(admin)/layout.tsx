import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "BRANCH_MANAGER",
  "CONTENT_CREATOR",
] as const;

export default async function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (!ADMIN_ROLES.includes(session.user.role as (typeof ADMIN_ROLES)[number])) {
    redirect("/dashboard");
  }

  return (
    <AdminShell user={session.user}>
      {children}
    </AdminShell>
  );
}
