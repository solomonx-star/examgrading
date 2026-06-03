// Server-only: queries for the admin's per-cohort grade review.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Course } from "@/models/Course";
import { Grade } from "@/models/Grade";

export type CohortStudentRow = {
  studentId: string;
  studentCode: string;
  name: string;
  modulesTotal: number; // total modules in this cohort (every student sees the same set)
  drafts: number; // grades saved but not yet submitted by lecturers
  submitted: number; // submitted but not yet published by admin
  published: number;
  attendanceWarnings: number;
};

/**
 * Lists every student in (programmeId, yearLevel) along with per-student
 * counts of how many modules are at each stage for the chosen period.
 */
export async function loadCohortRows(args: {
  programmeId: string;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
}): Promise<CohortStudentRow[]> {
  const { programmeId, yearLevel, academicYear, semester } = args;
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(programmeId)) return [];
  const programmeOid = new mongoose.Types.ObjectId(programmeId);

  // Cohort modules — the universe of work expected per student. Shared
  // modules list this programme in their `programmeIds` array.
  const courses = await Course.find({
    programmeIds: programmeOid,
    yearLevel,
    academicYear,
    semester,
  })
    .select("_id")
    .lean();
  const courseIds = courses.map((m) => m._id);
  const modulesTotal = courseIds.length;

  const students = await User.find({
    role: "student",
    programmeId: programmeOid,
    yearLevel,
    isActive: true,
  })
    .select("name studentId")
    .sort({ name: 1 })
    .lean();

  if (modulesTotal === 0 || students.length === 0) {
    return students.map((s) => ({
      studentId: String(s._id),
      studentCode: s.studentId ?? "",
      name: s.name as string,
      modulesTotal,
      drafts: 0,
      submitted: 0,
      published: 0,
      attendanceWarnings: 0,
    }));
  }

  const studentIds = students.map((s) => s._id);

  const grades = await Grade.aggregate<{
    _id: mongoose.Types.ObjectId;
    drafts: number;
    submitted: number;
    published: number;
    attendanceWarnings: number;
  }>([
    {
      $match: {
        courseId: { $in: courseIds },
        studentId: { $in: studentIds },
        academicYear,
        semester,
      },
    },
    {
      $group: {
        _id: "$studentId",
        drafts: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$submissionStatus", "draft"] },
                  { $ne: ["$isPublished", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        submitted: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$submissionStatus", "submitted"] },
                  { $ne: ["$isPublished", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        published: {
          $sum: { $cond: [{ $eq: ["$isPublished", true] }, 1, 0] },
        },
        attendanceWarnings: {
          $sum: { $cond: [{ $eq: ["$attendanceMet", false] }, 1, 0] },
        },
      },
    },
  ]);
  const byStudent = new Map(grades.map((g) => [String(g._id), g]));

  return students.map((s) => {
    const counts = byStudent.get(String(s._id));
    return {
      studentId: String(s._id),
      studentCode: s.studentId ?? "",
      name: s.name as string,
      modulesTotal,
      drafts: counts?.drafts ?? 0,
      submitted: counts?.submitted ?? 0,
      published: counts?.published ?? 0,
      attendanceWarnings: counts?.attendanceWarnings ?? 0,
    };
  });
}

export type StudentGradeRow = {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
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

/**
 * Loads every cohort module for one student in one period, joined to the
 * student's grade for that module (if any). Used by the per-student review
 * + publish page.
 */
export async function loadStudentReviewRows(args: {
  studentId: string;
  programmeId: string;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
}): Promise<StudentGradeRow[]> {
  const { studentId, programmeId, yearLevel, academicYear, semester } = args;
  await connectDB();
  if (
    !mongoose.Types.ObjectId.isValid(studentId) ||
    !mongoose.Types.ObjectId.isValid(programmeId)
  ) {
    return [];
  }
  const studentOid = new mongoose.Types.ObjectId(studentId);
  const programmeOid = new mongoose.Types.ObjectId(programmeId);

  const courses = await Course.find({
    programmeIds: programmeOid,
    yearLevel,
    academicYear,
    semester,
  })
    .select("code name")
    .sort({ code: 1 })
    .lean();

  const grades = await Grade.find({
    studentId: studentOid,
    courseId: { $in: courses.map((m) => m._id) },
    academicYear,
    semester,
  }).lean();
  const gradeByCourse = new Map(grades.map((g) => [String(g.courseId), g]));

  return courses.map((m) => {
    const g = gradeByCourse.get(String(m._id));
    return {
      moduleId: String(m._id),
      moduleCode: m.code,
      moduleName: m.name,
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
