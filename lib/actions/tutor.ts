"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { deductCredits, getBalance } from "@/lib/ai-credits-service";
import { TutorSession } from "@/models/TutorSession";
import { AI_CREDIT_COSTS } from "@/lib/constants";
import { audit } from "@/lib/audit";

export type TutorMessageView = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type TutorSessionView = {
  id: string;
  moduleCode: string;
  moduleName: string;
  messages: TutorMessageView[];
  createdAt: string;
};

/**
 * Returns today's session for this module if it exists, otherwise null.
 * Does not charge credits — use startTutorSessionAction to create one.
 */
export async function getTodaySessionAction(courseId: string): Promise<{
  ok: boolean;
  session?: TutorSessionView;
  balance?: number;
  error?: string;
}> {
  try {
    if (!mongoose.Types.ObjectId.isValid(courseId))
      return { ok: false, error: "Invalid module." };

    const me = await requireActiveStudentAccess();
    await connectDB();

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [session, balance] = await Promise.all([
      TutorSession.findOne({
        student: me.userId,
        courseId,
        createdAt: { $gte: dayStart },
      })
        .sort({ createdAt: -1 })
        .lean(),
      getBalance(me.userId),
    ]);

    return {
      ok: true,
      balance,
      session: session
        ? {
            id: String(session._id),
            moduleCode: session.moduleCode,
            moduleName: session.moduleName,
            messages: session.messages.map((m) => ({
              role: m.role,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            })),
            createdAt: session.createdAt.toISOString(),
          }
        : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load session.",
    };
  }
}

/**
 * Deducts credits and creates a new tutor session for the module.
 * Call this when the student explicitly starts a new session.
 */
export async function startTutorSessionAction(args: {
  courseId: string;
  moduleCode: string;
  moduleName: string;
  programmeName: string;
  yearLevel: number;
}): Promise<{ ok: boolean; session?: TutorSessionView; error?: string }> {
  try {
    if (!mongoose.Types.ObjectId.isValid(args.courseId))
      return { ok: false, error: "Invalid module." };

    const me = await requireActiveStudentAccess();
    const cost = AI_CREDIT_COSTS.tutor;

    await deductCredits({
      studentId: me.userId,
      amount: cost,
      reason: "spend.tutor",
      note: `${args.moduleCode} tutor session`,
    });

    await connectDB();
    const session = await TutorSession.create({
      student: me.userId,
      courseId: args.courseId,
      moduleCode: args.moduleCode,
      moduleName: args.moduleName,
      programmeName: args.programmeName,
      yearLevel: args.yearLevel,
      messages: [],
      creditsCost: cost,
    });

    await audit({
      action: "ai_tutor.session_start",
      summary: `Started AI tutor session for ${args.moduleCode} (cost: ${cost} credits)`,
      entityType: "TutorSession",
      entityId: String(session._id),
      metadata: { courseId: args.courseId, cost },
    });

    return {
      ok: true,
      session: {
        id: String(session._id),
        moduleCode: session.moduleCode,
        moduleName: session.moduleName,
        messages: [],
        createdAt: session.createdAt.toISOString(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start session.",
    };
  }
}
