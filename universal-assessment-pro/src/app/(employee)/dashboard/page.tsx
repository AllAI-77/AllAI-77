import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  TrendingUp,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = { title: "My Dashboard" };

async function fetchEmployeeData(userId: string) {
  const [attempts, availableExams, certificates] = await Promise.all([
    db.examAttempt.findMany({
      where:   { userId },
      include: {
        exam:        { select: { id: true, title: true, passingScore: true, timeLimit: true } },
        certificate: { select: { id: true, verificationCode: true } },
      },
      orderBy: { startedAt: "desc" },
      take:    10,
    }),
    db.exam.findMany({
      where:   { isActive: true },
      include: {
        examCategories: { include: { category: true } },
        _count:         { select: { attempts: { where: { userId } } } },
      },
      orderBy: { createdAt: "desc" },
      take:    6,
    }),
    db.certificate.count({ where: { userId } }),
  ]);

  const completed = attempts.filter((a) => a.status === "COMPLETED");
  const passed    = completed.filter((a) => a.passed);
  const scores    = completed.map((a) => a.score ?? 0);
  const avgScore  = scores.length
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : 0;

  return { attempts, availableExams, certificates, completed, passed, avgScore };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EmployeeDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await fetchEmployeeData(session.user.id);

  const statCards = [
    {
      label: "Exams Taken",
      value: data.completed.length,
      icon:  ClipboardList,
      color: "text-blue-600",
      bg:    "bg-blue-50",
    },
    {
      label: "Passed",
      value: data.passed.length,
      icon:  CheckCircle2,
      color: "text-green-600",
      bg:    "bg-green-50",
    },
    {
      label: "Avg Score",
      value: `${data.avgScore}%`,
      icon:  TrendingUp,
      color: "text-purple-600",
      bg:    "bg-purple-50",
    },
    {
      label: "Certificates",
      value: data.certificates,
      icon:  Award,
      color: "text-amber-600",
      bg:    "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Welcome back{session.user.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Your learning progress and upcoming exams
        </p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3"
          >
            <div className={`rounded-lg p-2 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Available Exams */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Available Exams</h2>
            <Link
              href="/exams"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {data.availableExams.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No exams available right now.</p>
          ) : (
            <div className="space-y-3">
              {data.availableExams.map((exam) => {
                const attemptCount = exam._count.attempts;
                const totalQuestions = exam.examCategories.reduce(
                  (s, ec) => s + ec.questionCount, 0
                );
                return (
                  <div
                    key={exam.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 rounded-lg bg-blue-50 p-2 shrink-0">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {exam.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {totalQuestions} questions
                          </span>
                          {exam.timeLimit && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-400">
                              <Clock className="h-3 w-3" />
                              {exam.timeLimit} min
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            Pass: {exam.passingScore}%
                          </span>
                          {attemptCount > 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1">
                              Attempted {attemptCount}×
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/exams/${exam.id}`}
                      className={buttonVariants({ size: "sm" }) + " shrink-0 text-xs"}
                    >
                      {attemptCount > 0 ? "Retake" : "Start"}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent attempts */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Recent Attempts
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {data.attempts.length === 0 ? (
                <p className="text-xs text-gray-400 py-2 text-center">
                  No attempts yet. Start an exam!
                </p>
              ) : (
                data.attempts.slice(0, 6).map((attempt) => (
                  <div key={attempt.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-gray-800 leading-snug truncate flex-1">
                        {attempt.exam.title}
                      </p>
                      {attempt.status === "COMPLETED" ? (
                        attempt.passed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                        )
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {attempt.status === "COMPLETED" && attempt.score !== null && (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={attempt.score}
                          className="h-1 flex-1"
                        />
                        <span className="text-[10px] text-gray-500 shrink-0 w-8 text-right">
                          {attempt.score}%
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        {format(attempt.startedAt, "MMM d, yyyy")}
                      </span>
                      {attempt.status === "COMPLETED" && (
                        <Link
                          href={`/results/${attempt.id}`}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          View results
                        </Link>
                      )}
                      {attempt.status === "IN_PROGRESS" && (
                        <Link
                          href={`/exams/${attempt.exam.id}/take`}
                          className="text-[10px] text-amber-600 hover:underline font-medium"
                        >
                          Resume →
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
