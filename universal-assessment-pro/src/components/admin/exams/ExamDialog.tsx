"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { createExam, updateExam } from "@/lib/actions/exam.actions";
import type { ExamWithCategories } from "@/types";
import type { Category }          from "@prisma/client";

// ─── Form schema ──────────────────────────────────────────────────────────────

const formSchema = z.object({
  title:                z.string().min(3),
  description:          z.string().optional(),
  passingScore:         z.number().int().min(1).max(100),
  timeLimit:            z.number().int().min(1).max(480).optional(),
  timeLimitPerQuestion: z.number().int().min(10).max(600).optional(),
  randomize:            z.boolean(),
  allowReview:          z.boolean(),
  showAnswers:          z.boolean(),
  categories: z.array(
    z.object({
      categoryId:    z.string().min(1),
      questionCount: z.number().int().min(1),
    })
  ).min(1, "Add at least one category"),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface ExamDialogProps {
  open:       boolean;
  onClose:    () => void;
  onSuccess:  () => void;
  editing:    ExamWithCategories | null;
  categories: Array<Pick<Category, "id" | "name">>;
}

export function ExamDialog({
  open, onClose, onSuccess, editing, categories,
}: ExamDialogProps) {
  const isEdit = !!editing;

  const {
    register, control, handleSubmit, reset, watch,
    setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "", description: "", passingScore: 70,
      randomize: true, allowReview: true, showAnswers: false,
      categories: [{ categoryId: "", questionCount: 5 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "categories" });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        title:                editing.title,
        description:          editing.description ?? "",
        passingScore:         editing.passingScore,
        timeLimit:            editing.timeLimit    ?? undefined,
        timeLimitPerQuestion: editing.timeLimitPerQuestion ?? undefined,
        randomize:            editing.randomize,
        allowReview:          editing.allowReview,
        showAnswers:          editing.showAnswers,
        categories:           editing.examCategories.map((ec) => ({
          categoryId:    ec.category.id,
          questionCount: ec.questionCount,
        })),
      });
    } else {
      reset({
        title: "", description: "", passingScore: 70,
        randomize: true, allowReview: true, showAnswers: false,
        categories: [{ categoryId: "", questionCount: 5 }],
      });
    }
  }, [open, editing, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? updateExam({ ...data, id: editing!.id, isAdaptive: false, ipWhitelist: [] })
        : createExam({ ...data, isAdaptive: false, ipWhitelist: [] }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(isEdit ? "Exam updated" : "Exam created");
        onSuccess();
      } else {
        toast.error(res.error);
      }
    },
    onError: () => toast.error("Something went wrong"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Exam" : "New Exam"}</DialogTitle>
          <DialogDescription>Configure the exam structure and settings.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input {...register("title")} placeholder="Exam title" />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Description</Label>
            <textarea
              {...register("description")}
              rows={2}
              placeholder="Optional instructions shown before the exam…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Score + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Passing Score (%) <span className="text-red-500">*</span></Label>
              <Input type="number" {...register("passingScore", { valueAsNumber: true })} min={1} max={100} />
              {errors.passingScore && <p className="text-xs text-red-500">{errors.passingScore.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Time Limit (min)</Label>
              <Input type="number" {...register("timeLimit", { valueAsNumber: true })} placeholder="No limit" min={1} max={480} />
            </div>
            <div className="space-y-1">
              <Label>Per-Question (sec)</Label>
              <Input type="number" {...register("timeLimitPerQuestion", { valueAsNumber: true })} placeholder="No limit" min={10} />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-4">
            {(
              [
                { name: "randomize",   label: "Randomise question order" },
                { name: "allowReview", label: "Allow review before submit" },
                { name: "showAnswers", label: "Show correct answers after" },
              ] as const
            ).map(({ name, label }) => (
              <label key={name} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={watch(name)}
                  onCheckedChange={(v) => setValue(name, !!v)}
                />
                {label}
              </label>
            ))}
          </div>

          {/* Category mappings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categories & Question Counts <span className="text-red-500">*</span></Label>
              <Button
                type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1"
                onClick={() => append({ categoryId: "", questionCount: 5 })}
              >
                <Plus className="h-3 w-3" /> Add Category
              </Button>
            </div>
            {fields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Controller
                    name={`categories.${idx}.categoryId`}
                    control={control}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select category…" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <Input
                  type="number"
                  className="h-8 w-20 text-sm text-center"
                  {...register(`categories.${idx}.questionCount`, { valueAsNumber: true })}
                  min={1}
                  max={50}
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">questions</span>
                {fields.length > 1 && (
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-red-500"
                    onClick={() => remove(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {errors.categories && (
              <p className="text-xs text-red-500">
                {typeof errors.categories.message === "string"
                  ? errors.categories.message
                  : "Check category selections"}
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              style={{ backgroundColor: "var(--brand-blue)" }}
              className="text-white"
            >
              {mutation.isPending
                ? isEdit ? "Saving…" : "Creating…"
                : isEdit ? "Save Changes" : "Create Exam"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
