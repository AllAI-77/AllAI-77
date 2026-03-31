import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, ClipboardList, Users, CheckCircle2, XCircle,
  TrendingUp, Clock, BookOpen, Award,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Exam Details" };

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function ExamDetailPage({ params }: Props) {
  const { examId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const adminRoles = ["SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER", "CONTENT_CREATOR"];
  if (!adminRoles.includes(session.user.role)) redirect("/dashboard");

  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      examCategories: {
        include: { category: { select: { id: true, name: true, color: true } } },
      },
      _count: { select: { attempts: true } },
    },
  });

  if (!exam) notFound();

  // Stats from completed attempts
  const completedAttempts = await db.examAttempt.findMany({
    where:  { examId, status: "COMPLETED" },
    select: { score: true, passed: true, startedAt: true, completedAt: true },
    orderBy: { startedAt: "desc" },
  });

  const totalAttempts    = exam._count.attempts;
  const totalCompleted   = completedAttempts.length;
  const totalPassed      = completedAttempts.filter((a) => a.passed).length;
  const scores           = completedAttempts.map((a) => a.score ?? 0);
  const avgScore         = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
  const passRate         = totalCompleted ? Math.round((totalPassed / totalCompleted) * 100) : 0;

  // Score distribution buckets: 0-9, 10-19, ... 90-100
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${i === 9 ? 100 : i * 10 + 9}`,
    count: completedAttempts.filter((a) => {
      const s = a.score ?? 0;
      return i === 9 ? s >= 90 : s >= i * 10 && s < (i + 1) * 10;
    }).length,
  }));
  const maxBucket = Math.max(...buckets.map((b) => b.count), 1);

  // Recent 10 attempts
  const recentAttempts = await db.examAttempt.findMany({
    where:   { examId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { startedAt: "desc" },
    take:    10,
  });

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/exams" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{exam.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={exam.isActive ? "secondary" : "outline"} className="text-[10px] h-4">
              {exam.isActive ? "Active" : "Inactive"}
            </Badge>
            <span className="text-xs text-gray-400">
              Pass mark: {exam.passingScore}%
              {exam.timeLimit ? ` · ${exam.timeLimit} min` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Attempts",  value: totalAttempts,  icon: Users,        color: "#003DA5" },
          { label: "Completed",       value: totalCompleted, icon: ClipboardList, color: "#7c3aed" },
          { label: "Pass Rate",       value: `${passRate}%`, icon: TrendingUp,    color: passRate >= 70 ? "#16a34a" : "#dc2626" },
          { label: "Average Score",   value: `${avgScore}%`, icon: Award,         color: "#d97706" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: color + "18" }}>
              <Icon className="h-4.5 w-4.5" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
              <p className="text-[11px] text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Score distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Score Distribution</h2>
          {totalCompleted === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No completed attempts yet.</p>
          ) : (
            <div className="space-y-1.5">
              {buckets.map((b) => (
                <div key={b.range} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono w-12 shrink-0">{b.range}%</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width:      `${(b.count / maxBucket) * 100}%`,
                        background: b.range.startsWith(`${exam.passingScore}`) || parseInt(b.range) >= exam.passingScore
                          ? "#22c55e" : "#94a3b8",
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 w-6 text-right">{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Category Breakdown</h2>
          {exam.examCategories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No categories configured.</p>
          ) : (
            <div className="space-y-2">
              {exam.examCategories.map((ec) => (
                <div key={ec.id} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ec.category.color }}
                  />
                  <span className="flex-1 text-xs text-gray-700 truncate">{ec.category.name}</span>
                  <span className="text-xs font-medium text-gray-500">{ec.questionCount} q.</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Total questions</span>
                <span className="text-xs font-semibold text-gray-700">
                  {exam.examCategories.reduce((s, ec) => s + ec.questionCount, 0)}
                </span>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
            {[
              { label: "Randomise",    value: exam.randomize },
              { label: "Allow Review", value: exam.allowReview },
              { label: "Show Answers", value: exam.showAnswers },
              { label: "Adaptive",     value: exam.isAdaptive },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-1.5">
                {value
                  ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                  : <XCircle     className="h-3 w-3 text-gray-300" />
                }
                <span className="text-[11px] text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent attempts */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent Attempts</h2>
          <Link
            href={`/admin/reports?examId=${exam.id}`}
            className="text-xs text-[#003DA5] hover:underline"
          >
            View all in Reports →
          </Link>
        </div>
        {recentAttempts.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No attempts yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-50 text-sm">
            <thead>
              <tr className="bg-gray-50/60">
                {["Employee", "Status", "Score", "Started"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentAttempts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-medium text-gray-800">{a.user.name ?? "—"}</p>
                    <p className="text-[10px] text-gray-400">{a.user.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    {a.status === "COMPLETED" ? (
                      a.passed
                        ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Passed</Badge>
                        : <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Failed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-gray-500">
                        {a.status === "IN_PROGRESS" ? "In Progress" : a.status}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">
                    {a.score !== null ? `${a.score}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-gray-500">
                    {format(new Date(a.startedAt), "d MMM yyyy HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
