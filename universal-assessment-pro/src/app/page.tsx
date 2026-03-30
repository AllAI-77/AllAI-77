import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = ["SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER", "CONTENT_CREATOR"].includes(
    session.user.role
  );

  if (isAdmin) {
    redirect("/admin/dashboard");
  }

  redirect("/dashboard");
}
