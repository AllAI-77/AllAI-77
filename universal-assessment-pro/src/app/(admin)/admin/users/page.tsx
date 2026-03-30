"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plus, Search, Pencil, UserCheck, UserX, KeyRound, Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button }  from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import { Badge }   from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import {
  listUsers, setUserActive, resetUserPassword,
  createUser, updateUser, type SafeUser,
} from "@/lib/actions/user.actions";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Role } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN:     "Super Admin",
  HR_MANAGER:      "HR Manager",
  BRANCH_MANAGER:  "Branch Manager",
  CONTENT_CREATOR: "Content Creator",
  EMPLOYEE:        "Employee",
};

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN:     "bg-purple-100 text-purple-700",
  HR_MANAGER:      "bg-blue-100 text-blue-700",
  BRANCH_MANAGER:  "bg-teal-100 text-teal-700",
  CONTENT_CREATOR: "bg-amber-100 text-amber-700",
  EMPLOYEE:        "bg-gray-100 text-gray-600",
};

// ─── User form schema ─────────────────────────────────────────────────────────

const userFormSchema = z.object({
  name:     z.string().min(2),
  email:    z.string().email(),
  role:     z.enum(["SUPER_ADMIN","HR_MANAGER","BRANCH_MANAGER","CONTENT_CREATOR","EMPLOYEE"]),
  password: z.string().min(8).optional().or(z.literal("")),
});
type UserFormValues = z.infer<typeof userFormSchema>;

// ─── User dialog ──────────────────────────────────────────────────────────────

function UserDialog({
  open, onClose, onSuccess, editing,
}: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  editing: SafeUser | null;
}) {
  const isEdit = !!editing;
  const { register, control, handleSubmit, reset, formState: { errors } } =
    useForm<UserFormValues>({
      resolver: zodResolver(userFormSchema),
      defaultValues: { name: "", email: "", role: "EMPLOYEE", password: "" },
    });

  useState(() => {
    if (open && editing) {
      reset({ name: editing.name ?? "", email: editing.email, role: editing.role, password: "" });
    } else if (open) {
      reset({ name: "", email: "", role: "EMPLOYEE", password: "" });
    }
  });

  const mutation = useMutation({
    mutationFn: (data: UserFormValues) =>
      isEdit
        ? updateUser({ id: editing!.id, name: data.name, role: data.role as Role })
        : createUser({ name: data.name, email: data.email, role: data.role as Role, password: data.password || undefined }),
    onSuccess: (res) => {
      if (res.success) { toast.success(isEdit ? "User updated" : "User created"); onSuccess(); }
      else toast.error(res.error);
    },
    onError: () => toast.error("Something went wrong"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "New User"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update user details." : "Create a new portal account."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Full Name <span className="text-red-500">*</span></Label>
            <Input {...register("name")} placeholder="John Doe" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          {!isEdit && (
            <div className="space-y-1">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input {...register("email")} type="email" placeholder="john@universalbank.uz" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
          )}
          <div className="space-y-1">
            <Label>Role <span className="text-red-500">*</span></Label>
            <Controller name="role" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>
          {!isEdit && (
            <div className="space-y-1">
              <Label>Initial Password</Label>
              <Input {...register("password")} type="password" placeholder="Min 8 characters" />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}
              style={{ backgroundColor: "var(--brand-blue)" }} className="text-white">
              {mutation.isPending ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save" : "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset password dialog ────────────────────────────────────────────────────

function ResetPasswordDialog({
  userId, onClose,
}: { userId: string | null; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const mutation = useMutation({
    mutationFn: () => resetUserPassword(userId!, pwd),
    onSuccess: (res) => {
      if (res.success) { toast.success("Password reset"); onClose(); }
      else toast.error(res.error);
    },
  });

  return (
    <Dialog open={!!userId} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Set a new password for this user.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>New Password</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
              placeholder="Min 8 characters" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pwd.length < 8 || mutation.isPending} onClick={() => mutation.mutate()}
            className="bg-red-600 text-white hover:bg-red-700">
            {mutation.isPending ? "Resetting…" : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc = useQueryClient();

  const [search,      setSearch]      = useState("");
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [roleFilter,  setRoleFilter]  = useState<Role | undefined>();
  const [page,        setPage]        = useState(1);
  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [editing,     setEditing]     = useState<SafeUser | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => { setDebouncedQ(v); setPage(1); }, 400
    );
  };

  const { data, isFetching } = useQuery({
    queryKey: ["users", page, debouncedQ, roleFilter],
    queryFn:  () => listUsers({ page, limit: 15, search: debouncedQ || undefined, role: roleFilter }),
    placeholderData: (prev) => prev,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setUserActive(id, isActive),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`User ${res.data.isActive ? "activated" : "deactivated"}`);
        qc.invalidateQueries({ queryKey: ["users"] });
      } else toast.error(res.error);
    },
  });

  const users = data?.success ? data.data.users : [];
  const total = data?.success ? data.data.total : 0;
  const pages = data?.success ? data.data.pages : 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500">{total} user{total !== 1 ? "s" : ""}</p>
        </div>
        <Button className="gap-2" style={{ backgroundColor: "var(--brand-blue)" }}
          onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> New User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8 h-8 text-sm" placeholder="Search by name or email…"
            value={search} onChange={(e) => handleSearch(e.target.value)} />
        </div>
        <Select value={roleFilter ?? "all"} onValueChange={(v: string | null) => { setRoleFilter(!v || v === "all" ? undefined : v as Role); setPage(1); }}>
          <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-semibold">User</TableHead>
              <TableHead className="text-xs font-semibold w-36">Role</TableHead>
              <TableHead className="text-xs font-semibold w-24">Status</TableHead>
              <TableHead className="text-xs font-semibold w-32">Joined</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching && users.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : users.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-400">No users found</p>
                  </TableCell>
                </TableRow>
              )
              : users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white uppercase"
                          style={{ backgroundColor: "var(--brand-blue)" }}>
                          {(user.name ?? user.email)[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{user.name ?? "—"}</p>
                          <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.isActive
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-100"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600"
                          onClick={() => { setEditing(user); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-amber-600"
                          onClick={() => setResetUserId(user.id)} title="Reset password">
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className={`h-7 w-7 ${user.isActive ? "text-gray-400 hover:text-red-500" : "text-gray-400 hover:text-green-600"}`}
                          disabled={toggleActive.isPending}
                          onClick={() => toggleActive.mutate({ id: user.id, isActive: !user.isActive })}
                          title={user.isActive ? "Deactivate" : "Activate"}
                        >
                          {user.isActive
                            ? <UserX className="h-3.5 w-3.5" />
                            : <UserCheck className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </motion.div>

      <UserDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        editing={editing}
        onSuccess={() => { qc.invalidateQueries({ queryKey: ["users"] }); setDialogOpen(false); setEditing(null); }}
      />
      <ResetPasswordDialog userId={resetUserId} onClose={() => setResetUserId(null)} />
    </div>
  );
}
