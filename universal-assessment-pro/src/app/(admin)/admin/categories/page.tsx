"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Tag, Hash, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button }  from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import { Badge }   from "@/components/ui/badge";
import { Label }   from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  type CategoryWithChildren,
} from "@/lib/actions/category.actions";

// ─── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(2, "Name too short").max(100),
  slug:        z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  description: z.string().max(500).optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex colour"),
  icon:        z.string().max(50).optional(),
});
type FormValues = z.infer<typeof schema>;

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ─── Category dialog ──────────────────────────────────────────────────────────

function CategoryDialog({
  open, onOpenChange, editing,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: CategoryWithChildren | null;
}) {
  const qc     = useQueryClient();
  const isEdit = !!editing;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        name: "", slug: "", description: "", color: "#003DA5", icon: "",
      },
    });

  const nameValue = watch("name");

  // Auto-fill slug from name when creating
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEdit) setValue("slug", slugify(e.target.value));
  };

  // Reset when dialog opens
  useState(() => {
    if (open && editing) {
      reset({
        name:        editing.name,
        slug:        editing.slug,
        description: editing.description ?? "",
        color:       editing.color,
        icon:        editing.icon ?? "",
      });
    } else if (open && !editing) {
      reset({ name: "", slug: "", description: "", color: "#003DA5", icon: "" });
    }
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? updateCategory({ ...data, id: editing!.id })
        : createCategory(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(isEdit ? "Category updated" : "Category created");
        qc.invalidateQueries({ queryKey: ["categories"] });
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
          <DialogTitle>{isEdit ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input
              {...register("name")}
              placeholder="e.g. Credit Operations"
              onChange={(e) => { register("name").onChange(e); handleNameChange(e); }}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Slug <span className="text-red-500">*</span></Label>
            <Input {...register("slug")} placeholder="credit-operations" />
            {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Input {...register("description")} placeholder="Brief description…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...register("color")}
                  className="h-8 w-10 rounded cursor-pointer border border-gray-200"
                />
                <Input {...register("color")} className="font-mono text-xs" />
              </div>
              {errors.color && <p className="text-xs text-red-500">{errors.color.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Icon (emoji or name)</Label>
              <Input {...register("icon")} placeholder="📚 or shield-check" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState<CategoryWithChildren | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn:  () => listCategories(true),
  });
  const categories = data?.success ? data.data : [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Category deleted");
        qc.invalidateQueries({ queryKey: ["categories"] });
        setDeleteId(null);
      } else {
        toast.error(res.error);
        setDeleteId(null);
      }
    },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Categories</h2>
          <p className="text-sm text-gray-500">{categories.length} categor{categories.length !== 1 ? "ies" : "y"}</p>
        </div>
        <Button
          style={{ backgroundColor: "var(--brand-blue)" }}
          onClick={() => { setEditing(null); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Category
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : categories.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          No categories yet. Create one to get started.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-base"
                    style={{ backgroundColor: cat.color }}
                  >
                    {cat.icon ?? <Tag className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{cat.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                      <Hash className="h-2.5 w-2.5" />{cat.slug}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={cat.isActive ? "secondary" : "outline"}
                  className={`text-[9px] h-4 px-1.5 shrink-0 ${!cat.isActive ? "text-gray-400" : ""}`}
                >
                  {cat.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Description */}
              {cat.description && (
                <p className="text-xs text-gray-500 line-clamp-2">{cat.description}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {cat._count.questions} question{cat._count.questions !== 1 ? "s" : ""}
                </span>
                {cat.children.length > 0 && (
                  <span>{cat.children.length} sub-categor{cat.children.length !== 1 ? "ies" : "y"}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => { setEditing(cat); setDialogOpen(true); }}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 flex-1"
                  disabled={cat._count.questions > 0}
                  title={cat._count.questions > 0 ? "Cannot delete — has questions" : "Delete category"}
                  onClick={() => setDeleteId(cat.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-1">
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
