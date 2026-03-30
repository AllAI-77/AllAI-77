"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  selectQuestionsForExam,
  fetchExamQuestions,
  evaluateResponses,
  generateVerificationCode,
  generateQRData,
} from "@/lib/exam-engine";
import { saveResumeState, getResumeState, clearResumeState } from "@/lib/redis";
import { headers } from "next/headers";
import type { ApiResponse, ExamSession, SubmitAttemptPayload, AttemptWithDetails } from "@/types";

// ─── Start attempt ────────────────────────────────────────────────────────────

export async function startAttempt(
  examId: string
): Promise<ApiResponse<ExamSession>> {
  try {
    const session = await requireAuth();
    const userId  = session.user.id;

    const exam = await db.exam.findUnique({
      where:   { id: examId, isActive: true },
      include: { examCategories: { include: { category: true } } },
    });
    if (!exam) return { success: false, error: "Exam not found or is not available" };

    // IP whitelist check
    const hdrs      = await headers();
    const ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim()
                   ?? hdrs.get("x-real-ip")
                   ?? "unknown";
    if (exam.ipWhitelist.length > 0 && !exam.ipWhitelist.includes(ipAddress)) {
      return { success: false, error: "You are not allowed to take this exam from your current location" };
    }

    // Block if there is already an in-progress attempt
    const existing = await db.examAttempt.findFirst({
      where: { examId, userId, status: "IN_PROGRESS" },
    });
    if (existing) {
      // Resume: try Redis first, fall back to DB resumeState
      const redisState = await getResumeState(existing.id);
      const questionIds: string[] = redisState?.questionOrder
        ?? (existing.resumeState as { questionOrder?: string[] } | null)?.questionOrder
        ?? [];

      if (questionIds.length > 0) {
        const questions = await fetchExamQuestions(questionIds, exam.timeLimitPerQuestion);
        const now       = Date.now();
        const elapsed   = redisState
          ? 0
          : Math.floor((now - existing.startedAt.getTime()) / 1000);
        const timeRemaining = exam.timeLimit
          ? Math.max(0, exam.timeLimit * 60 - elapsed)
          : Infinity;

        return {
          success: true,
          data: {
            attemptId:     existing.id,
            examId,
            questions,
            currentIndex:  redisState?.currentQuestionIndex ?? 0,
            timeRemaining: redisState?.timeRemaining ?? timeRemaining,
            responses:     redisState?.responses   ?? {},
            flagged:       redisState?.flagged      ?? [],
            tabSwitchCount: 0,
            startedAt:     existing.startedAt.getTime(),
          },
        };
      }
    }

    // Select questions for this attempt
    const questionIds = await selectQuestionsForExam(examId);
    if (questionIds.length === 0) {
      return { success: false, error: "This exam has no active questions" };
    }

    const userAgent = hdrs.get("user-agent") ?? undefined;
    const attempt   = await db.examAttempt.create({
      data: {
        examId,
        userId,
        ipAddress,
        userAgent,
        status:      "IN_PROGRESS",
        resumeState: { questionOrder: questionIds },
      },
    });

    // Persist question order to Redis for fast resume
    const timeRemaining = exam.timeLimit ? exam.timeLimit * 60 : Infinity;
    await saveResumeState(attempt.id, {
      currentQuestionIndex: 0,
      timeRemaining,
      questionOrder:        questionIds,
      responses:            {},
      flagged:              [],
    });

    const questions = await fetchExamQuestions(questionIds, exam.timeLimitPerQuestion);

    await audit({
      userId,
      action:     "ATTEMPT_STARTED",
      entityType: "ExamAttempt",
      entityId:   attempt.id,
      newValues:  { examId, questionCount: questionIds.length },
    });

    return {
      success: true,
      data: {
        attemptId:     attempt.id,
        examId,
        questions,
        currentIndex:  0,
        timeRemaining,
        responses:     {},
        flagged:       [],
        tabSwitchCount: 0,
        startedAt:     attempt.startedAt.getTime(),
      },
    };
  } catch (err) {
    return handleError("startAttempt", err);
  }
}

// ─── Save progress ────────────────────────────────────────────────────────────

