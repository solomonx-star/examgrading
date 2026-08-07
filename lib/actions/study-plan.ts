"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Grade } from "@/models/Grade";
import { Attendance } from "@/models/Attendance";
import { Test } from "@/models/Test";
import { StudyPlan } from "@/models/StudyPlan";
import type { IStudyDay } from "@/models/StudyPlan";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { deductCredits, getBalance } from "@/lib/ai-credits-service";

const PLAN_CREDIT_COST = 5;
const FREE_REGEN_HOURS = 24;

const generateSchema = z.object({
  hoursPerDay: z.coerce.number().int().min(1).max(12),
  studyDays: z.array(z.string()).min(1),
});

export async function generateStudyPlanAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  const me = await requireActiveStudentAccess();

  const studyDaysRaw = formData.getAll("studyDays").map(String);
  const parsed = generateSchema.safeParse({
    hoursPerDay: formData.get("hoursPerDay"),
    studyDays: studyDaysRaw,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await connectDB();
  const meOid = new mongoose.Types.ObjectId(me.userId);
  const now = new Date();

  // Check if free regeneration applies (existing plan within 24h)
  const recentPlan = await StudyPlan.findOne({
    studentId: meOid,
    generatedAt: { $gte: new Date(now.getTime() - FREE_REGEN_HOURS * 60 * 60 * 1000) },
  })
    .select("_id")
    .lean();
  const isFreeRegen = !!recentPlan;

  if (!isFreeRegen) {
    const balance = await getBalance(me.userId);
    if (balance < PLAN_CREDIT_COST) {
      return {
        error: `You need ${PLAN_CREDIT_COST} credits to generate a study plan. Your balance is ${balance}.`,
      };
    }
  }

  // Enrolled modules with grades and attendance
  const enrolledCourses = await Course.find({ enrolledStudents: meOid })
    .select("_id code name yearLevel academicYear semester")
    .lean();

  if (enrolledCourses.length === 0) {
    return { error: "No enrolled modules found." };
  }

  const courseIds = enrolledCourses.map((c) => c._id);

  const [grades, attendanceDocs, upcomingTests] = await Promise.all([
    Grade.find({
      studentId: meOid,
      courseId: { $in: courseIds },
      isPublished: true,
    })
      .select("courseId calculatedGPA calculatedGrade")
      .lean(),
    Attendance.find({
      studentId: meOid,
      courseId: { $in: courseIds },
    })
      .select("courseId status")
      .lean(),
    Test.find({
      courseId: { $in: courseIds },
      isPublished: true,
      endsAt: { $gte: now },
    })
      .select("courseId title endsAt")
      .sort({ endsAt: 1 })
      .limit(10)
      .lean(),
  ]);

  const gradeMap = new Map(
    grades.map((g) => [String(g.courseId), g.calculatedGPA ?? null]),
  );

  const attMap = new Map<string, { total: number; present: number }>();
  for (const a of attendanceDocs) {
    const key = String(a.courseId);
    const entry = attMap.get(key) ?? { total: 0, present: 0 };
    entry.total++;
    if (a.status === "present") entry.present++;
    attMap.set(key, entry);
  }

  const courseMap = new Map(enrolledCourses.map((c) => [String(c._id), c]));

  const testLines = upcomingTests.map((t) => {
    const c = courseMap.get(String(t.courseId));
    return `${c?.code ?? "Unknown"} — "${t.title}" — due ${new Date(t.endsAt).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}`;
  });

  const moduleLines = enrolledCourses.map((c) => {
    const gpa = gradeMap.get(String(c._id));
    const att = attMap.get(String(c._id));
    const attPct =
      att && att.total > 0
        ? Math.round((att.present / att.total) * 100)
        : null;
    const riskLevel =
      gpa !== null && gpa !== undefined
        ? gpa < 1.5
          ? "HIGH RISK"
          : gpa < 2.9
            ? "AT RISK"
            : "ON TRACK"
        : attPct !== null && attPct < 60
          ? "AT RISK (low attendance)"
          : "UNKNOWN";
    return `${c.code} (${c.name}) — GPA: ${gpa?.toFixed(1) ?? "ungraded"} — Attendance: ${attPct !== null ? attPct + "%" : "no records"} — Status: ${riskLevel}`;
  });

  // Generate plan from today until 2 weeks out (or next test, whichever is later)
  const targetDate = upcomingTests[0]
    ? new Date(upcomingTests[0].endsAt)
    : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const planEndDate = new Date(Math.max(targetDate.getTime(), now.getTime() + 7 * 24 * 60 * 60 * 1000));

  const todayStr = now.toISOString().split("T")[0];
  const endStr = planEndDate.toISOString().split("T")[0];

  const studyDayNames = parsed.data.studyDays.join(", ");

  const prompt = `You are an academic study planner. Generate a personalised day-by-day study schedule.

STUDENT'S ENROLLED MODULES (with risk assessment):
${moduleLines.join("\n")}

UPCOMING ASSESSMENTS:
${testLines.length > 0 ? testLines.join("\n") : "No upcoming tests found."}

STUDENT PREFERENCES:
- Available study days: ${studyDayNames}
- Study hours per day: ${parsed.data.hoursPerDay} hours

Generate a study schedule from ${todayStr} to ${endStr}.
Only include days that fall on: ${studyDayNames}.
Prioritise HIGH RISK and AT RISK modules, and modules with imminent tests.
Vary the activities (e.g., "Review lecture notes", "Complete practice problems", "Self-test on key concepts", "Revisit weak topics", "Work through past exam questions").

Respond ONLY with a valid JSON array. No prose, no markdown:
[
  {
    "date": "2026-08-08",
    "dayOfWeek": "Saturday",
    "moduleCode": "CS101",
    "moduleName": "Introduction to Computing",
    "activity": "Review lecture notes from weeks 1–4",
    "priority": "high"
  }
]

One entry per study day. Each day has exactly one module assignment. Higher-risk modules appear more frequently.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "AI service is not configured. Contact the college office." };
  }

  let plan: IStudyDay[];
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
    plan = JSON.parse(jsonMatch[0]) as IStudyDay[];
    if (!Array.isArray(plan) || plan.length === 0) {
      return { error: "AI returned no plan entries. Please try again." };
    }
  } catch {
    return { error: "Failed to generate study plan. Please try again." };
  }

  if (!isFreeRegen) {
    try {
      await deductCredits({
        studentId: me.userId,
        amount: PLAN_CREDIT_COST,
        reason: "spend.study_plan",
        note: `Study plan: ${parsed.data.studyDays.join("/")} · ${parsed.data.hoursPerDay}h/day`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Insufficient credits.";
      return { error: msg };
    }
  }

  await StudyPlan.create({
    studentId: meOid,
    plan,
    generatedAt: now,
    inputSnapshot: {
      hoursPerDay: parsed.data.hoursPerDay,
      studyDays: parsed.data.studyDays,
      upcomingTests: upcomingTests.map((t) => ({
        title: t.title,
        moduleCode: courseMap.get(String(t.courseId))?.code ?? "Unknown",
        date: new Date(t.endsAt).toISOString().split("T")[0],
      })),
    },
  });

  revalidatePath("/student/ai/study-plan");
  return { ok: true };
}
