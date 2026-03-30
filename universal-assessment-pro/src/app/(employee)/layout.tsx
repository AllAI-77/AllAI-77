import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmployeeShell } from "@/components/employee/EmployeeShell";

export default async function EmployeeGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <EmployeeShell user={session.user}>
      {children}
    </EmployeeShell>
  );
}
