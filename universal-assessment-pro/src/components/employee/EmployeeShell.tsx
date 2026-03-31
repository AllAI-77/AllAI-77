"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Award, LogOut, Menu, X, UserCircle } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logOut } from "@/lib/actions/auth.actions";
import type { Role } from "@prisma/client";

const NAV = [
  { href: "/dashboard",    label: "My Dashboard", icon: LayoutDashboard },
  { href: "/exams",        label: "Browse Exams",  icon: ClipboardList },
  { href: "/certificates", label: "Certificates",  icon: Award },
  { href: "/profile",      label: "My Profile",    icon: UserCircle },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:     "Super Admin",
  HR_MANAGER:      "HR Manager",
  BRANCH_MANAGER:  "Branch Manager",
  CONTENT_CREATOR: "Content Creator",
  EMPLOYEE:        "Employee",
};

interface EmployeeUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
}

export function EmployeeShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: EmployeeUser;
}) {
  const pathname    = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 h-14 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between px-4 gap-3">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-white text-[10px] font-bold"
              style={{ backgroundColor: "var(--brand-blue, #003DA5)" }}
            >
              UAP
            </span>
            <span className="hidden sm:block text-sm font-semibold text-gray-800">
              Universal Assessment Pro
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right: user info + sign out */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-gray-800 leading-tight">
                {user.name ?? user.email}
              </span>
              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 py-0 mt-0.5">
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex items-center gap-1.5 text-gray-500 text-xs"
              onClick={() => logOut()}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-gray-200 bg-white md:hidden z-30"
          >
            <nav className="flex flex-col gap-1 px-4 py-2">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      active ? "bg-blue-50 text-blue-700" : "text-gray-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
              <button
                onClick={() => logOut()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="flex-1">
        <div className="mx-auto max-w-screen-xl px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
