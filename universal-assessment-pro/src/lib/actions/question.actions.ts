"use server";

import { db } from "@/lib/db";
import { requireRole, auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsSchema,
  type CreateQuestionInput,
  type UpdateQuestionInput,
  type ListQuestionsParams,
} from "@/lib/validations/question";
import type { ApiResponse, QuestionWithOptions } from "@/types";

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createQuestion(
  input: CreateQuestionInput
): Promise<ApiResponse<QuestionWithOptions>> {
  try {
    const session = await requireRole(
      "SUPER_ADMIN",
      "HR_MANAGER",
      "CONTENT_CREATOR"
    );
    const parsed = createQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { options, changeNote, ...questionData } = parsed.data;

    const question = await db.question.create({
      data: {
        ...questionData,
        createdById:   session.user.id,
        versionNumber: 1,
        options: {
          create: options.map(({ id: _id, ...o }) => o),
        },
      },
      include: { options: { orderBy: { orderIndex: "asc" } }, category: true },
    });

    // Record initial version snapshot
    await db.questionVersion.create({
      data: {
        questionId:    question.id,
        versionNumber: 1,
        snapshot:      { ...questionData, options },
        changeNote:    changeNote ?? "Initial version",
        changedById:   session.user.id,
      },
    });

    await audit({
      userId:     session.user.id,
      action:     "QUESTION_CREATED",
      entityType: "Question",
      entityId:   question.id,
      newValues:  { title: question.title, type: question.type, categoryId: question.categoryId },
    });

    return { success: true, data: question };
  } catch (err) {
    return handleError("createQuestion", err);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateQuestion(
  input: UpdateQuestionInput
): Promise<ApiResponse<QuestionWithOptions>> {
  try {
    const session = await requireRole(
      "SUPER_ADMIN",
      "HR_MANAGER",
      "CONTENT_CREATOR"
    );
    const parsed = updateQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { id, options, changeNote, ...questionData } = parsed.data;

    const existing = await db.question.findUnique({
      where:   { id },
      include: { options: true },
    });
    if (!existing) return { success: false, error: "Question not found" };

    const newVersion = existing.versionNumber + 1;

    // Replace all options (delete + re-create for simplicity)
    const question = await db.$transaction(async (tx) => {
      await tx.questionOption.deleteMany({ where: { questionId: id } });

      const updated = await tx.question.update({
        where: { id },
        data:  {
          ...questionData,
          versionNumber: newVersion,
          options: {
            create: (options ?? []).map(({ id: _id, ...o }) => o),
          },
        },
        include: { options: { orderBy: { orderIndex: "asc" } }, category: true },
      });

      // Snapshot the previous version
      await tx.questionVersion.create({
        data: {
          questionId:    id,
          versionNumber: newVersion,
          snapshot: {
            ...questionData,
            options: existing.options,
          },
          changeNote:  changeNote ?? "Updated",
          changedById: session.user.id,
        },
      });

      return updated;
    });

    await audit({
      userId:     session.user.id,
      action:     "QUESTION_UPDATED",
      entityType: "Question",
      entityId:   id,
      oldValues:  { title: existing.title, version: existing.versionNumber },
      newValues:  { title: question.title, version: newVersion },
    });

    return { success: true, data: question };
  } catch (err) {
    return handleError("updateQuestion", err);
  }
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteQuestion(
  id: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");

    const question = await db.question.findUnique({ where: { id } });
    if (!question) return { success: false, error: "Question not found" };

    // Soft-delete: mark inactive so existing exam results are preserved
    await db.question.update({ where: { id }, data: { isActive: false } });

    await audit({
      userId:     session.user.id,
      action:     "QUESTION_DELETED",
      entityType: "Question",
      entityId:   id,
      oldValues:  { title: question.title },
    });

    return { success: true, data: { id } };
  } catch (err) {
    return handleError("deleteQuestion", err);
  }
}

// ─── Get single ───────────────────────────────────────────────────────────────

export async function getQuestion(
  id: string
): Promise<ApiResponse<QuestionWithOptions>> {
  try {
    await auth(); // Must be logged in

    const question = await db.question.findUnique({
      where:   { id },
      include: { options: { orderBy: { orderIndex: "asc" } }, category: true },
    });
    if (!question) return { success: false, error: "Question not found" };

    return { success: true, data: question };
  } catch (err) {
    return handleError("getQuestion", err);
  }
}

// ─── List (paginated) ─────────────────────────────────────────────────────────

export type QuestionsPage = {
  questions: QuestionWithOptions[];
  total:     number;
  pages:     number;
};

export async function listQuestions(
  params: Partial<ListQuestionsParams> = {}
): Promise<ApiResponse<QuestionsPage>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const parsed = listQuestionsSchema.parse(params);
    const { page, limit, categoryId, type, difficulty, search, isActive } = parsed;

    const where = {
      ...(categoryId !== undefined && { categoryId }),
      ...(type !== undefined       && { type }),
      ...(difficulty !== undefined && { difficulty }),
      ...(isActive !== undefined   && { isActive }),
      ...(search                   && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { body:  { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [questions, total] = await Promise.all([
      db.question.findMany({
        where,
        include: { options: { orderBy: { orderIndex: "asc" } }, category: true },
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
      }),
      db.question.count({ where }),
    ]);

    return {
      success: true,
      data: { questions, total, pages: Math.ceil(total / limit) },
    };
  } catch (err) {
    return handleError("listQuestions", err);
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
