"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Download, Search, Filter, Loader2,
  CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Badge }  from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  listAdminAttempts,
  type ListAdminAttemptsParams,
} from "@/lib/actions/attempt.actions";

const PAGE_SIZE = 25;

function StatusBadge({ status, passed }: { status: string; passed: boolean | null }) {
  if (status === "COMPLETED") {
    return passed ? (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-[10px]">
        <CheckCircle2 className="h-2.5 w-2.5" /> Passed
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-[10px]">
        <XCircle className="h-2.5 w-2.5" /> Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-[10px] text-gray-500">
      <Clock className="h-2.5 w-2.5" />
      {status === "IN_PROGRESS" ? "In Progress" : status}
    </Badge>
  );
}

export default function ReportsPage() {
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [from,       setFrom]       = useState("");
  const [to,         setTo]         = useState("");
  const [passed,     setPassed]     = useState<"" | "true" | "false">("");

  const params: ListAdminAttemptsParams = {
    page,
    limit: PAGE_SIZE,
    ...(search     ? { userId: undefined } : {}), // server-side name search not wired; filter client-side
    ...(examFilter ? { examId: examFilter } : {}),
    ...(from       ? { from }              : {}),
    ...(to         ? { to }                : {}),
    ...(passed !== "" ? { passed: passed === "true" } : {}),
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-attempts", params],
    queryFn:  () => listAdminAttempts(params),
    placeholderData: (prev) => prev,
  });

  const rows  = data?.success ? data.data.rows  : [];
  const total = data?.success ? data.data.total : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Client-side name/email filter on top of server results
  const filtered = search
    ? rows.filter(
        (r) =>
          r.user.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.user.email.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const exportUrl = `/api/export/attempts?${new URLSearchParams({
    ...(from   ? { from }   : {}),
    ...(to     ? { to }     : {}),
    ...(passed !== "" ? { passed } : {}),
  }).toString()}`;

  const reset = useCallback(() => {
    setSearch(""); setExamFilter(""); setFrom(""); setTo(""); setPassed(""); setPage(1);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500">{total} attempt{total !== 1 ? "s" : ""} total</p>
        </div>
        <a
          href={exportUrl}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          download
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export XLSX
        </a>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search employee…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 shrink-0">From</span>
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 shrink-0">To</span>
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
            />
          </div>

          <select
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700"
            value={passed}
            onChange={(e) => { setPassed(e.target.value as "" | "true" | "false"); setPage(1); }}
          >
            <option value="">All results</option>
            <option value="true">Passed only</option>
            <option value="false">Failed only</option>
          </select>

          <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-500" onClick={reset}>
            <Filter className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {(isLoading || isFetching) && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-gray-400 border-b border-gray-100">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead>
              <tr className="bg-gray-50">
                {["Employee", "Exam", "Score", "Result", "Started", "Completed"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    No attempts found.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-gray-800">{row.user.name ?? "—"}</p>
                      <p className="text-[10px] text-gray-400">{row.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700 max-w-[200px] truncate">{row.exam.title}</p>
                      <p className="text-[10px] text-gray-400">Pass: {row.exam.passingScore}%</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.score !== null ? (
                        <span className="text-xs font-semibold text-gray-800">{row.score}%</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={row.status} passed={row.passed} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-gray-500">
                      {format(new Date(row.startedAt), "dd MMM yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-gray-500">
                      {row.completedAt
                        ? format(new Date(row.completedAt), "dd MMM yyyy HH:mm")
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
            <p className="text-xs text-gray-400">
              Page {page} of {pages} · {total} total
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
