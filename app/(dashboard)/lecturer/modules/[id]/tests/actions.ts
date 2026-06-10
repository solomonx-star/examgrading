"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { zodToError, type FormState } from "@/lib/form-state";

const objectIdRe = /^[a-f\d]{24}$/i;

const createTestSchema = z
  .object({
    title: z.string().trim().min(2, "Title is required.").max(120),
    description: z.string().trim().max(500).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(1).max(600),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: "End time must be after the start time.",
    path: ["endsAt"],
  });

export async function createTestAction(
  courseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { me, course: mod } = await requireLecturerCourse(courseId);

  const parsed = createTestSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    durationMinutes: formData.get("durationMinutes"),
  });
  if (!parsed.success) {
    return { ok: false, error: zodToError(parsed.error) };
  }

  await connectDB();
  const created = await Test.create({
    courseId: mod._id,
    lecturerId: new mongoose.Types.ObjectId(me.userId),
    title: parsed.data.title,
    description: parsed.data.description,
    academicYear: mod.academicYear,
    semester: mod.semester,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    durationMinutes: parsed.data.durationMinutes,
    isPublished: false,
    questions: [],
  });

  await audit({
    action: "test.create",
    summary: `Created test "${parsed.data.title}" for ${mod.code}`,
    entityType: "Test",
    entityId: String(created._id),
    metadata: { courseId: String(mod._id) },
  });

  revalidatePath(`/lecturer/modules/${courseId}/tests`);
  redirect(`/lecturer/modules/${courseId}/tests/${created._id}`);
}

const optionSchema = z.object({
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    type: z.enum(["mcq", "true_false", "multi"]),
    prompt: z.string().trim().min(1).max(2000),
    points: z.coerce.number().int().min(1).max(100),
    options: z.array(optionSchema).min(2).max(6),
  })
  .refine(
    (q) => {
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (q.type === "multi") return correctCount >= 1;
      return correctCount === 1;
    },
    {
      message:
        "Single-answer questions need exactly one correct option; multi-answer questions need at least one.",
      path: ["options"],
    },
  );

const editTestSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(1).max(600),
    questions: z.array(questionSchema),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: "End time must be after the start time.",
    path: ["endsAt"],
  });

export async function updateTestAction(
  courseId: string,
  testId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { course: mod } = await requireLecturerCourse(courseId);
  if (!objectIdRe.test(testId)) {
    return { ok: false, error: "Invalid test id." };
  }

  await connectDB();
  const existing = await Test.findOne({ _id: testId, courseId: mod._id });
  if (!existing) return { ok: false, error: "Test not found." };

  const anySubmissions = await TestSubmission.exists({ testId: existing._id });
  if (existing.isPublished && anySubmissions) {
    return {
      ok: false,
      error:
        "Students have already started submissions — unpublish and clear them before editing.",
    };
  }

  const payloadJson = formData.get("payload");
  if (typeof payloadJson !== "string") {
    return { ok: false, error: "Missing payload." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: "Could not parse form payload." };
  }

  const parsed = editTestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: zodToError(parsed.error) };
  }

  existing.title = parsed.data.title;
  existing.description = parsed.data.description;
  existing.startsAt = parsed.data.startsAt;
  existing.endsAt = parsed.data.endsAt;
  existing.durationMinutes = parsed.data.durationMinutes;
  // Replace the full questions array — we don't try to merge IDs because
  // question edits invalidate any past attempts anyway.
  existing.set(
    "questions",
    parsed.data.questions.map((q) => ({
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    })),
  );
  await existing.save();

  await audit({
    action: "test.update",
    summary: `Updated test "${parsed.data.title}" for ${mod.code}`,
    entityType: "Test",
    entityId: String(existing._id),
    metadata: { questionCount: parsed.data.questions.length },
  });

  revalidatePath(`/lecturer/modules/${courseId}/tests`);
  revalidatePath(`/lecturer/modules/${courseId}/tests/${testId}`);
  return { ok: true, message: "Test saved." };
}

export async function publishTestAction(
  courseId: string,
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { course: mod } = await requireLecturerCourse(courseId);
  if (!objectIdRe.test(testId)) return { ok: false, error: "Invalid test id." };

  await connectDB();
  const t = await Test.findOne({ _id: testId, courseId: mod._id });
  if (!t) return { ok: false, error: "Test not found." };
  if (t.questions.length === 0) {
    return {
      ok: false,
      error: "Add at least one question before publishing.",
    };
  }

  t.isPublished = true;
  t.publishedAt = new Date();
  await t.save();

  await audit({
    action: "test.publish",
    summary: `Published test "${t.title}" for ${mod.code}`,
    entityType: "Test",
    entityId: String(t._id),
  });

  // Notify every enrolled student that there's a new test waiting.
  if (mod.enrolledStudents.length > 0) {
    const opensAt = new Date(t.startsAt).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    await notifyMany(
      mod.enrolledStudents.map((s) => String(s)),
      {
        type: "test.published",
        title: `New test: ${mod.code}`,
        body: `${t.title} opens ${opensAt} (${t.durationMinutes} min limit).`,
        link: `/student/modules/${courseId}/tests/${testId}`,
        metadata: {
          courseId: String(mod._id),
          testId: String(t._id),
          startsAt: t.startsAt.toISOString(),
          endsAt: t.endsAt.toISOString(),
        },
      },
    );
  }

  revalidatePath(`/lecturer/modules/${courseId}/tests`);
  revalidatePath(`/lecturer/modules/${courseId}/tests/${testId}`);
  return { ok: true };
}

export async function unpublishTestAction(
  courseId: string,
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { course: mod } = await requireLecturerCourse(courseId);
  if (!objectIdRe.test(testId)) return { ok: false, error: "Invalid test id." };

  await connectDB();
  const t = await Test.findOne({ _id: testId, courseId: mod._id });
  if (!t) return { ok: false, error: "Test not found." };

  const anySubmissions = await TestSubmission.exists({ testId: t._id });
  if (anySubmissions) {
    return {
      ok: false,
      error:
        "Students have already submitted. Clear submissions first if you need to edit the test.",
    };
  }

  t.isPublished = false;
  t.publishedAt = undefined;
  await t.save();

  revalidatePath(`/lecturer/modules/${courseId}/tests`);
  revalidatePath(`/lecturer/modules/${courseId}/tests/${testId}`);
  return { ok: true };
}

export async function deleteTestAction(
  courseId: string,
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { course: mod } = await requireLecturerCourse(courseId);
  if (!objectIdRe.test(testId)) return { ok: false, error: "Invalid test id." };

  await connectDB();
  const t = await Test.findOne({ _id: testId, courseId: mod._id });
  if (!t) return { ok: false, error: "Test not found." };

  const anySubmissions = await TestSubmission.exists({ testId: t._id });
  if (anySubmissions) {
    return {
      ok: false,
      error: "Cannot delete a test with submissions.",
    };
  }

  await Test.deleteOne({ _id: t._id });

  await audit({
    action: "test.delete",
    summary: `Deleted test "${t.title}" for ${mod.code}`,
    entityType: "Test",
    entityId: String(t._id),
  });

  revalidatePath(`/lecturer/modules/${courseId}/tests`);
  redirect(`/lecturer/modules/${courseId}/tests`);
}
