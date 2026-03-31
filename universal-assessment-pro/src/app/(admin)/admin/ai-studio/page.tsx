"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Globe, Trash2, Check, X,
  PlusCircle, Loader2, ChevronDown, ChevronUp, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listKnowledgeSources,
  addKnowledgeSource,
  deleteKnowledgeSource,
  scrapeAndGenerate,
  listGeneratedQuestions,
  approveGeneratedQuestion,
  rejectGeneratedQuestion,
  type GenerateParams,
  type GeneratedQuestionRow,
} from "@/lib/actions/ai.actions";
import { listCategories } from "@/lib/actions/category.actions";
import { format } from "date-fns";
import type { KnowledgeSourceType } from "@prisma/client";

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  CBU_GUIDELINES: "CBU Regulation",
  BANK_WEBSITE:   "Bank Website",
  MANUAL_UPLOAD:  "Manual Upload",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiStudioPage() {
  const qc = useQueryClient();

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: sourcesRes, isLoading: loadingSources } = useQuery({
    queryKey: ["knowledge-sources"],
    queryFn:  listKnowledgeSources,
  });

  const { data: questionsRes, isLoading: loadingQ } = useQuery({
    queryKey: ["generated-questions", "PENDING"],
    queryFn:  () => listGeneratedQuestions("PENDING"),
  });

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories"],
    queryFn:  () => listCategories(),
  });

  const sources   = sourcesRes?.success  ? sourcesRes.data  : [];
  const pending   = questionsRes?.success ? questionsRes.data : [];
  const categories = categoriesRes?.success ? categoriesRes.data : [];

  // ── Add source dialog ─────────────────────────────────────────────────────
  const [addOpen, setAddOpen]         = useState(false);
  const [newUrl, setNewUrl]           = useState("");
  const [newType, setNewType]         = useState<KnowledgeSourceType>("BANK_WEBSITE");

  const addMutation = useMutation({
    mutationFn: () => addKnowledgeSource({ url: newUrl, sourceType: newType }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Knowledge source added");
        qc.invalidateQueries({ queryKey: ["knowledge-sources"] });
        setAddOpen(false);
        setNewUrl("");
      } else {
        toast.error(res.error);
      }
    },
  });

  // ── Generate dialog ───────────────────────────────────────────────────────
  const [genOpen, setGenOpen]     = useState(false);
  const [genSourceId, setGenSourceId] = useState("");
  const [genCount, setGenCount]   = useState(5);
  const [genType, setGenType]     = useState<GenerateParams["type"]>("MCQ");
  const [genDiff, setGenDiff]     = useState<GenerateParams["difficulty"]>(3);

  const genMutation = useMutation({
    mutationFn: () => scrapeAndGenerate({
      sourceId:   genSourceId,
      count:      genCount,
      type:       genType,
      difficulty: genDiff,
    }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Generated ${res.data.generated} question(s) for review`);
        qc.invalidateQueries({ queryKey: ["generated-questions"] });
        qc.invalidateQueries({ queryKey: ["knowledge-sources"] });
        setGenOpen(false);
      } else {
        toast.error(res.error);
      }
    },
  });

  // ── Approve dialog ────────────────────────────────────────────────────────
  const [approveQ, setApproveQ]     = useState<GeneratedQuestionRow | null>(null);
  const [appCategoryId, setAppCategoryId] = useState("");
  const [appNote, setAppNote]       = useState("");

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      approveGeneratedQuestion(id, { categoryId: appCategoryId, reviewNote: appNote || undefined }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Question approved and published to question bank");
        qc.invalidateQueries({ queryKey: ["generated-questions"] });
        setApproveQ(null);
      } else {
        toast.error(res.error);
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      rejectGeneratedQuestion(id, note || "Rejected by reviewer"),
    onSuccess: (res) => {
      if (!res.success) toast.error(res.error);
      else {
        toast.success("Question rejected");
        qc.invalidateQueries({ queryKey: ["generated-questions"] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKnowledgeSource,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-sources"] }),
  });

  // ── Expanded question preview ─────────────────────────────────────────────
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Studio
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Scrape banking knowledge sources and auto-generate exam questions with Claude AI
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
          Add Source
        </Button>
      </div>

      {/* Knowledge sources */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Knowledge Sources</h3>
        {loadingSources ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : sources.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No sources yet. Add a URL to get started.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">URL</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Last Scraped</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Generated</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sources.map((src) => (
                  <tr key={src.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate"
                        >
                          {src.title ?? src.url}
                        </a>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate ml-5">{src.url}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {SOURCE_TYPE_LABELS[src.sourceType] ?? src.sourceType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {src.lastScrapedAt
                        ? format(src.lastScrapedAt, "MMM d, HH:mm")
                        : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {src._count.generatedQuestions}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-purple-600 hover:bg-purple-50"
                          title="Generate questions from this source"
                          onClick={() => { setGenSourceId(src.id); setGenOpen(true); }}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:bg-red-50"
                          title="Remove source"
                          onClick={() => deleteMutation.mutate(src.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending questions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Pending Review
          {pending.length > 0 && (
            <Badge className="bg-amber-500 text-white text-[10px] h-4 px-1.5">
              {pending.length}
            </Badge>
          )}
        </h3>

        {loadingQ ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No questions pending review. Generate some from a source above!
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((q) => {
              const parsed = q.parsedQuestion as {
                title: string; body: string; type: string; difficulty: number;
                options: Array<{ text: string; isCorrect: boolean }>;
              } | null;
              const isExp = expanded === q.id;

              return (
                <div key={q.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isExp ? null : q.id)}
                  >
                    <Badge className={`${STATUS_COLORS[q.status]} text-[9px] h-4 px-1.5 shrink-0`}>
                      {q.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {parsed?.title ?? "Untitled"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {parsed?.type} • Difficulty {parsed?.difficulty}/5 •{" "}
                        {q.source?.title ?? q.source?.url ?? "Unknown source"} •{" "}
                        {format(q.createdAt, "MMM d")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-600 hover:bg-green-50"
                        title="Approve"
                        onClick={(e) => { e.stopPropagation(); setApproveQ(q); setAppCategoryId(""); setAppNote(""); }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:bg-red-50"
                        title="Reject"
                        onClick={(e) => { e.stopPropagation(); rejectMutation.mutate({ id: q.id, note: "Rejected" }); }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      {isExp
                        ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                        : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                    </div>
                  </div>

                  {isExp && parsed && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2.5">
                      <p className="text-sm text-gray-700">{parsed.body}</p>
                      <div className="space-y-1.5">
                        {parsed.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                              opt.isCorrect
                                ? "bg-green-50 border border-green-200 text-green-800"
                                : "bg-gray-50 border border-gray-100 text-gray-600"
                            }`}
                          >
                            {opt.isCorrect && <Check className="h-3 w-3 text-green-600 shrink-0" />}
                            <span>{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add source dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Knowledge Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>URL</Label>
              <Input
                placeholder="https://cbu.uz/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Source Type</Label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as KnowledgeSourceType)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="CBU_GUIDELINES">CBU Regulation</option>
                <option value="BANK_WEBSITE">Bank Website</option>
                <option value="MANUAL_UPLOAD">Manual Upload</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!newUrl || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Add Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Generate Questions with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Source</Label>
              <select
                value={genSourceId}
                onChange={(e) => setGenSourceId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">— Select source —</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.title ?? s.url}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Question Type</Label>
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value as GenerateParams["type"])}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="MCQ">MCQ</option>
                  <option value="TRUE_FALSE">True/False</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Count (1–20)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={genCount}
                  onChange={(e) => setGenCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Difficulty (1–5)</Label>
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setGenDiff(d)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                      genDiff === d
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              The page will be scraped and Claude AI will generate questions. This takes 15–60 seconds.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button
              disabled={!genSourceId || genMutation.isPending}
              onClick={() => genMutation.mutate()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {genMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Generating…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Generate</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      {approveQ && (
        <Dialog open={!!approveQ} onOpenChange={() => setApproveQ(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Approve & Publish Question</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-xs text-gray-500">
                Select a category to publish this AI-generated question to the question bank.
              </p>
              <div className="space-y-1">
                <Label>Category <span className="text-red-500">*</span></Label>
                <select
                  value={appCategoryId}
                  onChange={(e) => setAppCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">— Select category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Review Note (optional)</Label>
                <Input
                  placeholder="Any notes for this question…"
                  value={appNote}
                  onChange={(e) => setAppNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveQ(null)}>Cancel</Button>
              <Button
                disabled={!appCategoryId || approveMutation.isPending}
                onClick={() => approveMutation.mutate(approveQ.id)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Approve & Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
