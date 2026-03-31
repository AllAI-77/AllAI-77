"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { updateMyName, changeMyPassword } from "@/lib/actions/profile.actions";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const nameSchema = z.object({
  name: z.string().min(2, "At least 2 characters").max(100),
});
type NameValues = z.infer<typeof nameSchema>;

const pwSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword:     z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  path:    ["confirmPassword"],
  message: "Passwords do not match",
});
type PwValues = z.infer<typeof pwSchema>;

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, title, icon: Icon }: {
  children: React.ReactNode;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
          <Icon className="h-4 w-4 text-blue-600" />
        </div>
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Name form ────────────────────────────────────────────────────────────────

function NameForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: NameValues) => updateMyName(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Name updated successfully");
      } else {
        toast.error(res.error);
      }
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Your full name"
          className="max-w-sm"
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={mutation.isPending}
        style={{ backgroundColor: "var(--brand-blue)" }}
      >
        {mutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
        )}
        Save Name
      </Button>
    </form>
  );
}

// ─── Password form ────────────────────────────────────────────────────────────

function PasswordForm() {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwValues>({
    resolver: zodResolver(pwSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: PwValues) => changeMyPassword(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Password changed successfully");
        reset();
        setDone(true);
        setTimeout(() => setDone(false), 4000);
      } else {
        toast.error(res.error);
      }
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="space-y-3 max-w-sm">
        <div className="space-y-1">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            {...register("currentPassword")}
            placeholder="••••••••"
          />
          {errors.currentPassword && (
            <p className="text-xs text-red-500">{errors.currentPassword.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            {...register("newPassword")}
            placeholder="Min. 8 characters"
          />
          {errors.newPassword && (
            <p className="text-xs text-red-500">{errors.newPassword.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            {...register("confirmPassword")}
            placeholder="Repeat new password"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        size="sm"
        disabled={mutation.isPending}
        style={{ backgroundColor: "var(--brand-blue)" }}
      >
        {mutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : done ? (
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-300" />
        ) : (
          <Lock className="h-3.5 w-3.5 mr-1.5" />
        )}
        {done ? "Changed!" : "Change Password"}
      </Button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500">Update your account information</p>
      </div>

      <Card title="Display Name" icon={User}>
        <NameForm />
      </Card>

      <Card title="Change Password" icon={Lock}>
        <PasswordForm />
      </Card>
    </div>
  );
}
