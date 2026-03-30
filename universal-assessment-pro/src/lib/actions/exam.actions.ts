"use server";

import { db } from "@/lib/db";
import { requireRole, auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createExamSchema,
  updateExamSchema,
  listExamsSchema,
  type CreateExamInput,
  type UpdateExamInput,
  type ListExamsParams,
} from "@/lib/validations/exam";
import type { ApiResponse, ExamWithCategories } from "@/types";

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createExam(
  input: CreateExamInput
): Promise<ApiResponse<ExamWithCategories>> {
  try {
    const session = await requireRole(
      "SUPER_ADMIN",
      "HR_MANAGER",
      "BRANCH_MANAGER"
    );
    const parsed = createExamSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { categories, ...examData } = parsed.data;

    // Validate each category has enough active questions
    for (const ec of categories) {
      const available = await db.question.count({
        where: { categoryId: ec.categoryId, isActive: true },
      });
      if (available < ec.questionCount) {
        const cat = await db.category.findUnique({ where: { id: ec.categoryId }, select: { name: true } });
        return {
          success: false,
          error: `Category "${cat?.name ?? ec.categoryId}" only has ${available} active question(s), but ${ec.questionCount} requested`,
        };
      }
    }

    const exam = await db.exam.create({
      data: {
        ...examData,
        createdById:    session.user.id,
        examCategories: { create: categories },
      },
      include: {
        examCategories: { include: { category: true } },
      },
    });

    await audit({
      userId:     session.user.id,
      action:     "EXAM_CREATED",
      entityType: "Exam",
      entityId:   exam.id,
      newValues:  { title: exam.title, passingScore: exam.passingScore },
    });

    return { success: true, data: exam };
  } catch (err) {
    return handleError("createExam", err);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateExam(
  input: UpdateExamInput
): Promise<ApiResponse<ExamWithCategories>> {
  try {
    const session = await requireRole(
      "SUPER_ADMIN",
      "HR_MANAGER",
      "BRANCH_MANAGER"
    );
    const parsed = updateExamSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { id, categories, ...examData } = parsed.data;

    const old = await db.exam.findUnique({ where: { id } });
    if (!old) return { success: false, error: "Exam not found" };

    const exam = await db.$transaction(async (tx) => {
      // Replace category mappings
      if (categories !== undefined) {
        await tx.examCategory.deleteMany({ where: { examId: id } });
        await tx.examCategory.createMany({
          data: categories.map((c) => ({ ...c, examId: id })),
        });
      }

      return tx.exam.update({
        where:   { id },
        data:    examData,
        include: { examCategories: { include: { category: true } } },
      });
    });

    await audit({
      userId:     session.user.id,
      action:     "EXAM_UPDATED",
      entityType: "Exam",
      entityId:   id,
      oldValues:  { title: old.title, isActive: old.isActive },
      newValues:  { title: exam.title, isActive: exam.isActive },
    });

    return { success: true, data: exam };
  } catch (err) {
    return handleError("updateExam", err);
  }
}

// ─── Toggle active ────────────────────────────────────────────────────────────

export async function toggleExamActive(
  id: string
): Promise<ApiResponse<{ id: string; isActive: boolean }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER");

    const exam = await db.exam.findUnique({ where: { id }, select: { isActive: true } });
    if (!exam) return { success: false, error: "Exam not found" };

    const updated = await db.exam.update({
      where: { id },
      data:  { isActive: !exam.isActive },
      select: { id: true, isActive: true },
    });

    await audit({
      userId:     session.user.id,
      action:     exam.isActive ? "EXAM_DEACTIVATED" : "EXAM_ACTIVATED",
      entityType: "Exam",
      entityId:   id,
    });

    return { success: true, data: updated };
  } catch (err) {
    return handleError("toggleExamActive", err);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteExam(
  id: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");

    const activeAttempts = await db.examAttempt.count({
      where: { examId: id, status: "IN_PROGRESS" },
    });
    if (activeAttempts > 0) {
      return {
        success: false,
        error:   `Cannot delete: ${activeAttempts} attempt(s) are currently in progress`,
      };
    }

    const exam = await db.exam.findUnique({ where: { id }, select: { title: true } });
    if (!exam) return { success: false, error: "Exam not found" };

    // Soft-delete
    await db.exam.update({ where: { id }, data: { isActive: false } });

    await audit({
      userId:     session.user.id,
      action:     "EXAM_DELETED",
      entityType: "Exam",
      entityId:   id,
      oldValues:  { title: exam.title },
    });

    return { success: true, data: { id } };
  } catch (err) {
    return handleError("deleteExam", err);
  }
}

// ─── Get single ───────────────────────────────────────────────────────────────

export async function getExam(
  id: string
): Promise<ApiResponse<ExamWithCategories>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const exam = await db.exam.findUnique({
      where:   { id },
      include: { examCategories: { include: { category: true } } },
    });
    if (!exam) return { success: false, error: "Exam not found" };

    return { success: true, data: exam };
  } catch (err) {
    return handleError("getExam", err);
  }
}

// ─── List (paginated) ─────────────────────────────────────────────────────────

export type ExamsPage = {
  exams:  ExamWithCategories[];
  total:  number;
  pages:  number;
};

export async function listExams(
  params: Partial<ListExamsParams> = {}
): Promise<ApiResponse<ExamsPage>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const parsed   = listExamsSchema.parse(params);
    const { page, limit, search, isActive } = parsed;

    const where = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { title:       { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [exams, total] = await Promise.all([
      db.exam.findMany({
        where,
        include: { examCategories: { include: { category: true } } },
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
      }),
      db.exam.count({ where }),
    ]);

    return {
      success: true,
      data: { exams, total, pages: Math.ceil(total / limit) },
    };
  } catch (err) {
    return handleError("listExams", err);
  }
}

// ─── Analytics: attempt stats for an exam ────────────────────────────────────

export type ExamStats = {
  totalAttempts:    number;
  completedAttempts: number;
  passedAttempts:   number;
  avgScore:         number;
  passRate:         number;
};

export async function getExamStats(
  examId: string
): Promise<ApiResponse<ExamStats>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER");

    const attempts = await db.examAttempt.findMany({
      where:  { examId, status: "COMPLETED" },
      select: { score: true, passed: true },
    });

    const totalAttempts     = await db.examAttempt.count({ where: { examId } });
    const completedAttempts = attempts.length;
    const passedAttempts    = attempts.filter((a) => a.passed).length;
    const scores            = attempts.map((a) => a.score ?? 0);
    const avgScore          = scores.length
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : 0;
    const passRate = completedAttempts
      ? Math.round((passedAttempts / completedAttempts) * 100)
      : 0;

    return {
      success: true,
      data: { totalAttempts, completedAttempts, passedAttempts, avgScore, passRate },
    };
  } catch (err) {
    return handleError("getExamStats", err);
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
