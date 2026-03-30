import type { Metadata } from "next";
import { subDays, format } from "date-fns";
import { Users, BookOpen, ClipboardList, TrendingUp, Award } from "lucide-react";
import { db } from "@/lib/db";
import { StatCard } from "@/components/admin/StatCard";
import {
  AttemptTimelineChart,
  PassFailChart,
  ScoreDistributionChart,
  CategoryPerformanceChart,
  type TimelinePoint,
  type ScoreBucket,
  type CategoryStat,
} from "@/components/admin/DashboardCharts";

export const metadata: Metadata = { title: "Dashboard" };

// Revalidate every 5 minutes
export const revalidate = 300;

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function fetchDashboardData() {
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [
    totalUsers,
    activeUsers,
    totalQuestions,
    totalExams,
    recentAttempts,
    completedAttempts,
    categories,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.question.count({ where: { isActive: true } }),
    db.exam.count({ where: { isActive: true } }),
    // All attempts in last 30 days for timeline
    db.examAttempt.findMany({
      where:  { startedAt: { gte: thirtyDaysAgo } },
      select: { startedAt: true, passed: true, score: true, status: true },
      orderBy: { startedAt: "asc" },
    }),
    // All completed attempts for pass/fail & score distribution
    db.examAttempt.findMany({
      where:  { status: "COMPLETED" },
      select: { score: true, passed: true },
    }),
    // Categories with response stats for performance chart
    db.category.findMany({
      where:   { isActive: true },
      select: {
        name: true,
        questions: {
          select: {
            responses: {
              select: { isCorrect: true },
            },
          },
        },
      },
      take: 8,
    }),
  ]);

  // Stat row
  const passedCount = completedAttempts.filter((a) => a.passed).length;
  const failedCount = completedAttempts.filter((a) => !a.passed).length;
  const scores      = completedAttempts.map((a) => a.score ?? 0);
  const avgScore    = scores.length
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : 0;
  const passRate = completedAttempts.length
    ? Math.round((passedCount / completedAttempts.length) * 100)
    : 0;

  // Attempt timeline: group by day
  const timelineMap = new Map<string, { total: number; passed: number; failed: number }>();
  for (let i = 29; i >= 0; i--) {
    const day = format(subDays(new Date(), i), "MMM d");
    timelineMap.set(day, { total: 0, passed: 0, failed: 0 });
  }
  for (const a of recentAttempts) {
    const key = format(a.startedAt, "MMM d");
    const entry = timelineMap.get(key);
    if (entry) {
      entry.total++;
      if (a.passed === true)  entry.passed++;
      if (a.passed === false) entry.failed++;
    }
  }
  const timeline: TimelinePoint[] = Array.from(timelineMap.entries()).map(
    ([day, v]) => ({ day, ...v })
  );

  // Score distribution: 5 buckets
  const scoreBuckets: ScoreBucket[] = [
    { range: "0–20",  count: 0 },
    { range: "21–40", count: 0 },
    { range: "41–60", count: 0 },
    { range: "61–80", count: 0 },
    { range: "81–100", count: 0 },
  ];
  for (const { score } of completedAttempts) {
    const s = score ?? 0;
    if      (s <= 20) scoreBuckets[0].count++;
    else if (s <= 40) scoreBuckets[1].count++;
    else if (s <= 60) scoreBuckets[2].count++;
    else if (s <= 80) scoreBuckets[3].count++;
    else              scoreBuckets[4].count++;
  }

  // Category performance
  const categoryStats: CategoryStat[] = categories
    .map((cat) => {
      const allResponses  = cat.questions.flatMap((q) => q.responses);
      const correct       = allResponses.filter((r) => r.isCorrect === true).length;
      const total         = allResponses.length;
      const passRate      = total > 0 ? Math.round((correct / total) * 100) : 0;
      return { name: cat.name, passRate, total };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    stats: { totalUsers, activeUsers, totalQuestions, totalExams, passRate, avgScore },
    passedCount,
    failedCount,
    timeline,
    scoreBuckets,
    categoryStats,
    totalAttempts: completedAttempts.length,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const data = await fetchDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Analytics Overview</h2>
        <p className="mt-0.5 text-sm text-gray-500">Platform-wide statistics and trends</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          title="Total Users"
          value={data.stats.totalUsers}
          sub={`${data.stats.activeUsers} active`}
          icon={Users}
          color="blue"
          index={0}
        />
        <StatCard
          title="Active Exams"
          value={data.stats.totalExams}
          icon={ClipboardList}
          color="purple"
          index={1}
        />
        <StatCard
          title="Questions"
          value={data.stats.totalQuestions}
          icon={BookOpen}
          color="gold"
          index={2}
        />
        <StatCard
          title="Pass Rate"
          value={`${data.stats.passRate}%`}
          sub={`${data.totalAttempts} completed`}
          icon={TrendingUp}
          color="green"
          index={3}
        />
        <StatCard
          title="Avg Score"
          value={`${data.stats.avgScore}%`}
          icon={Award}
          color="red"
          index={4}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttemptTimelineChart data={data.timeline} />
        </div>
        <PassFailChart
          passCount={data.passedCount}
          failCount={data.failedCount}
        />
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ScoreDistributionChart data={data.scoreBuckets} />
        <CategoryPerformanceChart data={data.categoryStats} />
      </div>
    </div>
  );
}
