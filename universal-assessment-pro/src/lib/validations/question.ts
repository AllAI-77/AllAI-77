import { z } from "zod";
import { QuestionType } from "@prisma/client";

// ─── Option ───────────────────────────────────────────────────────────────────

export const questionOptionSchema = z.object({
  id:         z.string().cuid().optional(),
  text:       z.string().min(1, "Option text is required").max(1000),
  isCorrect:  z.boolean(),
  orderIndex: z.number().int().min(0),
  imageUrl:   z.string().url().nullish(),
});

// ─── Create ───────────────────────────────────────────────────────────────────

export const createQuestionSchema = z
  .object({
    title:       z.string().min(3, "Title must be at least 3 characters").max(500),
    body:        z.string().min(5, "Question body must be at least 5 characters"),
    type:        z.nativeEnum(QuestionType),
    difficulty:  z.number().int().min(1).max(5).default(3),
    categoryId:  z.string().cuid("Invalid category"),
    explanation: z.string().max(2000).optional(),
    imageUrl:    z.string().url().optional().or(z.literal("")).transform((v) => v || undefined),
    changeNote:  z.string().max(500).optional(),
    options:     z
      .array(questionOptionSchema)
      .min(2, "At least 2 options are required")
      .max(8, "Maximum 8 options allowed"),
  })
  .refine(
    (data) =>
      data.type === "FILL_BLANK" || data.type === "CASE_STUDY"
        ? true
        : data.options.some((o) => o.isCorrect),
    { message: "At least one correct option is required", path: ["options"] }
  );

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateQuestionSchema = createQuestionSchema.extend({
  id: z.string().cuid("Invalid question ID"),
});

// ─── List params ──────────────────────────────────────────────────────────────

export const listQuestionsSchema = z.object({
  page:       z.number().int().min(1).default(1),
  limit:      z.number().int().min(1).max(100).default(20),
  categoryId: z.string().cuid().optional(),
  type:       z.nativeEnum(QuestionType).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  search:     z.string().max(200).optional(),
  isActive:   z.boolean().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateQuestionInput  = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput  = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsParams  = z.infer<typeof listQuestionsSchema>;
