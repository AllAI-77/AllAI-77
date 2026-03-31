"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { ApiResponse } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeptStat {
  department: string;
  attempts:   number;
  passed:     number;
  passRate:   number;
}

export interface DailyStat {
  date:     string; // "YYYY-MM-DD"
  attempts: number;
  passed:   number;
}

export interface ExamStat {
  examId:   string;
  title:    string;
  attempts: number;
  passRate: number;
  avgScore: number;
}

export interface AnalyticsData {
  totals: {
    users:        number;
    attempts:     number;
    completed:    number;
    passed:       number;
    certificates: number;
    passRate:     number;
  };
  byDepartment: DeptStat[];
  dailyLast30:  DailyStat[];
  topExams:     ExamStat[];
  bottomExams:  ExamStat[];
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function getAnalytics(): Promise<ApiResponse<AnalyticsData>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      totalAttempts,
      totalCompleted,
      totalPassed,
      totalCerts,
      attemptsWithDept,
      recentAttempts,
      examAttemptStats,
    ] = await Promise.all([
      db.user.count({ where: { isActive: true } }),
      db.examAttempt.count(),
      db.examAttempt.count({ where: { status: "COMPLETED" } }),
      db.examAttempt.count({ where: { passed: true } }),
      db.certificate.count(),
      // Attempts grouped by department
      db.examAttempt.findMany({
        where: { status: "COMPLETED" },
        select: {
          passed: true,
          user:   { select: { department: { select: { name: true } } } },
        },
      }),
      // Recent 30 days
      db.examAttempt.findMany({
        where:   { startedAt: { gte: thirtyDaysAgo } },
        select:  { startedAt: true, passed: true, status: true },
        orderBy: { startedAt: "asc" },
      }),
      // Per exam stats
      db.examAttempt.findMany({
        where:  { status: "COMPLETED" },
        select: {
          passed: true,
          score:  true,
          exam:   { select: { id: true, title: true } },
        },
      }),
    ]);

    // Department breakdown
    const deptMap = new Map<string, { attempts: number; passed: number }>();
    for (const a of attemptsWithDept) {
      const dept = a.user.department?.name ?? "No Department";
      const cur  = deptMap.get(dept) ?? { attempts: 0, passed: 0 };
      cur.attempts++;
      if (a.passed) cur.passed++;
      deptMap.set(dept, cur);
    }
    const byDepartment: DeptStat[] = Array.from(deptMap.entries())
      .map(([department, { attempts, passed }]) => ({
        department,
        attempts,
        passed,
        passRate: attempts ? Math.round((passed / attempts) * 100) : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);

    // Daily stats last 30 days
    const dayMap = new Map<string, { attempts: number; passed: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayMap.set(d.toISOString().slice(0, 10), { attempts: 0, passed: 0 });
    }
    for (const a of recentAttempts) {
      const key = new Date(a.startedAt).toISOString().slice(0, 10);
      const cur = dayMap.get(key);
      if (cur) {
        cur.attempts++;
        if (a.passed) cur.passed++;
      }
    }
    const dailyLast30: DailyStat[] = Array.from(dayMap.entries()).map(
      ([date, { attempts, passed }]) => ({ date, attempts, passed })
    );

    // Per-exam stats
    const examMap = new Map<string, { title: string; attempts: number; passed: number; scoreSum: number }>();
    for (const a of examAttemptStats) {
      const key = a.exam.id;
      const cur = examMap.get(key) ?? { title: a.exam.title, attempts: 0, passed: 0, scoreSum: 0 };
      cur.attempts++;
      if (a.passed) cur.passed++;
      cur.scoreSum += a.score ?? 0;
      examMap.set(key, cur);
    }
    const examStats: ExamStat[] = Array.from(examMap.entries())
      .filter(([, v]) => v.attempts >= 1)
      .map(([examId, { title, attempts, passed, scoreSum }]) => ({
        examId,
        title,
        attempts,
        passRate: Math.round((passed / attempts) * 100),
        avgScore: Math.round(scoreSum / attempts),
      }));

    const sortedByPass = [...examStats].sort((a, b) => b.passRate - a.passRate);

    return {
      success: true,
      data: {
        totals: {
          users:        totalUsers,
          attempts:     totalAttempts,
          completed:    totalCompleted,
          passed:       totalPassed,
          certificates: totalCerts,
          passRate:     totalCompleted ? Math.round((totalPassed / totalCompleted) * 100) : 0,
        },
        byDepartment,
        dailyLast30,
        topExams:    sortedByPass.slice(0, 5),
        bottomExams: [...sortedByPass].reverse().slice(0, 5),
      },
    };
  } catch (err) {
    console.error("[getAnalytics]", err);
    return { success: false, error: "Failed to load analytics" };
  }
}
