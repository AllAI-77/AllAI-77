import { z } from "zod";

// ─── Exam Category mapping ────────────────────────────────────────────────────

export const examCategorySchema = z.object({
  categoryId:    z.string().cuid("Invalid category"),
  questionCount: z.number().int().min(1, "Must select at least 1 question").max(100),
});

// ─── Create ───────────────────────────────────────────────────────────────────

export const createExamSchema = z.object({
  title:                z.string().min(3, "Title must be at least 3 characters").max(200),
  description:          z.string().max(2000).optional(),
  passingScore:         z.number().int().min(1).max(100).default(70),
  timeLimit:            z.number().int().min(1).max(480).nullish(),   // minutes
  timeLimitPerQuestion: z.number().int().min(10).max(600).nullish(),  // seconds
  randomize:            z.boolean().default(true),
  allowReview:          z.boolean().default(true),
  showAnswers:          z.boolean().default(false),
  isAdaptive:           z.boolean().default(false),
  ipWhitelist:          z.array(z.string()).default([]),
  categories:           z
    .array(examCategorySchema)
    .min(1, "At least one category is required"),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateExamSchema = createExamSchema.extend({
  id: z.string().cuid("Invalid exam ID"),
});

// ─── List params ──────────────────────────────────────────────────────────────

export const listExamsSchema = z.object({
  page:     z.number().int().min(1).default(1),
  limit:    z.number().int().min(1).max(50).default(10),
  search:   z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type ListExamsParams = z.infer<typeof listExamsSchema>;
