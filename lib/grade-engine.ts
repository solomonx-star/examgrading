// Server-only: touches Mongo via Mongoose. Do not import from client.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { Course } from "@/models/Course";
import { Grade } from "@/models/Grade";
import { getEffectiveGradingRule } from "@/lib/grading-server";

export type AttendanceStat = {
  total: number;
  present: number;
  pct: number | null;
};

export async function computeAttendanceStatsForCourse(
  courseId: string,
  studentIds: string[],
): Promise<Map<string, AttendanceStat>> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(courseId) || studentIds.length === 0) {
    return new Map();
  }
  const ids = studentIds
    .filter((s) => mongoose.Types.ObjectId.isValid(s))
    .map((s) => new mongoose.Types.ObjectId(s));
  const stats = await Attendance.aggregate<{
    _id: mongoose.Types.ObjectId;
    total: number;
    present: number;
  }>([
    {
      $match: {
        courseId: new mongoose.Types.ObjectId(courseId),
        studentId: { $in: ids },
      },
    },
    {
      $group: {
        _id: "$studentId",
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
      },
    },
  ]);
  const map = new Map<string, AttendanceStat>();
  for (const s of stats) {
    map.set(String(s._id), {
      total: s.total,
      present: s.present,
      pct: s.total > 0 ? Math.round((s.present / s.total) * 100) : null,
    });
  }
  return map;
}

/**
 * Returns a map of studentId → attendanceMet (boolean) for those that have
 * any attendance records. Students with no records are intentionally absent
 * from the map so callers can leave their attendanceMet field unset.
 */
export async function computeAttendanceMet(
  courseId: string,
  studentIds: string[],
  threshold: number,
): Promise<Map<string, boolean>> {
  const stats = await computeAttendanceStatsForCourse(courseId, studentIds);
  const flags = new Map<string, boolean>();
  for (const [sid, s] of stats.entries()) {
    if (s.pct === null) continue;
    flags.set(sid, s.pct >= threshold);
  }
  return flags;
}

/**
 * After attendance is changed, refresh the attendanceMet flag on every existing
 * Grade doc for the course's current academic period — without touching scores.
 * Grades that don't exist yet are not created here.
 */
export async function refreshAttendanceFlagForCourse(
  courseId: string,
): Promise<{ updated: number }> {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return { updated: 0 };
  await connectDB();
  const mod = await Course.findById(courseId)
    .select("academicYear semester enrolledStudents")
    .lean();
  if (!mod) return { updated: 0 };
  const rule = await getEffectiveGradingRule(courseId);
  if (!rule) return { updated: 0 };

  const studentIds = mod.enrolledStudents.map((s) => String(s));
  const flags = await computeAttendanceMet(
    courseId,
    studentIds,
    rule.attendanceThreshold,
  );
  if (flags.size === 0) return { updated: 0 };

  const moduleOid = new mongoose.Types.ObjectId(courseId);
  const ops = [...flags.entries()].map(([sid, met]) => ({
    updateOne: {
      filter: {
        courseId: moduleOid,
        studentId: new mongoose.Types.ObjectId(sid),
        academicYear: mod.academicYear,
        semester: mod.semester,
      },
      update: { $set: { attendanceMet: met } },
    },
  }));
  const result = await Grade.bulkWrite(ops);
  return { updated: result.modifiedCount ?? 0 };
}
