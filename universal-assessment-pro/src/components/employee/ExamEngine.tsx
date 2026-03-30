"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flag, ChevronLeft, ChevronRight, Clock, AlertTriangle,
  CheckCircle2, Send, Loader2, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { startAttempt, saveProgress, submitAttempt } from "@/lib/actions/attempt.actions";
import type { ExamSession, ExamQuestion } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "∞";
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EngineState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "taking"; session: ExamSession }
  | { phase: "submitting" }
  | { phase: "done"; attemptId: string };

// ─── ExamEngine ───────────────────────────────────────────────────────────────

export function ExamEngine({ examId }: { examId: string }) {
  const router = useRouter();
  const [state, setState] = useState<EngineState>({ phase: "loading" });

  // Derived from state.session when phase === "taking"
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [responses, setResponses]     = useState<Record<string, string | null>>({});
  const [flagged, setFlagged]         = useState<Set<string>>(new Set());
  const [timeRemaining, setTime]      = useState<number>(Infinity);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [showReview, setShowReview]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const timeSpentRef = useRef<Record<string, number>>({});
  const questionEnterRef = useRef<number>(Date.now());
  const saveIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load / resume session ────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const res = await startAttempt(examId);
      if (!res.success) {
        setState({ phase: "error", message: res.error });
        return;
      }
      const session = res.data;
      setState({ phase: "taking", session });
      setCurrentIdx(session.currentIndex);
      setResponses(session.responses);
      setFlagged(new Set(session.flagged));
      setTime(isFinite(session.timeRemaining) ? session.timeRemaining : Infinity);
    })();
  }, [examId]);

  // ── Countdown timer ──────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== "taking") return;
    if (!isFinite(timeRemaining)) return;

    timerIntervalRef.current = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // ── Auto-save every 30 s ─────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== "taking") return;

    saveIntervalRef.current = setInterval(() => {
      if (state.phase === "taking") {
        saveProgress(state.session.attemptId, {
          currentQuestionIndex: currentIdx,
          timeRemaining:        isFinite(timeRemaining) ? timeRemaining : 9999999,
          responses,
          flagged:              Array.from(flagged),
        }).catch(() => {});
      }
    }, 30_000);

    return () => { if (saveIntervalRef.current) clearInterval(saveIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, currentIdx, responses, flagged, timeRemaining]);

  // ── Tab-switch anti-cheat ────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== "taking") return;

    function onVisibility() {
      if (document.hidden) {
        setTabSwitches((n) => n + 1);
        setShowWarning(true);
        toast.warning("Tab switch detected! This will be recorded.", { id: "tab-warn" });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state.phase]);

  // ── Track time per question ──────────────────────────────────────────────

  const recordTimeForCurrent = useCallback(() => {
    if (state.phase !== "taking") return;
    const q = state.session.questions[currentIdx];
    if (!q) return;
    const elapsed = Math.floor((Date.now() - questionEnterRef.current) / 1000);
    timeSpentRef.current[q.id] = (timeSpentRef.current[q.id] ?? 0) + elapsed;
    questionEnterRef.current = Date.now();
  }, [state, currentIdx]);

  // ── Navigation ────────────────────────────────────────────────────────────

  function goTo(idx: number) {
    recordTimeForCurrent();
    setCurrentIdx(idx);
    questionEnterRef.current = Date.now();
  }

  // ── Respond ────────────────────────────────────────────────────────────────

  function respond(questionId: string, value: string | null) {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleFlag(questionId: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(questionId) ? next.delete(questionId) : next.add(questionId);
      return next;
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function doSubmit() {
    if (state.phase !== "taking") return;
    recordTimeForCurrent();
    setState({ phase: "submitting" });

    const res = await submitAttempt({
      attemptId:    state.session.attemptId,
      responses,
      timeSpent:    timeSpentRef.current,
      flagged:      Array.from(flagged),
      tabSwitchCount: tabSwitches,
    });

    if (!res.success) {
      toast.error(res.error);
      setState({ phase: "taking", session: state.session });
      return;
    }

    setState({ phase: "done", attemptId: res.data.attemptId });
    router.push(`/results/${res.data.attemptId}`);
  }

  async function handleAutoSubmit() {
    toast.info("Time is up — submitting your exam…");
    await doSubmit();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (state.phase === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="mx-auto max-w-md py-16 text-center space-y-3">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
        <p className="text-sm font-medium text-red-600">{state.message}</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (state.phase === "submitting" || state.phase === "done") {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Submitting your answers…</p>
      </div>
    );
  }

  const { session } = state;
  const questions: ExamQuestion[] = session.questions;
  const question   = questions[currentIdx];
  const answered   = Object.keys(responses).filter((k) => responses[k] !== null && responses[k] !== undefined).length;
  const isFlagged  = flagged.has(question?.id ?? "");
  const isLowTime  = isFinite(timeRemaining) && timeRemaining < 300; // < 5 min

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Top bar: timer + progress */}
      <div className="sticky top-[3.6rem] z-30 rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Progress value={(answered / questions.length) * 100} className="h-1.5 w-28" />
          <span className="text-xs text-gray-500 shrink-0">
            {answered}/{questions.length} answered
          </span>
        </div>

        <div className="flex items-center gap-2">
          {tabSwitches > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
              ⚠ {tabSwitches} tab switch{tabSwitches > 1 ? "es" : ""}
            </Badge>
          )}

          <motion.div
            animate={isLowTime ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1 }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-mono font-semibold ${
              isLowTime ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-700"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {formatTime(timeRemaining)}
          </motion.div>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
            onClick={() => setShowReview(true)}
          >
            <Eye className="h-3 w-3 mr-1" />
            Review
          </Button>
        </div>
      </div>

      {/* Main question area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
          className="rounded-xl border border-gray-200 bg-white p-6 space-y-5"
        >
          {/* Question header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  {question.type.replace("_", " ")}
                </Badge>
                {"•".repeat(question.difficulty).padEnd(5, "·").split("").map((c, i) => (
                  <span key={i} className={`text-xs ${c === "•" ? "text-amber-500" : "text-gray-200"}`}>●</span>
                ))}
              </div>
              <h2 className="text-base font-semibold text-gray-900">{question.title}</h2>
              {question.body && (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{question.body}</p>
              )}
            </div>
            <button
              onClick={() => toggleFlag(question.id)}
              className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                isFlagged ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400 hover:text-amber-500"
              }`}
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>

          {/* Answer options */}
          {(question.type === "MCQ" || question.type === "TRUE_FALSE") && (
            <div className="space-y-2.5">
              {question.options.map((opt) => {
                const selected = responses[question.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => respond(question.id, selected ? null : opt.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                      selected
                        ? "border-blue-400 bg-blue-50 text-blue-800 font-medium"
                        : "border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/50"
                    }`}
                  >
                    <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                      selected ? "border-blue-400 bg-blue-400 text-white" : "border-gray-300 text-gray-400"
                    }`}>
                      {selected ? "✓" : String.fromCharCode(65 + question.options.indexOf(opt))}
                    </span>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          )}

          {(question.type === "FILL_BLANK" || question.type === "CASE_STUDY") && (
            <textarea
              value={responses[question.id] ?? ""}
              onChange={(e) => respond(question.id, e.target.value || null)}
              placeholder="Type your answer here…"
              rows={question.type === "CASE_STUDY" ? 6 : 3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={currentIdx === 0}
          onClick={() => goTo(currentIdx - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {/* Question dot nav (compact) */}
        <div className="flex flex-wrap justify-center gap-1 max-w-sm">
          {questions.map((q, i) => {
            const isAns = responses[q.id] !== null && responses[q.id] !== undefined;
            const isFl  = flagged.has(q.id);
            const isCur = i === currentIdx;
            return (
              <button
                key={q.id}
                onClick={() => goTo(i)}
                className={`h-6 w-6 rounded text-[10px] font-medium transition-all ${
                  isCur
                    ? "bg-blue-600 text-white scale-110"
                    : isFl
                    ? "bg-amber-400 text-white"
                    : isAns
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {currentIdx < questions.length - 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => goTo(currentIdx + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setShowConfirm(true)}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Submit
          </Button>
        )}
      </div>

      {/* Tab switch warning dialog */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Tab Switch Detected
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            You have left the exam window {tabSwitches} time{tabSwitches > 1 ? "s" : ""}.
            This activity is recorded and may be reviewed by an administrator.
            Please remain on this page for the duration of the exam.
          </p>
          <DialogFooter>
            <Button onClick={() => setShowWarning(false)}>I understand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Review Questions</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2 py-2">
            {questions.map((q, i) => {
              const isAns = responses[q.id] !== null && responses[q.id] !== undefined;
              const isFl  = flagged.has(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => { goTo(i); setShowReview(false); }}
                  className={`h-9 w-full rounded-lg text-xs font-medium transition-all ${
                    isFl
                      ? "bg-amber-400 text-white"
                      : isAns
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-green-100 border border-green-300 inline-block" /> Answered</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400 inline-block" /> Flagged</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-gray-100 border border-gray-300 inline-block" /> Unanswered</span>
          </div>
          <DialogFooter>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white w-full"
              onClick={() => { setShowReview(false); setShowConfirm(true); }}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Submit Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm submit dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Submit Exam?
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 space-y-1">
            <p>You have answered <strong>{answered}</strong> of <strong>{questions.length}</strong> questions.</p>
            {questions.length - answered > 0 && (
              <p className="text-amber-700 font-medium">
                ⚠ {questions.length - answered} question{questions.length - answered > 1 ? "s" : ""} unanswered.
              </p>
            )}
            {flagged.size > 0 && (
              <p className="text-amber-700">
                {flagged.size} question{flagged.size > 1 ? "s" : ""} flagged for review.
              </p>
            )}
            <p className="pt-1">Once submitted, you cannot change your answers.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Keep reviewing
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={doSubmit}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Confirm Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
