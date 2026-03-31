"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Users,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  Sparkles,
  Tag,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logOut } from "@/lib/actions/auth.actions";
import type { Role } from "@prisma/client";

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",  href: "/admin/dashboard",  icon: LayoutDashboard },
  { label: "Questions",  href: "/admin/questions",  icon: BookOpen },
  { label: "Exams",      href: "/admin/exams",      icon: ClipboardList },
  { label: "AI Studio",  href: "/admin/ai-studio",  icon: Sparkles,   roles: ["SUPER_ADMIN", "HR_MANAGER", "CONTENT_CREATOR"] as Role[] },
  { label: "Categories", href: "/admin/categories", icon: Tag,        roles: ["SUPER_ADMIN", "HR_MANAGER", "CONTENT_CREATOR"] as Role[] },
  { label: "Reports",    href: "/admin/reports",    icon: BarChart2,  roles: ["SUPER_ADMIN", "HR_MANAGER"] as Role[] },
  { label: "Users",      href: "/admin/users",      icon: Users,      roles: ["SUPER_ADMIN", "HR_MANAGER"] as Role[] },
];

interface AdminSidebarProps {
  user:     { name?: string | null; email: string; role: Role };
  isOpen:   boolean;
  onToggle: () => void;
}

export function AdminSidebar({ user, isOpen, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      animate={{ width: isOpen ? 240 : 64 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="relative flex flex-col flex-shrink-0 overflow-hidden"
      style={{ backgroundColor: "var(--brand-blue-dark, #002B7A)" }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-inner">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="ml-3 overflow-hidden whitespace-nowrap"
            >
              <p className="text-sm font-bold text-white leading-tight">
                UAP Admin
              </p>
              <p className="text-[10px] text-white/50 leading-tight">
                Universalbank
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-3">
        {NAV_ITEMS.filter(
          (item) => !item.roles || item.roles.includes(user.role)
        ).map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/8 hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-4.5 w-4.5 flex-shrink-0 transition-colors",
                  isActive ? "text-white" : "text-white/50 group-hover:text-white"
                )}
              />
              <AnimatePresence>
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute right-0 h-5 w-0.5 rounded-l-full bg-white"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + sign-out */}
      <div className="border-t border-white/10 p-2">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-2.5",
            !isOpen && "justify-center"
          )}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white uppercase">
            {user.name?.[0] ?? user.email[0]}
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 flex-1 overflow-hidden"
              >
                <p className="truncate text-xs font-semibold text-white">
                  {user.name ?? user.email}
                </p>
                <p className="truncate text-[10px] text-white/50">{user.role.replace("_", " ")}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {isOpen && (
            <button
              onClick={() => logOut()}
              className="flex-shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md text-gray-500 hover:text-gray-700 z-10"
      >
        {isOpen ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
    </motion.aside>
  );
}
