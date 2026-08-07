"use server";

import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import { Course } from "@/models/Course";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  isPinned: z.boolean().default(false),
});

export async function createAnnouncementAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "lecturer") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = createSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    body: formData.get("body"),
    isPinned: formData.get("isPinned") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { courseId, title, body, isPinned } = parsed.data;
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return { ok: false, error: "Invalid course" };
  }

  await connectDB();
  const course = await Course.findOne({
    _id: courseId,
    lecturerId: session.user.id,
  }).lean();
  if (!course) return { ok: false, error: "Course not found or not yours" };

  const announcement = await Announcement.create({
    courseId,
    authorId: session.user.id,
    title,
    body,
    isPinned,
  });

  await audit({
    action: "announcement.create",
    summary: `Lecturer posted announcement "${title}" for course ${course.code}`,
    entityType: "Announcement",
    entityId: String(announcement._id),
    metadata: { courseId },
  });

  revalidatePath(`/lecturer/modules/${courseId}`);
  revalidatePath(`/student/modules/${courseId}`);

  return { ok: true };
}

export async function deleteAnnouncementAction(
  announcementId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "lecturer") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!mongoose.Types.ObjectId.isValid(announcementId)) {
    return { ok: false, error: "Invalid ID" };
  }

  await connectDB();
  const ann = await Announcement.findById(announcementId).lean();
  if (!ann || String(ann.authorId) !== session.user.id) {
    return { ok: false, error: "Not found or not yours" };
  }

  await Announcement.deleteOne({ _id: announcementId });

  revalidatePath(`/lecturer/modules/${String(ann.courseId)}`);
  revalidatePath(`/student/modules/${String(ann.courseId)}`);

  return { ok: true };
}
