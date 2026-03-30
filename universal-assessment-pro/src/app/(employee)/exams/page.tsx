"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, ChevronRight, Search } from "lucide-react";
import { listExams } from "@/lib/actions/exam.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function BrowseExamsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["employee-exams", search, page],
    queryFn:  () => listExams({ isActive: true, search: search || undefined, page, limit: 12 }),
    placeholderData: (prev) => prev,
  });

  const exams  = data?.success ? data.data.exams  : [];
  const pages  = data?.success ? data.data.pages  : 1;

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Browse Exams</h1>
        <p className="mt-0.5 text-sm text-gray-500">Find and take available assessments</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search exams…"
          value={search}
          onChange={handleSearch}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No exams found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => {
            const totalQ = exam.examCategories.reduce((s, ec) => s + ec.questionCount, 0);
            return (
              <Link
                key={exam.id}
                href={`/exams/${exam.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 p-2.5 shrink-0">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors truncate">
                      {exam.title}
                    </h3>
                    {exam.description && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{exam.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {exam.examCategories.slice(0, 3).map((ec) => (
                    <Badge key={ec.category.id} variant="secondary" className="text-[10px] h-4 px-1.5">
                      {ec.category.name}
                    </Badge>
                  ))}
                  {exam.examCategories.length > 3 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      +{exam.examCategories.length - 3}
                    </Badge>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-3">
                    <span>{totalQ} questions</span>
                    {exam.timeLimit && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {exam.timeLimit} min
                      </span>
                    )}
                    <span>Pass: {exam.passingScore}%</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:text-blue-600 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-gray-500 px-2">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
