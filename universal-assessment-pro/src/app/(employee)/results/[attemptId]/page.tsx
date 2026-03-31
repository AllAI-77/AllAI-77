import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAttemptResult } from "@/lib/actions/attempt.actions";
import { format } from "date-fns";
import {
  CheckCircle2, XCircle, Award, Clock, RotateCcw,
  LayoutDashboard,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ResultResponseList } from "@/components/employee/ResultResponseList";

export const metadata: Metadata = { title: "Exam Results" };

interface Props {
  params: Promise<{ attemptId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { attemptId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const res = await getAttemptResult(attemptId);
  if (!res.success) notFound();

  const attempt  = res.data;
  const passed   = attempt.passed ?? false;
  const score    = attempt.score ?? 0;
  const duration = attempt.completedAt && attempt.startedAt
    ? Math.floor((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Hero result card */}
      <div
        className={`rounded-2xl border p-6 text-center space-y-3 ${
          passed
            ? "border-green-200 bg-gradient-to-br from-green-50 to-emerald-50"
            : "border-red-200 bg-gradient-to-br from-red-50 to-rose-50"
        }`}
      >
        {passed ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {passed ? "Congratulations!" : "Better luck next time"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {attempt.exam.title}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2">
          <span className={`text-5xl font-bold ${passed ? "text-green-600" : "text-red-500"}`}>
            {score}%
          </span>
        </div>

        <div className="mx-auto max-w-xs">
          <Progress value={score} className="h-2" />
          <p className="mt-1 text-xs text-gray-500">
            Passing score: {attempt.exam.passingScore}%
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
          {duration !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {Math.floor(duration / 60)}m {duration % 60}s
            </span>
          )}
          <span>{attempt.responses.length} questions</span>
          <span>
            {attempt.responses.filter((r) => r.isCorrect === true).length} correct
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-400">
            {format(new Date(attempt.startedAt), "MMM d, yyyy")}
          </span>
        </div>

        {/* Certificate */}
        {attempt.certificate && (
          <div className="rounded-lg border border-green-200 bg-white/70 px-4 py-3 flex items-center gap-3 text-left">
            <Award className="h-6 w-6 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-800">Certificate earned!</p>
              <p className="text-[10px] text-gray-400 font-mono">
                {attempt.certificate.verificationCode}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-center")}
        >
          <LayoutDashboard className="h-4 w-4 mr-1.5" />
          Dashboard
        </Link>
        <Link
          href={`/exams/${attempt.exam.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-center")}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Retake
        </Link>
      </div>

      {/* Per-question breakdown (client component for accordion) */}
      {attempt.responses.length > 0 && (
        <ResultResponseList responses={attempt.responses} />
      )}
    </div>
  );
}
