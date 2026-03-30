"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { scrapePage } from "@/lib/scraper";
import { generateQuestionsFromContent } from "@/lib/ai-generator";
import { audit } from "@/lib/audit";
import type { ApiResponse } from "@/types";
import type { KnowledgeSourceType, GeneratedQuestionStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KnowledgeSourceWithCount = {
  id:            string;
  url:           string;
  title:         string | null;
  sourceType:    KnowledgeSourceType;
  lastScrapedAt: Date | null;
  isActive:      boolean;
  createdAt:     Date;
  _count:        { generatedQuestions: number };
};

export type GeneratedQuestionRow = {
  id:            string;
  rawText:       string;
  parsedQuestion: unknown;
  status:        GeneratedQuestionStatus;
  reviewNote:    string | null;
  createdAt:     Date;
  reviewedAt:    Date | null;
  source:        { url: string; title: string | null } | null;
  reviewedBy:    { name: string | null; email: string } | null;
};

// ─── List knowledge sources ───────────────────────────────────────────────────

export async function listKnowledgeSources(): Promise<
  ApiResponse<KnowledgeSourceWithCount[]>
> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER", "CONTENT_CREATOR");

    const sources = await db.knowledgeSource.findMany({
      where:   { isActive: true },
      include: { _count: { select: { generatedQuestions: true } } },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: sources };
  } catch (err) {
    return handleError("listKnowledgeSources", err);
  }
}

// ─── Add knowledge source ─────────────────────────────────────────────────────

export async function addKnowledgeSource(input: {
  url:        string;
  sourceType: KnowledgeSourceType;
}): Promise<ApiResponse<KnowledgeSourceWithCount>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER", "CONTENT_CREATOR");

    // Basic URL validation
    try { new URL(input.url); } catch { return { success: false, error: "Invalid URL" }; }

    const existing = await db.knowledgeSource.findFirst({ where: { url: input.url } });
    if (existing) return { success: false, error: "This URL is already in the knowledge base" };

    const source = await db.knowledgeSource.create({
      data:    { url: input.url, sourceType: input.sourceType },
      include: { _count: { select: { generatedQuestions: true } } },
    });

    await audit({
      userId:     session.user.id,
      action:     "KNOWLEDGE_SOURCE_ADDED",
      entityType: "KnowledgeSource",
      entityId:   source.id,
      newValues:  { url: input.url, sourceType: input.sourceType },
    });

    return { success: true, data: source };
  } catch (err) {
    return handleError("addKnowledgeSource", err);
  }
}

// ─── Delete knowledge source ──────────────────────────────────────────────────

export async function deleteKnowledgeSource(
  id: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    await requireRole("SUPER_ADMIN");
    await db.knowledgeSource.update({ where: { id }, data: { isActive: false } });
    return { success: true, data: { id } };
  } catch (err) {
    return handleError("deleteKnowledgeSource", err);
  }
}

// ─── Scrape & generate ────────────────────────────────────────────────────────

export type GenerateParams = {
  sourceId:   string;
  count:      number;
  type:       "MCQ" | "TRUE_FALSE" | "MIXED";
  difficulty: 1 | 2 | 3 | 4 | 5;
};

export async function scrapeAndGenerate(
  params: GenerateParams
): Promise<ApiResponse<{ generated: number }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER", "CONTENT_CREATOR");

    const source = await db.knowledgeSource.findUnique({ where: { id: params.sourceId } });
    if (!source) return { success: false, error: "Knowledge source not found" };

    // 1. Scrape
    const page = await scrapePage(source.url);
    if (!page.content.trim()) {
      return { success: false, error: "No content could be scraped from this URL" };
    }

    // Update lastScrapedAt and title
    await db.knowledgeSource.update({
      where: { id: params.sourceId },
      data:  { lastScrapedAt: new Date(), title: page.title },
    });

    // 2. Generate via Claude
    const questions = await generateQuestionsFromContent({
      content:     page.content,
      sourceTitle: page.title,
      count:       params.count,
      type:        params.type,
      difficulty:  params.difficulty,
    });

    // 3. Persist as GeneratedQuestion rows (PENDING status)
    await db.generatedQuestion.createMany({
      data: questions.map((q) => ({
        sourceId:       params.sourceId,
        rawText:        page.content.slice(0, 2000),
        parsedQuestion: q as unknown as Prisma.InputJsonValue,
        status:         "PENDING" as const,
      })),
    });

    await audit({
      userId:     session.user.id,
      action:     "AI_QUESTIONS_GENERATED",
      entityType: "KnowledgeSource",
      entityId:   params.sourceId,
      newValues:  { count: questions.length, type: params.type, difficulty: params.difficulty },
    });

    return { success: true, data: { generated: questions.length } };
  } catch (err) {
    return handleError("scrapeAndGenerate", err);
  }
}

