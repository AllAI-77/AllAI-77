"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import type { Role } from "@prisma/client";

const ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "BRANCH_MANAGER",
  "CONTENT_CREATOR",
];

export function useAuth() {
  const { data: session, status } = useSession();

  const user = session?.user;
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const isAdmin = useMemo(
    () => Boolean(user?.role && ADMIN_ROLES.includes(user.role as Role)),
    [user?.role]
  );

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isHrManager = user?.role === "HR_MANAGER";
  const isEmployee = user?.role === "EMPLOYEE";

  function hasRole(...roles: Role[]): boolean {
    if (!user?.role) return false;
    return roles.includes(user.role as Role);
  }

  return {
    user,
    session,
    status,
    isLoading,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isHrManager,
    isEmployee,
    hasRole,
  };
}
