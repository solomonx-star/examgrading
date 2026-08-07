"use server";

import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Test } from "@/models/Test";
import { PracticeSession } from "@/models/PracticeSession";
import type { IPracticeQuestion } from "@/models/PracticeSession";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { deductCredits, getBalance } from "@/lib/ai-credits-service";

const PRACTICE_CREDIT_COST = 3;

const generateSchema = z.object({
  courseId: z.string().regex(/^[a-f\d]{24}$/i),
  count: z.coerce.number().int().min(5).max(15),
  difficulty: z.enum(["easy", "mixed", "challenging"]),
});

export async function generatePracticeTestAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error: string } | never> {
  const me = await requireActiveStudentAccess();

  const parsed = generateSchema.safeParse({
    courseId: formData.get("courseId"),
    count: formData.get("count"),
    difficulty: formData.get("difficulty"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await connectDB();
  const meOid = new mongoose.Types.ObjectId(me.userId);

  const mod = await Course.findOne({
    _id: parsed.data.courseId,
    enrolledStudents: meOid,
  })
    .select("_id code name yearLevel")
    .lean();
  if (!mod) return { error: "Module not found or you are not enrolled." };

  const balance = await getBalance(me.userId);
  if (balance < PRACTICE_CREDIT_COST) {
    return {
      error: `You need ${PRACTICE_CREDIT_COST} credits to generate a practice test. Your balance is ${balance}.`,
    };
  }

  // Gather a few existing test questions as style examples (up to 5, no correct answers exposed).
  const sampleTests = await Test.find({ courseId: mod._id, isPublished: true })
    .select("questions")
    .limit(2)
    .lean();

  const styleExamples: string[] = [];
  for (const t of sampleTests) {
    for (const q of (t.questions ?? []).slice(0, 3)) {
      const opts = (q.options ?? [])
        .map((o, i) => `${String.fromCharCode(65 + i)}. ${o.text}`)
        .join(" | ");
      styleExamples.push(`- ${q.prompt}  [${opts}]`);
    }
  }

  const examplesBlock =
    styleExamples.length > 0
      ? `\n\nStyle examples from existing assessments (DO NOT reuse these verbatim):\n${styleExamples.slice(0, 5).join("\n")}`
      : "";

  const difficultyNote =
    parsed.data.difficulty === "easy"
      ? "Questions should test basic recall and understanding."
      : parsed.data.difficulty === "challenging"
        ? "Questions should require analysis and application of concepts, avoiding trivial recall."
        : "Mix straightforward recall questions with a few that require deeper analysis.";

  const prompt = `You are an experienced academic generating practice questions for a Year ${mod.yearLevel} university module.
Module: ${mod.code} — ${mod.name}

Generate exactly ${parsed.data.count} multiple-choice practice questions. ${difficultyNote}
Each question must have exactly 4 options (A, B, C, D) with one correct answer.
Provide a short explanation (1–2 sentences) for why the correct answer is right.${examplesBlock}

Respond ONLY with a valid JSON array in this exact format — no prose, no markdown:
[
  {
    "id": "q1",
    "prompt": "Question text here?",
    "options": [
      {"id": "A", "text": "Option A text"},
      {"id": "B", "text": "Option B text"},
      {"id": "C", "text": "Option C text"},
      {"id": "D", "text": "Option D text"}
    ],
    "correctId": "A",
    "explanation": "Brief explanation of why A is correct."
  }
]`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "AI service is not configured. Contact the college office." };

  let questions: IPracticeQuestion[];
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "AI did not return a valid response. Please try again." };
    }
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { error: "AI returned an unexpected format. Please try again." };
    }
    questions = JSON.parse(jsonMatch[0]) as IPracticeQuestion[];
    if (!Array.isArray(questions) || questions.length === 0) {
      return { error: "AI returned no questions. Please try again." };
    }
  } catch {
    return { error: "Failed to generate questions. Please try again." };
  }

  // Deduct credits before saving (atomic — throws if insufficient).
  try {
    await deductCredits({
      studentId: me.userId,
      amount: PRACTICE_CREDIT_COST,
      reason: "spend.practice_test",
      note: `Practice test: ${mod.code} (${parsed.data.count}q, ${parsed.data.difficulty})`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Insufficient credits.";
    return { error: msg };
  }

  const session = await PracticeSession.create({
    studentId: meOid,
    courseId: mod._id,
    difficulty: parsed.data.difficulty,
    questions,
    maxScore: questions.length,
  });

  redirect(
    `/student/modules/${parsed.data.courseId}/practice/${session._id}`,
  );
}

const submitSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i),
  answers: z.record(z.string(), z.string()),
});

export type SubmittedQuestion = {
  id: string;
  correctId: string;
  explanation: string;
};

export async function submitPracticeTestAction(args: {
  sessionId: string;
  answers: Record<string, string>;
}): Promise<{
  ok: boolean;
  error?: string;
  score?: number;
  maxScore?: number;
  questions?: SubmittedQuestion[];
}> {
  const me = await requireActiveStudentAccess();

  const parsed = submitSchema.safeParse(args);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  const meOid = new mongoose.Types.ObjectId(me.userId);

  const session = await PracticeSession.findOne({
    _id: parsed.data.sessionId,
    studentId: meOid,
    submittedAt: null,
  });
  if (!session) return { ok: false, error: "Session not found or already submitted." };

  let score = 0;
  for (const q of session.questions) {
    if (parsed.data.answers[q.id] === q.correctId) score++;
  }

  session.answers = new Map(Object.entries(parsed.data.answers));
  session.score = score;
  session.submittedAt = new Date();
  await session.save();

  return {
    ok: true,
    score,
    maxScore: session.maxScore,
    questions: session.questions.map((q) => ({
      id: q.id,
      correctId: q.correctId,
      explanation: q.explanation,
    })),
  };
}