// ─── List generated questions (pending review) ────────────────────────────────

export async function listGeneratedQuestions(
  status?: GeneratedQuestionStatus
): Promise<ApiResponse<GeneratedQuestionRow[]>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER", "CONTENT_CREATOR");

    const questions = await db.generatedQuestion.findMany({
      where:   status ? { status } : undefined,
      include: {
        source:     { select: { url: true, title: true } },
        reviewedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    100,
    });

    return { success: true, data: questions };
  } catch (err) {
    return handleError("listGeneratedQuestions", err);
  }
}

// ─── Approve: publish to question bank ───────────────────────────────────────

export async function approveGeneratedQuestion(
  id: string,
  overrides: {
    categoryId: string;
    reviewNote?: string;
  }
): Promise<ApiResponse<{ questionId: string }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER", "CONTENT_CREATOR");

    const gen = await db.generatedQuestion.findUnique({ where: { id } });
    if (!gen) return { success: false, error: "Generated question not found" };
    if (gen.status !== "PENDING") {
      return { success: false, error: "Question has already been reviewed" };
    }

    const parsed = gen.parsedQuestion as {
      title:       string;
      body:        string;
      type:        "MCQ" | "TRUE_FALSE";
      difficulty:  number;
      explanation: string;
      options: Array<{ text: string; isCorrect: boolean }>;
    } | null;

    if (!parsed) return { success: false, error: "No parsed question data" };

    // Create real Question + options in a transaction
    const [question] = await db.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          title:       parsed.title,
          body:        parsed.body,
          type:        parsed.type,
          difficulty:  Math.min(5, Math.max(1, parsed.difficulty)),
          categoryId:  overrides.categoryId,
          explanation: parsed.explanation,
          isActive:    true,
          createdById: session.user.id,
          options: {
            create: parsed.options.map((opt, idx) => ({
              text:       opt.text,
              isCorrect:  opt.isCorrect,
              orderIndex: idx,
            })),
          },
        },
      });

      // Create initial version snapshot
      await tx.questionVersion.create({
        data: {
          questionId:    q.id,
          versionNumber: 1,
          snapshot:      parsed as object,
          changedById:   session.user.id,
        },
      });

      // Mark generated question as approved
      await tx.generatedQuestion.update({
        where: { id },
        data:  {
          status:       "APPROVED",
          reviewedById: session.user.id,
          reviewedAt:   new Date(),
          reviewNote:   overrides.reviewNote ?? null,
        },
      });

      return [q] as const;
    });

    await audit({
      userId:     session.user.id,
      action:     "AI_QUESTION_APPROVED",
      entityType: "GeneratedQuestion",
      entityId:   id,
      newValues:  { publishedQuestionId: question.id, categoryId: overrides.categoryId },
    });

    return { success: true, data: { questionId: question.id } };
  } catch (err) {
    return handleError("approveGeneratedQuestion", err);
  }
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectGeneratedQuestion(
  id:         string,
  reviewNote: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER", "CONTENT_CREATOR");

    await db.generatedQuestion.update({
      where: { id },
      data:  {
        status:       "REJECTED",
        reviewedById: session.user.id,
        reviewedAt:   new Date(),
        reviewNote,
      },
    });

    return { success: true, data: { id } };
  } catch (err) {
    return handleError("rejectGeneratedQuestion", err);
  }
}

// ─── Error handler ────────────────────────────────────────────────────────────

function handleError(ctx: string, err: unknown): ApiResponse<never> {
  if (err instanceof Error) {
    if (err.message === "Unauthorized") return { success: false, error: "You must be logged in" };
    if (err.message === "Forbidden")    return { success: false, error: "Insufficient permissions" };
  }
  console.error(`[${ctx}]`, err);
  return { success: false, error: "An unexpected error occurred" };
}
