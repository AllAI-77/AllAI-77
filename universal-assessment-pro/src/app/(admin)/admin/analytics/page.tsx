"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, ClipboardCheck, Award, TrendingUp,
  Loader2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { getAnalytics } from "@/lib/actions/analytics.actions";
import { format, parseISO } from "date-fns";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-start gap-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: color + "1A" }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 mb-3">{children}</h3>
  );
}

const PASS_COLOR = "#22c55e";
const FAIL_COLOR = "#ef4444";
const BRAND     = "#003DA5";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn:  () => getAnalytics(),
    staleTime: 60_000,
  });

  if (isLoading || !data?.success) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    );
  }

  const { totals, byDepartment, dailyLast30, topExams, bottomExams } = data.data;

  return (
    <div className="space-y-7">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Employees" value={totals.users}        icon={Users}          color="#003DA5" />
        <StatCard label="Total Attempts"   value={totals.attempts}     icon={ClipboardCheck} color="#7c3aed" />
        <StatCard label="Certificates"     value={totals.certificates} icon={Award}          color="#d97706" />
        <StatCard
          label="Overall Pass Rate"
          value={`${totals.passRate}%`}
          sub={`${totals.passed} / ${totals.completed} completed`}
          icon={TrendingUp}
          color={totals.passRate >= 70 ? "#16a34a" : "#dc2626"}
        />
      </div>

      {/* Activity chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <SectionTitle>Daily Activity — Last 30 Days</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dailyLast30} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickFormatter={(v) => format(parseISO(v), "d MMM")}
              interval={4}
            />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => format(parseISO(v as string), "d MMM yyyy")}
              formatter={(value, name) => [value, name === "attempts" ? "Attempts" : "Passed"]}
            />
            <Line
              type="monotone" dataKey="attempts" stroke={BRAND}
              strokeWidth={2} dot={false} name="attempts"
            />
            <Line
              type="monotone" dataKey="passed" stroke={PASS_COLOR}
              strokeWidth={2} dot={false} name="passed"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded" style={{ background: BRAND }} />
            Attempts
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded" style={{ background: PASS_COLOR }} />
            Passed
          </span>
        </div>
      </div>

      {/* Department bar chart */}
      {byDepartment.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <SectionTitle>Pass Rate by Department</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={byDepartment}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#9ca3af" }} unit="%" />
              <YAxis
                type="category" dataKey="department"
                tick={{ fontSize: 10, fill: "#6b7280" }} width={120}
              />
              <Tooltip formatter={(v) => [`${v}%`, "Pass Rate"]} />
              <Bar dataKey="passRate" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {byDepartment.map((entry) => (
                  <Cell
                    key={entry.department}
                    fill={entry.passRate >= 70 ? PASS_COLOR : entry.passRate >= 50 ? "#f59e0b" : FAIL_COLOR}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top / Bottom exams */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top performers */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <SectionTitle>
            <span className="flex items-center gap-1.5 text-green-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Highest Pass Rate Exams
            </span>
          </SectionTitle>
          <div className="space-y-2">
            {topExams.length === 0 ? (
              <p className="text-xs text-gray-400">No data yet</p>
            ) : (
              topExams.map((ex) => (
                <div key={ex.examId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{ex.title}</p>
                    <p className="text-[10px] text-gray-400">{ex.attempts} attempt{ex.attempts !== 1 ? "s" : ""} · avg {ex.avgScore}%</p>
                  </div>
                  <span
                    className="text-xs font-bold shrink-0"
                    style={{ color: ex.passRate >= 70 ? "#16a34a" : "#d97706" }}
                  >
                    {ex.passRate}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom performers */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <SectionTitle>
            <span className="flex items-center gap-1.5 text-red-500">
              <ArrowDownRight className="h-3.5 w-3.5" />
              Lowest Pass Rate Exams
            </span>
          </SectionTitle>
          <div className="space-y-2">
            {bottomExams.length === 0 ? (
              <p className="text-xs text-gray-400">No data yet</p>
            ) : (
              bottomExams.map((ex) => (
                <div key={ex.examId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{ex.title}</p>
                    <p className="text-[10px] text-gray-400">{ex.attempts} attempt{ex.attempts !== 1 ? "s" : ""} · avg {ex.avgScore}%</p>
                  </div>
                  <span
                    className="text-xs font-bold shrink-0"
                    style={{ color: ex.passRate < 50 ? "#dc2626" : "#d97706" }}
                  >
                    {ex.passRate}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
