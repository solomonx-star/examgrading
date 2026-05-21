// Server-only: Mongoose queries for the student dashboard.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Attendance } from "@/models/Attendance";
import { Grade } from "@/models/Grade";

export type ModuleLite = {
  id: string;
  code: string;
  name: string;
  programmeId: string;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
};

export async function getEnrolledModules(
  studentId: string,
): Promise<ModuleLite[]> {
  await connectDB();
  const modules = await Course.find({
    enrolledStudents: new mongoose.Types.ObjectId(studentId),
  })
    .select("code name programmeId yearLevel academicYear semester")
    .sort({ yearLevel: 1, academicYear: -1, semester: 1, code: 1 })
    .lean();
  return modules.map((m) => ({
    id: String(m._id),
    code: m.code,
    name: m.name,
    programmeId: String(m.programmeId),
    yearLevel: m.yearLevel,
    academicYear: m.academicYear,
    semester: m.semester,
  }));
}

export type AttendanceCourseStats = {
  courseId: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  pct: number | null;
};

export async function getAttendanceStatsForStudent(
  studentId: string,
  courseIds: string[],
): Promise<Map<string, AttendanceCourseStats>> {
  await connectDB();
  if (courseIds.length === 0) return new Map();
  const stats = await Attendance.aggregate<{
    _id: mongoose.Types.ObjectId;
    total: number;
    present: number;
    absent: number;
    late: number;
  }>([
    {
      $match: {
        studentId: new mongoose.Types.ObjectId(studentId),
        courseId: {
          $in: courseIds.map((m) => new mongoose.Types.ObjectId(m)),
        },
      },
    },
    {
      $group: {
        _id: "$courseId",
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
      },
    },
  ]);
  const map = new Map<string, AttendanceCourseStats>();
  for (const s of stats) {
    map.set(String(s._id), {
      courseId: String(s._id),
      total: s.total,
      present: s.present,
      absent: s.absent,
      late: s.late,
      pct: s.total > 0 ? Math.round((s.present / s.total) * 100) : null,
    });
  }
  return map;
}

export async function getPublishedGradesForStudent(studentId: string) {
  await connectDB();
  return Grade.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    isPublished: true,
  }).lean();
}

/**
 * Plain average of module GPAs (IAM CO does not use credit hours).
 */
export function averageGPA(
  rows: Array<{ gpa: number | null | undefined }>,
): { gpa: number | null; count: number } {
  let total = 0;
  let count = 0;
  for (const r of rows) {
    if (typeof r.gpa !== "number") continue;
    total += r.gpa;
    count += 1;
  }
  if (count === 0) return { gpa: null, count: 0 };
  return { gpa: Math.round((total / count) * 100) / 100, count };
}
