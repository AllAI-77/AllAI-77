// Universal Assessment Pro — Global TypeScript Types

import type {
  User,
  Role,
  Category,
  Question,
  QuestionOption,
  QuestionType,
  Exam,
  ExamAttempt,
  AttemptStatus,
  Certificate,
  Department,
  Branch,
} from "@prisma/client";

// ─── Re-exports ───────────────────────────────────────────────────────────────
export type {
  User,
  Role,
  Category,
  Question,
  QuestionOption,
  QuestionType,
  Exam,
  ExamAttempt,
  AttemptStatus,
  Certificate,
  Department,
  Branch,
};

// ─── Composite types ──────────────────────────────────────────────────────────

export type QuestionWithOptions = Question & {
  options: QuestionOption[];
  category: Category;
};

export type ExamWithCategories = Exam & {
  examCategories: Array<{
    id: string;
    questionCount: number;
    category: Category;
  }>;
};

export type AttemptWithDetails = ExamAttempt & {
  exam: Pick<Exam, "id" | "title" | "passingScore" | "timeLimit">;
  user: Pick<User, "id" | "name" | "email">;
  certificate?: Certificate | null;
};

// ─── Exam engine types ────────────────────────────────────────────────────────

export interface ExamQuestion {
  id: string;
  title: string;
  body: string;
  type: QuestionType;
  difficulty: number;
  options: Array<{ id: string; text: string; orderIndex: number }>;
  imageUrl?: string | null;
  timeLimit?: number | null;
}

export interface ExamSession {
  attemptId: string;
  examId: string;
  questions: ExamQuestion[];
  currentIndex: number;
  timeRemaining: number;
  responses: Record<string, string | null>; // questionId → selectedOptionId | textAnswer
  flagged: string[];
  tabSwitchCount: number;
  startedAt: number; // Unix timestamp
}

export interface SubmitAttemptPayload {
  attemptId: string;
  responses: Record<string, string | null>;
  timeSpent: Record<string, number>;
  flagged: string[];
  tabSwitchCount: number;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  totalExams: number;
  totalAttempts: number;
  passRate: number;
  avgScore: number;
  avgDuration: number;
}

export interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  totalResponses: number;
  correctResponses: number;
  passRate: number;
}

export interface SkillRadarData {
  category: string;
  score: number;
  fullMark: number;
}

// ─── API Response wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Form types ───────────────────────────────────────────────────────────────

export interface QuestionFormValues {
  title: string;
  body: string;
  type: QuestionType;
  difficulty: number;
  categoryId: string;
  explanation?: string;
  imageUrl?: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
    orderIndex: number;
  }>;
}

export interface ExamFormValues {
  title: string;
  description?: string;
  passingScore: number;
  timeLimit?: number;
  timeLimitPerQuestion?: number;
  randomize: boolean;
  allowReview: boolean;
  showAnswers: boolean;
  ipWhitelist: string[];
  isAdaptive: boolean;
  categories: Array<{
    categoryId: string;
    questionCount: number;
  }>;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  roles?: Role[];
}
