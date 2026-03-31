"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Loader2, Building2, MapPin, Users,
} from "lucide-react";
import { Button }  from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import { Badge }   from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listBranches,    createBranch,    updateBranch,    deleteBranch,
  type DepartmentWithCount, type BranchWithCount,
} from "@/lib/actions/org.actions";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const deptSchema = z.object({
  name: z.string().min(2, "Min 2 chars").max(100),
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/, "Uppercase, numbers, _ or - only"),
});
type DeptValues = z.infer<typeof deptSchema>;

const branchSchema = z.object({
  name:   z.string().min(2, "Min 2 chars").max(100),
  code:   z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/, "Uppercase, numbers, _ or - only"),
  region: z.string().min(2, "Min 2 chars").max(100),
});
type BranchValues = z.infer<typeof branchSchema>;

// ─── Generic inline row dialog ─────────────────────────────────────────────────

function DeptDialog({
  open, onOpenChange, editing,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: DepartmentWithCount | null;
}) {
  const qc     = useQueryClient();
  const isEdit = !!editing;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DeptValues>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: "", code: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(editing ? { name: editing.name, code: editing.code } : { name: "", code: "" });
  }, [open, editing, reset]);

  const mutation = useMutation({
    mutationFn: (data: DeptValues) =>
      isEdit ? updateDepartment({ ...data, id: editing!.id }) : createDepartment(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(isEdit ? "Department updated" : "Department created");
        qc.invalidateQueries({ queryKey: ["departments"] });
        reset();
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Department" : "New Department"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input {...register("name")} placeholder="e.g. Credit Department" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Code <span className="text-red-500">*</span></Label>
            <Input {...register("code")} placeholder="CREDIT" className="font-mono uppercase" />
            {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BranchDialog({
  open, onOpenChange, editing,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: BranchWithCount | null;
}) {
  const qc     = useQueryClient();
  const isEdit = !!editing;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BranchValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: "", code: "", region: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? { name: editing.name, code: editing.code, region: editing.region }
        : { name: "", code: "", region: "" }
    );
  }, [open, editing, reset]);

  const mutation = useMutation({
    mutationFn: (data: BranchValues) =>
      isEdit ? updateBranch({ ...data, id: editing!.id }) : createBranch(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(isEdit ? "Branch updated" : "Branch created");
        qc.invalidateQueries({ queryKey: ["branches"] });
        reset();
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Branch" : "New Branch"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input {...register("name")} placeholder="e.g. Tashkent Main" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Code <span className="text-red-500">*</span></Label>
              <Input {...register("code")} placeholder="TSH-MAIN" className="font-mono uppercase" />
              {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Region <span className="text-red-500">*</span></Label>
              <Input {...register("region")} placeholder="Tashkent" />
              {errors.region && <p className="text-xs text-red-500">{errors.region.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared table header / row ─────────────────────────────────────────────────

function TableSection<T extends { id: string; name: string; code: string; _count: { users: number } }>({
  title, icon: Icon, items, isLoading, onAdd, onEdit, onDelete, extraCol,
}: {
  title: string;
  icon:  React.ComponentType<{ className?: string }>;
  items: T[];
  isLoading: boolean;
  onAdd:    () => void;
  onEdit:   (item: T) => void;
  onDelete: (id: string, hasUsers: boolean) => void;
  extraCol?: (item: T) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{items.length}</Badge>
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={onAdd}
          style={{ backgroundColor: "var(--brand-blue)" }}>
          <Plus className="h-3 w-3 mr-1" /> New
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No {title.toLowerCase()} yet.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-50 text-sm">
          <thead>
            <tr className="bg-gray-50/60">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Code</th>
              {extraCol && <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Region</th>}
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Users</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800 text-xs">{item.name}</td>
                <td className="px-5 py-3">
                  <code className="text-[11px] bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">{item.code}</code>
                </td>
                {extraCol && <td className="px-5 py-3 text-xs text-gray-500">{extraCol(item)}</td>}
                <td className="px-5 py-3">
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Users className="h-3 w-3" />
                    {item._count.users}
                  </span>
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      disabled={item._count.users > 0}
                      title={item._count.users > 0 ? "Has users — cannot delete" : "Delete"}
                      onClick={() => onDelete(item.id, item._count.users > 0)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizationPage() {
  const qc = useQueryClient();

  const [deptDialog,    setDeptDialog]    = useState(false);
  const [branchDialog,  setBranchDialog]  = useState(false);
  const [editingDept,   setEditingDept]   = useState<DepartmentWithCount | null>(null);
  const [editingBranch, setEditingBranch] = useState<BranchWithCount | null>(null);

  const { data: deptsData, isLoading: deptsLoading } = useQuery({
    queryKey: ["departments"],
    queryFn:  () => listDepartments(),
  });
  const { data: branchData, isLoading: branchLoading } = useQuery({
    queryKey: ["branches"],
    queryFn:  () => listBranches(),
  });

  const departments = deptsData?.success  ? deptsData.data  : [];
  const branches    = branchData?.success ? branchData.data : [];

  const delDept = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: (res) => {
      if (res.success) { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["departments"] }); }
      else toast.error(res.error);
    },
  });

  const delBranch = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: (res) => {
      if (res.success) { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["branches"] }); }
      else toast.error(res.error);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Organization</h2>
        <p className="text-sm text-gray-500">Manage departments and branch offices</p>
      </div>

      <TableSection
        title="Departments"
        icon={Building2}
        items={departments}
        isLoading={deptsLoading}
        onAdd={() => { setEditingDept(null); setDeptDialog(true); }}
        onEdit={(item) => { setEditingDept(item); setDeptDialog(true); }}
        onDelete={(id) => delDept.mutate(id)}
      />

      <TableSection
        title="Branches"
        icon={MapPin}
        items={branches}
        isLoading={branchLoading}
        onAdd={() => { setEditingBranch(null); setBranchDialog(true); }}
        onEdit={(item) => { setEditingBranch(item); setBranchDialog(true); }}
        onDelete={(id) => delBranch.mutate(id)}
        extraCol={(item) => (item as BranchWithCount).region}
      />

      <DeptDialog
        open={deptDialog}
        onOpenChange={setDeptDialog}
        editing={editingDept}
      />
      <BranchDialog
        open={branchDialog}
        onOpenChange={setBranchDialog}
        editing={editingBranch}
      />
    </div>
  );
}
