"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
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

import { createQuestion, updateQuestion } from "@/lib/actions/question.actions";
import type { QuestionWithOptions } from "@/types";
import type { Category } from "@prisma/client";

// ─── Local schema (avoids importing server-side Prisma enum at runtime) ───────

const formSchema = z.object({
  title:       z.string().min(3),
  body:        z.string().min(5),
  type:        z.enum(["MCQ", "TRUE_FALSE", "CASE_STUDY", "FILL_BLANK"]),
  difficulty:  z.number().int().min(1).max(5),
  categoryId:  z.string().min(1),
  explanation: z.string().optional(),
  changeNote:  z.string().optional(),
  options:     z.array(
    z.object({
      text:      z.string().min(1),
      isCorrect: z.boolean(),
      orderIndex: z.number().int(),
    })
  ).min(1),
});

type FormValues = z.infer<typeof formSchema>;

function defaultOptions(type: string) {
  if (type === "TRUE_FALSE") {
    return [
      { text: "True",  isCorrect: true,  orderIndex: 0 },
      { text: "False", isCorrect: false, orderIndex: 1 },
    ];
  }
  return [
    { text: "", isCorrect: true,  orderIndex: 0 },
    { text: "", isCorrect: false, orderIndex: 1 },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface QuestionDialogProps {
  open:       boolean;
  onClose:    () => void;
  onSuccess:  () => void;
  editing:    QuestionWithOptions | null;
  categories: Array<Pick<Category, "id" | "name">>;
}

export function QuestionDialog({
  open, onClose, onSuccess, editing, categories,
}: QuestionDialogProps) {
  const isEdit = !!editing;

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title:       "",
      body:        "",
      type:        "MCQ",
      difficulty:  3,
      categoryId:  "",
      explanation: "",
      changeNote:  "",
      options:     defaultOptions("MCQ"),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "options",
  });

  const selectedType = watch("type");

  // Reset form when dialog opens / editing changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        title:       editing.title,
        body:        editing.body,
        type:        editing.type,
        difficulty:  editing.difficulty,
        categoryId:  editing.categoryId,
        explanation: editing.explanation ?? "",
        changeNote:  "",
        options:     editing.options.map((o) => ({
          text:       o.text,
          isCorrect:  o.isCorrect,
          orderIndex: o.orderIndex,
        })),
      });
    } else {
      reset({
        title: "", body: "", type: "MCQ", difficulty: 3,
        categoryId: "", explanation: "", changeNote: "",
        options: defaultOptions("MCQ"),
      });
    }
  }, [open, editing, reset]);

  // Auto-update options when type changes to TRUE_FALSE
  useEffect(() => {
    if (selectedType === "TRUE_FALSE" && !isEdit) {
      setValue("options", defaultOptions("TRUE_FALSE"));
    }
  }, [selectedType, isEdit, setValue]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? updateQuestion({ ...data, id: editing!.id, imageUrl: undefined })
        : createQuestion({ ...data, imageUrl: undefined }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(isEdit ? "Question updated" : "Question created");
        onSuccess();
      } else {
        toast.error(res.error);
      }
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onSubmit = handleSubmit((data) => mutation.mutate(data));
  const showOptions = selectedType === "MCQ" || selectedType === "TRUE_FALSE";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Question" : "New Question"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update question details and answer options." : "Fill in the question details and options."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
            <Input id="title" {...register("title")} placeholder="Brief question title" />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          {/* Body */}
          <div className="space-y-1">
            <Label htmlFor="body">Question Body <span className="text-red-500">*</span></Label>
            <textarea
              id="body"
              {...register("body")}
              rows={3}
              placeholder="Full question text shown to the employee…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.body && <p className="text-xs text-red-500">{errors.body.message}</p>}
          </div>

          {/* Type + Category + Difficulty */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Type <span className="text-red-500">*</span></Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ">MCQ</SelectItem>
                      <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                      <SelectItem value="CASE_STUDY">Case Study</SelectItem>
                      <SelectItem value="FILL_BLANK">Fill in Blank</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Category <span className="text-red-500">*</span></Label>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoryId && <p className="text-xs text-red-500">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Difficulty <span className="text-red-500">*</span></Label>
              <Controller
                name="difficulty"
                control={control}
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v: string | null) => field.onChange(Number(v ?? 0))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5].map((d) => (
                        <SelectItem key={d} value={String(d)}>{"★".repeat(d)} ({d})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Options */}
          {showOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Answer Options <span className="text-red-500">*</span></Label>
                {selectedType === "MCQ" && fields.length < 8 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => append({ text: "", isCorrect: false, orderIndex: fields.length })}
                  >
                    <Plus className="h-3 w-3" /> Add Option
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <Checkbox
                      checked={watch(`options.${idx}.isCorrect`)}
                      onCheckedChange={(v) => setValue(`options.${idx}.isCorrect`, !!v)}
                      className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                    <Input
                      {...register(`options.${idx}.text`)}
                      placeholder={`Option ${idx + 1}`}
                      className="h-7 flex-1 border-0 bg-transparent text-sm focus-visible:ring-0 px-0"
                      readOnly={selectedType === "TRUE_FALSE"}
                    />
                    {watch(`options.${idx}.isCorrect`) && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    )}
                    {selectedType === "MCQ" && fields.length > 2 && (
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-500"
                        onClick={() => remove(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {errors.options && (
                <p className="text-xs text-red-500">
                  {typeof errors.options.message === "string"
                    ? errors.options.message
                    : "Check your options"}
                </p>
              )}
            </div>
          )}

          {/* Explanation */}
          <div className="space-y-1">
            <Label htmlFor="explanation">Explanation (optional)</Label>
            <textarea
              id="explanation"
              {...register("explanation")}
              rows={2}
              placeholder="Shown after the attempt if answers are revealed…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {isEdit && (
            <div className="space-y-1">
              <Label htmlFor="changeNote">Change Note</Label>
              <Input id="changeNote" {...register("changeNote")} placeholder="What changed?" />
            </div>
          )}

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
                : isEdit ? "Save Changes" : "Create Question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
