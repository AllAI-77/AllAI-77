"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logOut } from "@/lib/actions/auth.actions";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  className?: string;
  variant?: "default" | "ghost" | "outline" | "destructive";
  showIcon?: boolean;
  label?: string;
}

export function SignOutButton({
  className,
  variant = "ghost",
  showIcon = true,
  label = "Sign Out",
}: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      className={cn("gap-2", className)}
      disabled={isPending}
      onClick={() => startTransition(() => logOut())}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : showIcon ? (
        <LogOut className="h-4 w-4" />
      ) : null}
      {label}
    </Button>
  );
}
