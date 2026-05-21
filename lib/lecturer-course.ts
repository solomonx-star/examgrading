import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { requireLecturerScope } from "@/lib/lecturer-scope";

/**
 * Loads a course and verifies the current user is the assigned lecturer.
 * 404s on missing or unassigned courses.
 */
export async function requireLecturerCourse(courseId: string) {
  const me = await requireLecturerScope();
  if (!mongoose.Types.ObjectId.isValid(courseId)) notFound();
  await connectDB();
  const mod = await Course.findOne({
    _id: courseId,
    lecturerId: me.userId,
  }).lean();
  if (!mod) notFound();
  return { me, course: mod };
}
