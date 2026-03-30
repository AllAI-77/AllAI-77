"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Minus, ChevronDown, ChevronUp, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AttemptResult } from "@/lib/actions/attempt.actions";

type Response = AttemptResult["responses"][number];

export function ResultResponseList({ responses }: { responses: Response[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700">Question Breakdown</h2>
      {responses.map((r, i) => {
        const isOpen = expanded === r.id;

        return (
          <div
            key={r.id}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : r.id)}
            >
              {/* Result icon */}
              <span className="shrink-0">
                {r.isCorrect === true  ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                 r.isCorrect === false ? <XCircle      className="h-4 w-4 text-red-400"   /> :
                                        <Minus         className="h-4 w-4 text-gray-400"  />}
              </span>

              <span className="flex-1 min-w-0">
                <span className="text-[10px] text-gray-400 mr-2">Q{i + 1}</span>
                <span className="text-sm text-gray-700 truncate">{r.question.title}</span>
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {r.flaggedForReview && (
                  <Flag className="h-3 w-3 text-amber-400" />
                )}
                {r.timeSpent !== null && (
                  <span className="text-[10px] text-gray-400">{r.timeSpent}s</span>
                )}
                {isOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {r.question.body && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{r.question.body}</p>
                    )}

                    {/* Options */}
                    {r.question.options.length > 0 && (
                      <div className="space-y-1.5">
                        {r.question.options.map((opt) => {
                          const wasSelected = r.selectedOptionId === opt.id;
                          const isCorrect   = opt.isCorrect;
                          return (
                            <div
                              key={opt.id}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                                isCorrect === true && wasSelected
                                  ? "bg-green-50 border border-green-200 text-green-800"
                                  : isCorrect === true
                                  ? "bg-green-50 border border-green-200 text-green-800"
                                  : wasSelected && isCorrect === false
                                  ? "bg-red-50 border border-red-200 text-red-700"
                                  : "bg-gray-50 border border-gray-100 text-gray-600"
                              }`}
                            >
                              {wasSelected && <span className="text-xs font-bold">→</span>}
                              <span className="flex-1">{opt.text}</span>
                              {isCorrect === true && (
                                <Badge className="text-[9px] h-4 px-1 bg-green-500 text-white shrink-0">
                                  Correct
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Explanation */}
                    {r.question.explanation && (
                      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
                        <span className="font-semibold">Explanation: </span>
                        {r.question.explanation}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
