"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Badge }  from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { listExams, toggleExamActive } from "@/lib/actions/exam.actions";
import { listCategories }              from "@/lib/actions/category.actions";
import { ExamDialog }                  from "@/components/admin/exams/ExamDialog";
import type { ExamWithCategories }     from "@/types";

export default function ExamsPage() {
  const qc = useQueryClient();

  const [search,     setSearch]     = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page,       setPage]       = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState<ExamWithCategories | null>(null);

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => { setDebouncedQ(v); setPage(1); }, 400
    );
  };

  const { data, isFetching } = useQuery({
    queryKey: ["exams", page, debouncedQ],
    queryFn:  () => listExams({ page, limit: 10, search: debouncedQ || undefined }),
    placeholderData: (prev) => prev,
  });

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories"],
    queryFn:  () => listCategories(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleExamActive(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Exam ${res.data.isActive ? "activated" : "deactivated"}`);
        qc.invalidateQueries({ queryKey: ["exams"] });
      } else {
        toast.error(res.error);
      }
    },
  });

  const exams      = data?.success ? data.data.exams  : [];
  const total      = data?.success ? data.data.total  : 0;
  const pages      = data?.success ? data.data.pages  : 1;
  const categories = categoriesRes?.success ? categoriesRes.data : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Exams</h2>
          <p className="text-sm text-gray-500">{total} exam{total !== 1 ? "s" : ""} total</p>
        </div>
        <Button
          className="gap-2"
          style={{ backgroundColor: "var(--brand-blue)" }}
          onClick={() => { setEditing(null); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4" /> New Exam
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-8 h-8 text-sm"
          placeholder="Search exams…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-semibold">Exam</TableHead>
              <TableHead className="text-xs font-semibold w-24">Pass Score</TableHead>
              <TableHead className="text-xs font-semibold w-24">Time Limit</TableHead>
              <TableHead className="text-xs font-semibold w-32">Categories</TableHead>
              <TableHead className="text-xs font-semibold w-20">Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching && exams.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : exams.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <ClipboardList className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-400">No exams found</p>
                  </TableCell>
                </TableRow>
              )
              : exams.map((exam) => {
                  const totalQ = exam.examCategories.reduce(
                    (s, ec) => s + ec.questionCount, 0
                  );
                  return (
                    <TableRow key={exam.id} className="hover:bg-gray-50">
                      <TableCell>
                        <p className="font-medium text-sm">{exam.title}</p>
                        {exam.description && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">
                            {exam.description.slice(0, 60)}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">{totalQ} questions</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-gray-700">
                          {exam.passingScore}%
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {exam.timeLimit ? `${exam.timeLimit} min` : "No limit"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {exam.examCategories.slice(0, 2).map((ec) => (
                            <Badge key={ec.id} variant="secondary" className="text-[10px] px-1.5 h-4">
                              {ec.category.name}
                            </Badge>
                          ))}
                          {exam.examCategories.length > 2 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                              +{exam.examCategories.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={exam.isActive
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                          }
                        >
                          {exam.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-blue-600"
                            onClick={() => { setEditing(exam); setDialogOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className={`h-7 w-7 ${exam.isActive ? "text-green-500 hover:text-gray-500" : "text-gray-400 hover:text-green-600"}`}
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate(exam.id)}
                            title={exam.isActive ? "Deactivate" : "Activate"}
                          >
                            {exam.isActive
                              ? <ToggleRight className="h-4 w-4" />
                              : <ToggleLeft  className="h-4 w-4" />
                            }
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
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

      {/* Create / Edit Dialog */}
      <ExamDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        editing={editing}
        categories={categories}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["exams"] });
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