export async function saveProgress(
  attemptId: string,
  state: {
    currentQuestionIndex: number;
    timeRemaining:        number;
    responses:            Record<string, string | null>;
    flagged:              string[];
  }
): Promise<ApiResponse<{ saved: true }>> {
  try {
    const session = await requireAuth();

    const attempt = await db.examAttempt.findUnique({
      where:  { id: attemptId },
      select: { userId: true, status: true, resumeState: true },
    });
    if (!attempt) return { success: false, error: "Attempt not found" };
    if (attempt.userId !== session.user.id) return { success: false, error: "Forbidden" };
    if (attempt.status !== "IN_PROGRESS") return { success: false, error: "Attempt is no longer in progress" };

    const existing      = attempt.resumeState as { questionOrder?: string[] } | null;
    const questionOrder = existing?.questionOrder ?? [];

    await Promise.all([
      saveResumeState(attemptId, { ...state, questionOrder }),
      db.examAttempt.update({
        where: { id: attemptId },
        data:  { resumeState: { ...state, questionOrder }, updatedAt: new Date() },
      }),
    ]);

    return { success: true, data: { saved: true } };
  } catch (err) {
    return handleError("saveProgress", err);
  }
}

// ─── Submit attempt ───────────────────────────────────────────────────────────

export type SubmitResult = {
  attemptId:    string;
  score:        number;
  passed:       boolean;
  correctCount: number;
  totalCount:   number;
  certificate?: { id: string; verificationCode: string } | null;
};

export async function submitAttempt(
  payload: SubmitAttemptPayload
): Promise<ApiResponse<SubmitResult>> {
  try {
    const authSession = await requireAuth();
    const { attemptId, responses, timeSpent, flagged, tabSwitchCount } = payload;

    const attempt = await db.examAttempt.findUnique({
      where:   { id: attemptId },
      include: { exam: { select: { id: true, passingScore: true, timeLimit: true } } },
    });
    if (!attempt) return { success: false, error: "Attempt not found" };
    if (attempt.userId !== authSession.user.id) return { success: false, error: "Forbidden" };
    if (attempt.status !== "IN_PROGRESS") {
      return { success: false, error: "This attempt has already been submitted" };
    }

    // Retrieve question order from Redis / DB
    const redisState    = await getResumeState(attemptId);
    const resumeDB      = attempt.resumeState as { questionOrder?: string[] } | null;
    const questionIds   = redisState?.questionOrder ?? resumeDB?.questionOrder ?? [];

    if (questionIds.length === 0) {
      return { success: false, error: "No questions found for this attempt" };
    }

    // Fetch questions WITH correct answers for grading
    const questions = await db.question.findMany({
      where:   { id: { in: questionIds } },
      select:  { id: true, type: true, options: { select: { id: true, isCorrect: true } } },
    });

    // Build evaluation input from payload
    const evalInput = questionIds.map((qId) => ({
      questionId:       qId,
      selectedOptionId: responses[qId] ?? null,
      textAnswer:       null,
    }));

    const { score, correctCount, totalCount, results } = evaluateResponses(evalInput, questions);
    const passed = score >= attempt.exam.passingScore;

    // Persist results in a transaction
    const [updatedAttempt, certificate] = await db.$transaction(async (tx) => {
      // Upsert one Response row per question
      for (const qId of questionIds) {
        const isCorrect       = results.get(qId) ?? null;
        const selectedOptionId = responses[qId] ?? null;

        await tx.response.upsert({
          where:  { attemptId_questionId: { attemptId, questionId: qId } },
          update: { selectedOptionId, isCorrect, timeSpent: timeSpent[qId] ?? 0, flaggedForReview: flagged.includes(qId) },
          create: {
            attemptId,
            questionId:      qId,
            selectedOptionId,
            isCorrect,
            timeSpent:       timeSpent[qId] ?? 0,
            flaggedForReview: flagged.includes(qId),
          },
        });
      }

      const updated = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          passed,
          completedAt:    new Date(),
          status:         "COMPLETED",
          tabSwitchCount: attempt.tabSwitchCount + tabSwitchCount,
          resumeState:    Prisma.DbNull,
        },
      });

      let cert = null;
      if (passed) {
        const baseUrl          = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        const verificationCode = generateVerificationCode();
        const qrCodeData       = generateQRData(verificationCode, baseUrl);

        cert = await tx.certificate.create({
          data: {
            attemptId,
            userId:           authSession.user.id,
            verificationCode,
            qrCodeData,
          },
          select: { id: true, verificationCode: true },
        });
      }

      return [updated, cert] as const;
    });

    // Cleanup Redis state
    await clearResumeState(attemptId);

    await audit({
      userId:     authSession.user.id,
      action:     "ATTEMPT_SUBMITTED",
      entityType: "ExamAttempt",
      entityId:   attemptId,
      newValues:  { score, passed, correctCount, totalCount },
    });

    return {
      success: true,
      data: {
        attemptId,
        score,
        passed,
        correctCount,
        totalCount,
        certificate: certificate ?? null,
      },
    };
  } catch (err) {
    return handleError("submitAttempt", err);
  }
}

