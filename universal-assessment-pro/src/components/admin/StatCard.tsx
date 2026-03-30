"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title:   string;
  value:   string | number;
  icon:    LucideIcon;
  sub?:    string;
  trend?:  { value: number; label: string };
  color?:  "blue" | "green" | "gold" | "red" | "purple";
  index?:  number;
}

const COLOR_MAP = {
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-500  text-white", text: "text-blue-600"   },
  green:  { bg: "bg-green-50",  icon: "bg-green-500 text-white", text: "text-green-600"  },
  gold:   { bg: "bg-amber-50",  icon: "bg-amber-500 text-white", text: "text-amber-600"  },
  red:    { bg: "bg-red-50",    icon: "bg-red-500   text-white", text: "text-red-600"    },
  purple: { bg: "bg-purple-50", icon: "bg-purple-500 text-white", text: "text-purple-600" },
};

export function StatCard({
  title, value, icon: Icon, sub, trend, color = "blue", index = 0,
}: StatCardProps) {
  const c = COLOR_MAP[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
          {trend && (
            <p className={cn("mt-1 text-xs font-medium", trend.value >= 0 ? "text-green-600" : "text-red-500")}>
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl", c.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
