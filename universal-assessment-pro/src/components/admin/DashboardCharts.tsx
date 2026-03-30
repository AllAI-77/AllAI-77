"use client";

import {
  LineChart, Line,
  BarChart,  Bar,
  PieChart,  Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelinePoint {
  day:    string;
  total:  number;
  passed: number;
  failed: number;
}

export interface ScoreBucket {
  range: string;
  count: number;
}

export interface CategoryStat {
  name:     string;
  passRate: number;
  total:    number;
}

interface ChartsProps {
  timeline:    TimelinePoint[];
  scoreBuckets: ScoreBucket[];
  categories:  CategoryStat[];
  passCount:   number;
  failCount:   number;
}

const BRAND_BLUE = "#003DA5";
const BRAND_GOLD = "#C8A951";
const PASS_COLOR = "#22c55e";
const FAIL_COLOR = "#ef4444";

// ─── Attempt Timeline ─────────────────────────────────────────────────────────

export function AttemptTimelineChart({ data }: { data: TimelinePoint[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Attempts (Last 30 Days)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Line type="monotone" dataKey="total"  stroke={BRAND_BLUE}  strokeWidth={2} dot={false} name="Total" />
          <Line type="monotone" dataKey="passed" stroke={PASS_COLOR}  strokeWidth={2} dot={false} name="Passed" />
          <Line type="monotone" dataKey="failed" stroke={FAIL_COLOR}  strokeWidth={2} dot={false} strokeDasharray="4 2" name="Failed" />
          <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ─── Pass / Fail Pie ──────────────────────────────────────────────────────────

export function PassFailChart({
  passCount, failCount,
}: {
  passCount: number; failCount: number;
}) {
  const data = [
    { name: "Passed", value: passCount, color: PASS_COLOR },
    { name: "Failed", value: failCount, color: FAIL_COLOR },
  ];
  const total = passCount + failCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Pass / Fail Rate</h3>
      {total === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">
          No completed attempts yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(value) => [
                `${value} (${total ? Math.round(((value as number) / total) * 100) : 0}%)`,
              ]}
            />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}

// ─── Score Distribution ───────────────────────────────────────────────────────

export function ScoreDistributionChart({ data }: { data: ScoreBucket[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="range" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Bar dataKey="count" name="Attempts" fill={BRAND_BLUE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ─── Category Performance ─────────────────────────────────────────────────────

export function CategoryPerformanceChart({ data }: { data: CategoryStat[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Category Pass Rate (%)</h3>
      {data.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">
          No data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
            <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(v) => [`${v}%`, "Pass Rate"]}
            />
            <Bar dataKey="passRate" name="Pass Rate" fill={BRAND_GOLD} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
