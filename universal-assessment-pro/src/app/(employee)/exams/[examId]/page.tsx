import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookOpen, Clock, CheckCircle2, Users, BarChart2, Tag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Exam Details" };

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function ExamDetailPage({ params }: Props) {
  const { examId } = await params;
  const session    = await auth();
  if (!session?.user) return null;

  const exam = await db.exam.findUnique({
    where:   { id: examId, isActive: true },
    include: {
      examCategories: { include: { category: true } },
      _count:         { select: { attempts: { where: { userId: session.user.id } } } },
    },
  });
  if (!exam) notFound();

  const [stats, inProgress] = await Promise.all([
    db.examAttempt.aggregate({
      where:   { examId, status: "COMPLETED" },
      _count:  { id: true },
      _avg:    { score: true },
    }),
    db.examAttempt.findFirst({
      where:   { examId, userId: session.user.id, status: "IN_PROGRESS" },
      select:  { id: true },
    }),
  ]);

  const totalQ   = exam.examCategories.reduce((s, ec) => s + ec.questionCount, 0);
  const avgScore = stats._avg.score ? Math.round(stats._avg.score) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div
            className="rounded-xl p-3 shrink-0"
            style={{ backgroundColor: "var(--brand-blue-faint, #EFF4FF)" }}
          >
            <BookOpen className="h-7 w-7" style={{ color: "var(--brand-blue, #003DA5)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
            {exam.description && (
              <p className="mt-1 text-sm text-gray-500">{exam.description}</p>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: BookOpen, label: "Questions",  value: String(totalQ) },
            { icon: Clock,    label: "Time limit",  value: exam.timeLimit ? `${exam.timeLimit} min` : "Unlimited" },
            { icon: CheckCircle2, label: "Pass mark", value: `${exam.passingScore}%` },
            { icon: Users,    label: "Attempts",    value: String(stats._count.id ?? 0) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg bg-gray-50 px-3 py-2.5 text-center">
              <Icon className="mx-auto h-4 w-4 text-gray-400 mb-1" />
              <p className="text-sm font-semibold text-gray-800">{value}</p>
              <p className="text-[10px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {avgScore !== null && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
            <BarChart2 className="h-3.5 w-3.5" />
            Average score across all attempts: <span className="font-semibold text-gray-600">{avgScore}%</span>
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Tag className="h-4 w-4" />
          Topics covered
        </h2>
        <div className="flex flex-wrap gap-2">
          {exam.examCategories.map((ec) => (
            <div
              key={ec.category.id}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: ec.category.color ?? "#6B7280" }}
              />
              <span className="text-xs text-gray-700">{ec.category.name}</span>
              <span className="text-[10px] text-gray-400">{ec.questionCount} q</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rules */}
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-800">
        <h2 className="mb-2 font-semibold">Before you start</h2>
        <ul className="space-y-1 list-disc list-inside text-xs">
          <li>Switching browser tabs is monitored and recorded.</li>
          <li>Your progress is auto-saved every 30 seconds.</li>
          {exam.timeLimit && <li>The exam will auto-submit when time runs out.</li>}
          <li>You may flag questions to review before submitting.</li>
          {exam.randomize && <li>Questions are presented in random order.</li>}
        </ul>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-3">
        <Link
          href={`/exams/${examId}/take`}
          className={cn(buttonVariants(), "flex-1")}
        >
          {inProgress
            ? "Resume Exam"
            : exam._count.attempts > 0
            ? "Retake Exam"
            : "Start Exam"}
        </Link>
        <Link href="/exams" className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
      </div>
    </div>
  );
}
