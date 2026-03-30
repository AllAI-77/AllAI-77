/**
 * Claude-powered question generation from scraped knowledge base content.
 * Uses @anthropic-ai/sdk to call Claude claude-haiku-4-5-20251001 for cost efficiency.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface GeneratedQuestionData {
  title:       string;
  body:        string;
  type:        "MCQ" | "TRUE_FALSE";
  difficulty:  1 | 2 | 3 | 4 | 5;
  explanation: string;
  options: Array<{
    text:      string;
    isCorrect: boolean;
  }>;
}

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert assessment designer for ATB Universalbank employees in Uzbekistan.
Your task is to generate high-quality multiple-choice exam questions based on provided source text.
Rules:
- Generate exactly the number of questions requested.
- Each question must be directly grounded in the provided text — no hallucination.
- Questions should test understanding, not just recall.
- For MCQ: provide exactly 4 options, exactly 1 correct.
- For TRUE_FALSE: provide exactly 2 options ("True" and "False"), exactly 1 correct.
- Difficulty: 1 = very easy, 5 = very hard. Match the requested difficulty.
- Write in clear, professional English unless the source is in Uzbek/Russian, then match the source language.
- Respond ONLY with valid JSON — no markdown fences, no extra text.`;

function buildUserPrompt(
  content: string,
  sourceTitle: string,
  count: number,
  type: "MCQ" | "TRUE_FALSE" | "MIXED",
  difficulty: 1 | 2 | 3 | 4 | 5
): string {
  const typeInstructions =
    type === "MIXED"
      ? `Generate a mix: roughly ${Math.ceil(count / 2)} MCQ and ${Math.floor(count / 2)} TRUE_FALSE.`
      : `Generate ${count} ${type} question${count > 1 ? "s" : ""}.`;

  return `Source title: "${sourceTitle}"

Source content:
---
${content.slice(0, 4000)}
---

${typeInstructions}
Target difficulty level: ${difficulty}/5.

Return a JSON array of question objects. Each object must have:
{
  "title": "short question label (max 80 chars)",
  "body": "full question text",
  "type": "MCQ" | "TRUE_FALSE",
  "difficulty": ${difficulty},
  "explanation": "brief explanation of the correct answer",
  "options": [
    { "text": "...", "isCorrect": true/false },
    ...
  ]
}`;
}

// ─── Main generate function ───────────────────────────────────────────────────

export async function generateQuestionsFromContent(params: {
  content:    string;
  sourceTitle: string;
  count:      number;
  type:       "MCQ" | "TRUE_FALSE" | "MIXED";
  difficulty: 1 | 2 | 3 | 4 | 5;
}): Promise<GeneratedQuestionData[]> {
  const { content, sourceTitle, count, type, difficulty } = params;

  if (!content.trim()) throw new Error("Source content is empty");
  if (count < 1 || count > 20) throw new Error("Count must be between 1 and 20");

  const userPrompt = buildUserPrompt(content, sourceTitle, count, type, difficulty);

  const message = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) throw new Error("Claude did not return an array");

  return parsed.map((q: unknown, i: number) => validateQuestion(q, i));
}

// ─── Validate each generated question ────────────────────────────────────────

function validateQuestion(q: unknown, idx: number): GeneratedQuestionData {
  if (typeof q !== "object" || q === null) {
    throw new Error(`Question ${idx} is not an object`);
  }
  const raw = q as Record<string, unknown>;

  const type = raw.type as string;
  if (type !== "MCQ" && type !== "TRUE_FALSE") {
    throw new Error(`Question ${idx} has invalid type: ${type}`);
  }

  const options = raw.options;
  if (!Array.isArray(options) || options.length < 2) {
    throw new Error(`Question ${idx} has insufficient options`);
  }

  const hasCorrect = options.some((o: unknown) => {
    return typeof o === "object" && o !== null && (o as Record<string, unknown>).isCorrect === true;
  });
  if (!hasCorrect) throw new Error(`Question ${idx} has no correct option`);

  const difficulty = Number(raw.difficulty);

  return {
    title:       String(raw.title ?? "").slice(0, 80),
    body:        String(raw.body  ?? ""),
    type,
    difficulty:  (Math.min(5, Math.max(1, difficulty)) || 3) as 1 | 2 | 3 | 4 | 5,
    explanation: String(raw.explanation ?? ""),
    options:     options.map((o: unknown) => {
      const opt = o as Record<string, unknown>;
      return {
        text:      String(opt.text      ?? ""),
        isCorrect: Boolean(opt.isCorrect),
      };
    }),
  };
}
