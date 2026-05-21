// Server-only: shared queries powering grade/attendance reports.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { User } from "@/models/User";
import { Grade } from "@/models/Grade";
import { Attendance } from "@/models/Attendance";

export type CourseHeader = {
  id: string;
  code: string;
  name: string;
  programmeId: string;
  programmeName: string | null;
  programmeCode: string | null;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
};

export async function loadCourseForDepartment(
  courseId: string,
  department: string,
): Promise<CourseHeader | null> {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  await connectDB();
  const mod = await Course.findById(courseId)
    .select("code name programmeId yearLevel academicYear semester")
    .lean();
  if (!mod) return null;
  // Department scoping: derive from the parent programme.
  const programme = await Programme.findById(mod.programmeId)
    .select("name code department")
    .lean();
  if (!programme || programme.department !== department) return null;
  return {
    id: String(mod._id),
    code: mod.code,
    name: mod.name,
    programmeId: String(mod.programmeId),
    programmeName: programme.name,
    programmeCode: programme.code,
    yearLevel: mod.yearLevel,
    academicYear: mod.academicYear,
    semester: mod.semester,
  };
}

export async function loadCourseForLecturer(
  courseId: string,
  lecturerId: string,
): Promise<CourseHeader | null> {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  await connectDB();
  const mod = await Course.findOne({ _id: courseId, lecturerId })
    .select("code name programmeId yearLevel academicYear semester")
    .lean();
  if (!mod) return null;
  const programme = await Programme.findById(mod.programmeId)
    .select("name code")
    .lean();
  return {
    id: String(mod._id),
    code: mod.code,
    name: mod.name,
    programmeId: String(mod.programmeId),
    programmeName: programme?.name ?? null,
    programmeCode: programme?.code ?? null,
    yearLevel: mod.yearLevel,
    academicYear: mod.academicYear,
    semester: mod.semester,
  };
}

export type GradeReportRow = {
  studentId: string;
  studentCode: string;
  name: string;
  isActive: boolean;
  testScore: number | null;
  testMaxScore: number | null;
  examScore: number | null;
  examMaxScore: number | null;
  finalScore: number | null;
  grade: string | null;
  gpa: number | null;
  remark: string | null;
  attendanceMet: boolean | null;
  submissionStatus: "draft" | "submitted" | null;
  isPublished: boolean;
  hasGrade: boolean;
};

export async function loadGradeReportRows(
  courseId: string,
): Promise<GradeReportRow[]> {
  await connectDB();
  const moduleOid = new mongoose.Types.ObjectId(courseId);
  const mod = await Course.findById(moduleOid)
    .select("enrolledStudents academicYear semester")
    .lean();
  if (!mod) return [];

  const [students, grades] = await Promise.all([
    User.find({ _id: { $in: mod.enrolledStudents } })
      .select("name studentId isActive")
      .sort({ name: 1 })
      .lean(),
    Grade.find({
      courseId: moduleOid,
      academicYear: mod.academicYear,
      semester: mod.semester,
    }).lean(),
  ]);

  const byStudent = new Map(grades.map((g) => [String(g.studentId), g]));

  return students.map((s) => {
    const g = byStudent.get(String(s._id));
    return {
      studentId: String(s._id),
      studentCode: s.studentId ?? "",
      name: s.name as string,
      isActive: !!s.isActive,
      testScore: g?.testScore ?? null,
      testMaxScore: g?.testMaxScore ?? null,
      examScore: g?.examScore ?? null,
      examMaxScore: g?.examMaxScore ?? null,
      finalScore: g?.calculatedScore ?? null,
      grade: g?.calculatedGrade ?? null,
      gpa: g?.calculatedGPA ?? null,
      remark: g?.calculatedRemark ?? null,
      attendanceMet:
        typeof g?.attendanceMet === "boolean" ? g.attendanceMet : null,
      submissionStatus: g ? g.submissionStatus : null,
      isPublished: !!g?.isPublished,
      hasGrade: !!g,
    };
  });
}

export type AttendanceReportSummary = {
  studentId: string;
  studentCode: string;
  name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  pct: number | null;
};

export type AttendanceLogEntry = {
  date: Date;
  studentId: string;
  studentCode: string;
  name: string;
  status: "present" | "absent" | "late";
  notes: string | null;
};

export async function loadAttendanceReport(
  courseId: string,
  fromDate?: Date,
  toDate?: Date,
): Promise<{
  summary: AttendanceReportSummary[];
  log: AttendanceLogEntry[];
}> {
  await connectDB();
  const moduleOid = new mongoose.Types.ObjectId(courseId);
  const mod = await Course.findById(moduleOid)
    .select("enrolledStudents")
    .lean();
  if (!mod) return { summary: [], log: [] };

  const students = await User.find({ _id: { $in: mod.enrolledStudents } })
    .select("name studentId")
    .sort({ name: 1 })
    .lean();
  const meta = new Map(
    students.map((s) => [
      String(s._id),
      { name: s.name as string, studentCode: s.studentId ?? "" },
    ]),
  );

  const filter: Record<string, unknown> = {
    courseId: moduleOid,
    studentId: { $in: mod.enrolledStudents },
  };
  if (fromDate || toDate) {
    const range: Record<string, Date> = {};
    if (fromDate) range.$gte = fromDate;
    if (toDate) range.$lte = toDate;
    filter.date = range;
  }

  const records = await Attendance.find(filter)
    .select("date status notes studentId")
    .sort({ date: -1, studentId: 1 })
    .lean();

  const stats = new Map<
    string,
    { total: number; present: number; absent: number; late: number }
  >();
  for (const sid of meta.keys()) {
    stats.set(sid, { total: 0, present: 0, absent: 0, late: 0 });
  }
  for (const r of records) {
    const sid = String(r.studentId);
    const s = stats.get(sid);
    if (!s) continue;
    s.total += 1;
    if (r.status === "present") s.present += 1;
    else if (r.status === "absent") s.absent += 1;
    else if (r.status === "late") s.late += 1;
  }

  const summary: AttendanceReportSummary[] = [...meta.entries()].map(
    ([sid, m]) => {
      const s = stats.get(sid)!;
      return {
        studentId: sid,
        studentCode: m.studentCode,
        name: m.name,
        total: s.total,
        present: s.present,
        absent: s.absent,
        late: s.late,
        pct: s.total > 0 ? Math.round((s.present / s.total) * 100) : null,
      };
    },
  );

  const log: AttendanceLogEntry[] = records.map((r) => {
    const m = meta.get(String(r.studentId));
    return {
      date: new Date(r.date),
      studentId: String(r.studentId),
      studentCode: m?.studentCode ?? "",
      name: m?.name ?? "—",
      status: r.status as "present" | "absent" | "late",
      notes: r.notes ?? null,
    };
  });

  return { summary, log };
}
