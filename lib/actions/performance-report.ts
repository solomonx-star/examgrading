"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import Anthropic from "@anthropic-ai/sdk";
import { connectDB } from "@/lib/db";
import { Grade } from "@/models/Grade";
import { Course } from "@/models/Course";
import { Attendance } from "@/models/Attendance";
import { PerformanceReport } from "@/models/PerformanceReport";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { deductCredits, getBalance } from "@/lib/ai-credits-service";

const REPORT_CREDIT_COST = 10;

export async function generatePerformanceReportAction(): Promise<{
  ok: boolean;
  error?: string;
  reportId?: string;
}> {
  const me = await requireActiveStudentAccess();
  await connectDB();
  const meOid = new mongoose.Types.ObjectId(me.userId);

  const balance = await getBalance(me.userId);
  if (balance < REPORT_CREDIT_COST) {
    return {
      ok: false,
      error: `You need ${REPORT_CREDIT_COST} credits to generate a performance report. Your balance is ${balance}.`,
    };
  }

  // Gather all published grades with module info
  const grades = await Grade.find({
    studentId: meOid,
    isPublished: true,
  })
    .select(
      "courseId academicYear semester testScore examScore calculatedScore calculatedGrade calculatedGPA calculatedRemark",
    )
    .lean();

  if (grades.length === 0) {
    return {
      ok: false,
      error:
        "No published grades found. A performance report requires at least one published grade.",
    };
  }

  const courseIds = [...new Set(grades.map((g) => String(g.courseId)))];
  const courses = await Course.find({ _id: { $in: courseIds } })
    .select("_id code name yearLevel semester academicYear")
    .lean();
  const courseMap = new Map(courses.map((c) => [String(c._id), c]));

  // Attendance stats per course
  const attendanceDocs = await Attendance.find({
    studentId: meOid,
    courseId: { $in: courseIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("courseId status")
    .lean();

  const attendanceMap = new Map<string, { total: number; present: number }>();
  for (const a of attendanceDocs) {
    const key = String(a.courseId);
    const entry = attendanceMap.get(key) ?? { total: 0, present: 0 };
    entry.total++;
    if (a.status === "present") entry.present++;
    attendanceMap.set(key, entry);
  }

  // Build a concise data summary for the AI
  const gradeLines = grades.map((g) => {
    const c = courseMap.get(String(g.courseId));
    if (!c) return null;
    const att = attendanceMap.get(String(g.courseId));
    const attPct =
      att && att.total > 0
        ? Math.round((att.present / att.total) * 100)
        : null;
    const gap =
      g.testScore !== undefined &&
      g.examScore !== undefined &&
      g.testScore !== null &&
      g.examScore !== null
        ? g.testScore - g.examScore
        : null;
    return [
      `Module: ${c.code} (${c.name}) — Year ${c.yearLevel} — ${g.academicYear} ${g.semester}`,
      `  Test: ${g.testScore ?? "—"}/100  |  Exam: ${g.examScore ?? "—"}/100  |  Total: ${g.calculatedScore?.toFixed(1) ?? "—"}%  |  Grade: ${g.calculatedGrade ?? "—"}  (GPA ${g.calculatedGPA?.toFixed(1) ?? "—"})`,
      attPct !== null ? `  Attendance: ${attPct}%` : "",
      gap !== null
        ? `  Test-exam gap: ${gap > 0 ? "+" : ""}${gap.toFixed(1)} points`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const validLines = gradeLines.filter(Boolean) as string[];

  const prompt = `You are an academic performance coach. Analyse the following student data and produce a personalised, actionable performance report.

STUDENT ACADEMIC DATA:
${validLines.join("\n\n")}

Write a focused report (300–500 words) that:
1. Identifies 2–3 specific performance patterns (e.g. consistent test-exam gaps, modules at risk, attendance correlations)
2. Provides 3–5 concrete, evidence-based recommendations tailored to this student's actual data
3. Highlights any modules where immediate attention is needed

Be specific — reference actual module codes and numbers from the data. Avoid generic advice. Use plain paragraphs, no bullet lists or markdown headers in the output.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI service is not configured. Contact the college office.",
    };
  }

  let content: string;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "AI did not return a valid response. Please try again." };
    }
    content = textBlock.text.trim();
  } catch {
    return { ok: false, error: "Failed to generate report. Please try again." };
  }

  // Deduct credits only after successful generation
  try {
    await deductCredits({
      studentId: me.userId,
      amount: REPORT_CREDIT_COST,
      reason: "spend.performance_report",
      note: "AI performance coach report",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Insufficient credits.";
    return { ok: false, error: msg };
  }

  const report = await PerformanceReport.create({
    studentId: meOid,
    content,
    generatedAt: new Date(),
  });

  revalidatePath("/student/grades");
  revalidatePath("/student/ai/report");

  return { ok: true, reportId: String(report._id) };
}
