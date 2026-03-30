"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, BookOpen, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

import { listQuestions, deleteQuestion } from "@/lib/actions/question.actions";
import { listCategories }                from "@/lib/actions/category.actions";
import { QuestionDialog }               from "@/components/admin/questions/QuestionDialog";
import type { QuestionWithOptions }     from "@/types";
import type { QuestionType }            from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<QuestionType, string> = {
  MCQ:        "MCQ",
  TRUE_FALSE: "True/False",
  CASE_STUDY: "Case Study",
  FILL_BLANK: "Fill Blank",
};

const TYPE_COLORS: Record<QuestionType, string> = {
  MCQ:        "bg-blue-100 text-blue-700",
  TRUE_FALSE: "bg-green-100 text-green-700",
  CASE_STUDY: "bg-purple-100 text-purple-700",
  FILL_BLANK: "bg-amber-100 text-amber-700",
};

const DIFFICULTY_STARS = (d: number) => "★".repeat(d) + "☆".repeat(5 - d);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestionsPage() {
  const qc = useQueryClient();

  const [search,     setSearch]     = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [type,       setType]       = useState<QuestionType | undefined>();
  const [page,       setPage]       = useState(1);

  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editing,       setEditing]       = useState<QuestionWithOptions | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionWithOptions | null>(null);

  // Debounce search
  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => { setDebouncedQ(v); setPage(1); },
      400
    );
  };

  // Queries
  const { data: categoriesRes } = useQuery({
    queryKey: ["categories"],
    queryFn:  () => listCategories(),
  });

  const { data, isFetching, isError } = useQuery({
    queryKey: ["questions", page, debouncedQ, categoryId, type],
    queryFn:  () =>
      listQuestions({ page, limit: 15, search: debouncedQ || undefined, categoryId, type }),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Question deleted");
        qc.invalidateQueries({ queryKey: ["questions"] });
      } else {
        toast.error(res.error);
      }
      setConfirmDelete(null);
    },
  });

  const questions = data?.success ? data.data.questions : [];
  const total     = data?.success ? data.data.total : 0;
  const pages     = data?.success ? data.data.pages : 1;
  const categories = categoriesRes?.success ? categoriesRes.data : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Question Bank</h2>
          <p className="text-sm text-gray-500">{total} question{total !== 1 ? "s" : ""}</p>
        </div>
        <Button
          className="gap-2"
          style={{ backgroundColor: "var(--brand-blue)" }}
          onClick={() => { setEditing(null); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4" /> New Question
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search questions…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Select value={categoryId ?? "all"} onValueChange={(v: string | null) => { setCategoryId(!v || v === "all" ? undefined : v); setPage(1); }}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type ?? "all"} onValueChange={(v: string | null) => { setType(!v || v === "all" ? undefined : v as QuestionType); setPage(1); }}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
      >
        {isError && (
          <Alert variant="destructive" className="m-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load questions.</AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-semibold">Question</TableHead>
              <TableHead className="text-xs font-semibold w-28">Type</TableHead>
              <TableHead className="text-xs font-semibold w-32">Category</TableHead>
              <TableHead className="text-xs font-semibold w-28">Difficulty</TableHead>
              <TableHead className="text-xs font-semibold w-20">Options</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching && questions.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : questions.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-400">No questions found</p>
                  </TableCell>
                </TableRow>
              )
              : questions.map((q) => (
                <TableRow key={q.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-sm max-w-xs">
                    <p className="truncate">{q.title}</p>
                    <p className="text-xs text-gray-400 truncate">{q.body.slice(0, 60)}…</p>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[q.type]}`}>
                      {TYPE_LABELS[q.type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{q.category.name}</TableCell>
                  <TableCell className="text-xs text-amber-500 tracking-widest">
                    {DIFFICULTY_STARS(q.difficulty)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{q.options.length}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-blue-600"
                        onClick={() => { setEditing(q); setDialogOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-600"
                        onClick={() => setConfirmDelete(q)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>

        {/* Pagination */}
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

      {/* Create / Edit Dialog */}
      <QuestionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        editing={editing}
        categories={categories}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["questions"] });
          setDialogOpen(false);
          setEditing(null);
        }}
      />

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Question?</DialogTitle>
            <DialogDescription>
              &ldquo;{confirmDelete?.title}&rdquo; will be deactivated. Existing exam results
              are preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
