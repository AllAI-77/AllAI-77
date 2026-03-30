/**
 * Exam Engine — core business logic for:
 *  - Question selection (per-category quotas + randomisation)
 *  - Response evaluation (MCQ / TRUE_FALSE auto-grading)
 *  - Certificate verification code generation
 */

import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import type { QuestionType } from "@prisma/client";
import type { ExamQuestion } from "@/types";

// ─── Question Selection ───────────────────────────────────────────────────────

/**
 * Selects question IDs for an exam attempt.
 * Respects per-category quotas and optionally randomises the final list.
 */
export async function selectQuestionsForExam(
  examId: string
): Promise<string[]> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      randomize:     true,
      examCategories: {
        select: { categoryId: true, questionCount: true },
      },
    },
  });

  if (!exam) throw new Error(`Exam ${examId} not found`);

  const selectedIds: string[] = [];

  for (const ec of exam.examCategories) {
    const available = await db.question.findMany({
      where: { categoryId: ec.categoryId, isActive: true },
      select: { id: true },
    });

    // Fisher-Yates shuffle then slice to quota
    const shuffled = fisherYates(available.map((q) => q.id));
    selectedIds.push(...shuffled.slice(0, ec.questionCount));
  }

  return exam.randomize ? fisherYates(selectedIds) : selectedIds;
}

// ─── Question Fetching (safe — no isCorrect) ──────────────────────────────────

/**
 * Fetches question data suitable for sending to the client during an exam.
 * `isCorrect` is deliberately omitted from options to prevent cheating.
 */
export async function fetchExamQuestions(
  questionIds: string[],
  timeLimitPerQuestion?: number | null
): Promise<ExamQuestion[]> {
  const questions = await db.question.findMany({
    where: { id: { in: questionIds }, isActive: true },
    select: {
      id:         true,
      title:      true,
      body:       true,
      type:       true,
      difficulty: true,
      imageUrl:   true,
      options: {
        select: { id: true, text: true, orderIndex: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  // Preserve the caller's ordering
  const map = new Map(questions.map((q) => [q.id, q]));
  return questionIds
    .map((id) => map.get(id))
    .filter(Boolean)
    .map((q) => ({
      ...q!,
      timeLimit: timeLimitPerQuestion ?? null,
    }));
}

// ─── Response Evaluation ─────────────────────────────────────────────────────

interface EvalInput {
  questionId:       string;
  selectedOptionId: string | null;
  textAnswer:       string | null;
}

interface EvalResult {
  score:        number;         // 0-100
  correctCount: number;
  totalCount:   number;
  results:      Map<string, boolean | null>;  // null = requires manual grading
}

interface DBQuestion {
  id:      string;
  type:    QuestionType;
  options: Array<{ id: string; isCorrect: boolean }>;
}

export function evaluateResponses(
  responses: EvalInput[],
  questions:  DBQuestion[]
): EvalResult {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const results     = new Map<string, boolean | null>();
  let correct       = 0;
  let autoGraded    = 0;

  for (const resp of responses) {
    const q = questionMap.get(resp.questionId);
    if (!q) continue;

    if (q.type === "MCQ" || q.type === "TRUE_FALSE") {
      const isCorrect = resp.selectedOptionId
        ? (q.options.find((o) => o.id === resp.selectedOptionId)?.isCorrect ?? false)
        : false;
      results.set(resp.questionId, isCorrect);
      if (isCorrect) correct++;
      autoGraded++;
    } else {
      // FILL_BLANK / CASE_STUDY require manual grading
      results.set(resp.questionId, null);
    }
  }

  const score = autoGraded > 0 ? Math.round((correct / autoGraded) * 100) : 0;
  return { score, correctCount: correct, totalCount: autoGraded, results };
}

// ─── Certificate Helpers ──────────────────────────────────────────────────────

/** Generates a cryptographically random, human-readable verification code. */
export function generateVerificationCode(): string {
  // Format: UAP-XXXX-XXXX-XXXX  (hex, uppercase)
  const hex = randomBytes(6).toString("hex").toUpperCase();
  return `UAP-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/**
 * Generates the data string to be encoded into a QR code for certificate
 * verification.
 */
export function generateQRData(
  verificationCode: string,
  baseUrl: string
): string {
  return `${baseUrl}/api/certificates/verify?code=${encodeURIComponent(verificationCode)}`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