// ─── Abandon ──────────────────────────────────────────────────────────────────

export async function abandonAttempt(
  attemptId: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireAuth();

    const attempt = await db.examAttempt.findUnique({
      where:  { id: attemptId },
      select: { userId: true, status: true },
    });
    if (!attempt)                         return { success: false, error: "Attempt not found" };
    if (attempt.userId !== session.user.id) return { success: false, error: "Forbidden" };
    if (attempt.status !== "IN_PROGRESS") return { success: false, error: "Attempt is not in progress" };

    await db.examAttempt.update({
      where: { id: attemptId },
      data:  { status: "ABANDONED", completedAt: new Date() },
    });
    await clearResumeState(attemptId);

    return { success: true, data: { id: attemptId } };
  } catch (err) {
    return handleError("abandonAttempt", err);
  }
}

// ─── Get result ───────────────────────────────────────────────────────────────

export type AttemptResult = AttemptWithDetails & {
  responses: Array<{
    id:              string;
    questionId:      string;
    selectedOptionId: string | null;
    isCorrect:       boolean | null;
    timeSpent:       number | null;
    flaggedForReview: boolean;
    question: {
      title:    string;
      body:     string;
      explanation: string | null;
      options:  Array<{ id: string; text: string; isCorrect: boolean }>;
    };
  }>;
};

export async function getAttemptResult(
  attemptId: string
): Promise<ApiResponse<AttemptResult>> {
  try {
    const session = await requireAuth();
    const isAdmin = ["SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER"].includes(
      session.user.role
    );

    const attempt = await db.examAttempt.findUnique({
      where:   { id: attemptId },
      include: {
        exam:        { select: { id: true, title: true, passingScore: true, timeLimit: true, showAnswers: true } },
        user:        { select: { id: true, name: true, email: true } },
        certificate: true,
        responses: {
          include: {
            question: {
              select: {
                title:       true,
                body:        true,
                explanation: true,
                options: {
                  select:  { id: true, text: true, isCorrect: true },
                  orderBy: { orderIndex: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) return { success: false, error: "Attempt not found" };

    // Non-admins can only see their own results; respect showAnswers flag
    if (!isAdmin && attempt.userId !== session.user.id) {
      return { success: false, error: "Forbidden" };
    }

    // If showAnswers is disabled and requester is the employee, strip isCorrect from options
    const canSeeAnswers = isAdmin || attempt.exam.showAnswers;
    if (!canSeeAnswers) {
      attempt.responses.forEach((r) => {
        r.question.options.forEach((o) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (o as any).isCorrect = undefined;
        });
      });
    }

    return { success: true, data: attempt as AttemptResult };
  } catch (err) {
    return handleError("getAttemptResult", err);
  }
}

// ─── My attempts ─────────────────────────────────────────────────────────────

export async function getMyAttempts(): Promise<
  ApiResponse<AttemptWithDetails[]>
> {
  try {
    const session = await requireAuth();

    const attempts = await db.examAttempt.findMany({
      where:   { userId: session.user.id },
      include: {
        exam:        { select: { id: true, title: true, passingScore: true, timeLimit: true } },
        user:        { select: { id: true, name: true, email: true } },
        certificate: true,
      },
      orderBy: { startedAt: "desc" },
    });

    return { success: true, data: attempts };
  } catch (err) {
    return handleError("getMyAttempts", err);
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
