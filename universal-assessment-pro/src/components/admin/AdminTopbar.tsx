"use client";

import { Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { logOut } from "@/lib/actions/auth.actions";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

const TITLE_MAP: Record<string, string> = {
  "/admin/dashboard":  "Dashboard",
  "/admin/questions":  "Question Bank",
  "/admin/exams":      "Exam Management",
  "/admin/users":      "User Management",
  "/admin/ai-studio":  "AI Studio",
  "/admin/categories":   "Categories",
  "/admin/analytics":    "Analytics",
  "/admin/reports":      "Reports",
  "/admin/organization": "Organization",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:     "Super Admin",
  HR_MANAGER:      "HR Manager",
  BRANCH_MANAGER:  "Branch Manager",
  CONTENT_CREATOR: "Content Creator",
  EMPLOYEE:        "Employee",
};

interface AdminTopbarProps {
  user:        { name?: string | null; email: string; role: Role };
  onMenuClick: () => void;
}

export function AdminTopbar({ user, onMenuClick }: AdminTopbarProps) {
  const pathname = usePathname();
  const title    = Object.entries(TITLE_MAP).find(
    ([path]) => pathname === path || pathname.startsWith(path + "/")
  )?.[1] ?? "Admin";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 gap-3">
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 text-gray-500"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold text-gray-800 truncate">{title}</h1>
      </div>

      {/* Right: notifications + user menu */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-gray-500">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-gray-100">
            <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white uppercase"
              style={{ backgroundColor: "var(--brand-blue, #003DA5)" }}
            >
              {user.name?.[0] ?? user.email[0]}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-gray-800 leading-tight truncate max-w-28">
                {user.name ?? user.email}
              </p>
              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 py-0 leading-tight mt-0.5">
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs">
              <p className="font-semibold">{user.name ?? "User"}</p>
              <p className="text-gray-400 font-normal truncate">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 cursor-pointer"
              onClick={() => logOut()}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
