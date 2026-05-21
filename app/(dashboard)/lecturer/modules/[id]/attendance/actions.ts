"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { refreshAttendanceFlagForCourse } from "@/lib/grade-engine";
import { audit } from "@/lib/audit";
import { zodToError, type FormState } from "@/lib/form-state";

const statusEnum = z.enum(["present", "absent", "late"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

const recordSchema = z.object({
  studentId: z.string().regex(/^[a-f\d]{24}$/i),
  status: statusEnum,
});

export async function saveAttendanceAction(
  courseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { me, course: mod } = await requireLecturerCourse(courseId);

  const dateStr = String(formData.get("date") ?? "");
  const date = dateSchema.safeParse(dateStr);
  if (!date.success) return { ok: false, error: "Invalid date." };

  // Parse `status[<studentId>]` from the form
  const rows: Array<{ studentId: string; status: "present" | "absent" | "late" }> = [];
  for (const [key, val] of formData.entries()) {
    const m = key.match(/^status\[([a-f\d]{24})\]$/i);
    if (!m) continue;
    const parsed = recordSchema.safeParse({
      studentId: m[1],
      status: String(val),
    });
    if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };
    rows.push(parsed.data);
  }

  // Restrict to enrolled students only — defence against tampered forms
  const enrolled = new Set(mod.enrolledStudents.map((s) => String(s)));
  const allowed = rows.filter((r) => enrolled.has(r.studentId));
  if (allowed.length === 0) {
    return { ok: false, error: "No valid attendance rows to save." };
  }

  // Date stored as UTC start-of-day; Sierra Leone is GMT+0 so this aligns
  const dayUTC = new Date(`${date.data}T00:00:00.000Z`);

  await connectDB();
  const lecturerObjectId = new mongoose.Types.ObjectId(me.userId);
  await Attendance.bulkWrite(
    allowed.map((r) => ({
      updateOne: {
        filter: {
          courseId: mod._id,
          studentId: new mongoose.Types.ObjectId(r.studentId),
          date: dayUTC,
        },
        update: {
          $set: {
            status: r.status,
            lecturerId: lecturerObjectId,
            semester: mod.semester,
            academicYear: mod.academicYear,
          },
        },
        upsert: true,
      },
    })),
  );

  // Recompute attendanceMet on any existing Grade docs for this course
  // so the lecturer sees updated flags without having to re-save grades.
  await refreshAttendanceFlagForCourse(courseId);

  revalidatePath(`/lecturer/modules/${courseId}/attendance`);
  revalidatePath(`/lecturer/modules/${courseId}/grades`);
  revalidatePath(`/lecturer/modules/${courseId}`);
  await audit({
    action: "attendance.save",
    summary: `Recorded attendance for ${allowed.length} student${allowed.length === 1 ? "" : "s"} on ${date.data} in ${mod.code}`,
    entityType: "Course",
    entityId: String(mod._id),
    metadata: { count: allowed.length, code: mod.code, date: date.data },
  });
  return { ok: true, message: `Saved ${allowed.length} attendance rows for ${date.data}.` };
}
