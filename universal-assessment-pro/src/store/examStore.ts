import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface QuestionResponse {
  questionId: string;
  selectedOptionId?: string;
  textAnswer?: string;
  flaggedForReview: boolean;
  timeSpentSeconds: number;
}

interface ExamState {
  attemptId: string | null;
  examId: string | null;
  currentQuestionIndex: number;
  questionOrder: string[];
  responses: Record<string, QuestionResponse>;
  startedAt: number | null;
  tabSwitchCount: number;
  focusLossCount: number;

  initExam: (params: {
    attemptId: string;
    examId: string;
    questionOrder: string[];
  }) => void;
  setResponse: (questionId: string, response: Partial<QuestionResponse>) => void;
  navigateToQuestion: (index: number) => void;
  toggleFlag: (questionId: string) => void;
  incrementTabSwitch: () => void;
  incrementFocusLoss: () => void;
  clearExam: () => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set, _get) => ({
      attemptId: null,
      examId: null,
      currentQuestionIndex: 0,
      questionOrder: [],
      responses: {},
      startedAt: null,
      tabSwitchCount: 0,
      focusLossCount: 0,

      initExam: ({ attemptId, examId, questionOrder }) =>
        set({
          attemptId,
          examId,
          currentQuestionIndex: 0,
          questionOrder,
          responses: {},
          startedAt: Date.now(),
          tabSwitchCount: 0,
          focusLossCount: 0,
        }),

      setResponse: (questionId, response) =>
        set((state) => {
          const existing = state.responses[questionId] ?? {
            questionId,
            flaggedForReview: false,
            timeSpentSeconds: 0,
          };
          return {
            responses: {
              ...state.responses,
              [questionId]: { ...existing, ...response },
            },
          };
        }),

      navigateToQuestion: (index) => set({ currentQuestionIndex: index }),

      toggleFlag: (questionId) =>
        set((state) => {
          const existing = state.responses[questionId] ?? {
            questionId,
            flaggedForReview: false,
            timeSpentSeconds: 0,
          };
          return {
            responses: {
              ...state.responses,
              [questionId]: {
                ...existing,
                flaggedForReview: !existing.flaggedForReview,
              },
            },
          };
        }),

      incrementTabSwitch: () =>
        set((state) => ({ tabSwitchCount: state.tabSwitchCount + 1 })),

      incrementFocusLoss: () =>
        set((state) => ({ focusLossCount: state.focusLossCount + 1 })),

      clearExam: () =>
        set({
          attemptId: null,
          examId: null,
          currentQuestionIndex: 0,
          questionOrder: [],
          responses: {},
          startedAt: null,
          tabSwitchCount: 0,
          focusLossCount: 0,
        }),
    }),
    {
      name: "exam-session",
      storage: createJSONStorage(() => {
        // sessionStorage clears on tab close — intentional for exam security
        if (typeof window !== "undefined") return sessionStorage;
        return localStorage;
      }),
      partialize: (state) => ({
        attemptId: state.attemptId,
        examId: state.examId,
        currentQuestionIndex: state.currentQuestionIndex,
        questionOrder: state.questionOrder,
        responses: state.responses,
        startedAt: state.startedAt,
        tabSwitchCount: state.tabSwitchCount,
        focusLossCount: state.focusLossCount,
      }),
    }
  )
);
