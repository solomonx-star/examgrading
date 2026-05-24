/* eslint-disable no-console */
import { config as loadEnv } from "dotenv";
// Next.js convention: .env.local overrides .env. Load both, with .env.local
// taking precedence.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { Module } from "@/models/Module";
import { Grade } from "@/models/Grade";
import { Attendance } from "@/models/Attendance";
import { GradingRule } from "@/models/GradingRule";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import type { UserRole } from "@/models/User";

const RESET = process.argv.includes("--reset");
const SUPERADMIN_ONLY =
  process.argv.includes("--superadmin-only") ||
  process.env.NODE_ENV === "production";
const DEFAULT_PASSWORD = "iamco1234";
const ACADEMIC_YEAR = "2025/2026";
const SEMESTER: "First" | "Second" | "Summer" = "First";

type SeedProgramme = {
  name: string;
  code: string;
  department: string;
};

type SeedStaff = {
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  staffId?: string;
  mustChangePassword?: boolean;
};

type SeedStudent = {
  name: string;
  email: string;
  programmeCode: string;
  yearLevel: number;
  department: string;
};

const SUPER_ADMIN: SeedStaff = {
  name: "System Owner",
  email: "super@iamco.edu.sl",
  role: "superadmin",
  staffId: "IAMCO-SA-0001",
  // Convenience for dev: skip the change-password gate for the seeded super admin.
  mustChangePassword: false,
};

const ADMINS: SeedStaff[] = [
  {
    name: "Aminata Bangura",
    email: "admin.aminata@iamco.edu.sl",
    role: "admin",
    department: "Computer Science",
    staffId: "IAMCO-ADM-0001",
  },
  {
    name: "Mohamed Kamara",
    email: "admin.mohamed@iamco.edu.sl",
    role: "admin",
    department: "Business Administration",
    staffId: "IAMCO-ADM-0002",
  },
];

const LECTURERS: SeedStaff[] = [
  {
    name: "Dr. Fatmata Sesay",
    email: "lecturer.fatmata@iamco.edu.sl",
    role: "lecturer",
    department: "Computer Science",
    staffId: "IAMCO-LEC-0001",
  },
  {
    name: "Dr. Ibrahim Conteh",
    email: "lecturer.ibrahim@iamco.edu.sl",
    role: "lecturer",
    department: "Computer Science",
    staffId: "IAMCO-LEC-0002",
  },
  {
    name: "Ms. Isatu Koroma",
    email: "lecturer.isatu@iamco.edu.sl",
    role: "lecturer",
    department: "Business Administration",
    staffId: "IAMCO-LEC-0003",
  },
  {
    name: "Mr. Sheku Turay",
    email: "lecturer.sheku@iamco.edu.sl",
    role: "lecturer",
    department: "General Studies",
    staffId: "IAMCO-LEC-0004",
  },
];

const PROGRAMMES: SeedProgramme[] = [
  { name: "BSc Computer Science", code: "BSCCS", department: "Computer Science" },
  { name: "BBA", code: "BBA", department: "Business Administration" },
  {
    name: "Diploma in General Studies",
    code: "DGS",
    department: "General Studies",
  },
];

const STUDENTS: SeedStudent[] = [
  // BSCCS Year 1
  { name: "Abdul Kargbo", email: "student.abdul@iamco.edu.sl", programmeCode: "BSCCS", yearLevel: 1, department: "Computer Science" },
  { name: "Mariama Jalloh", email: "student.mariama@iamco.edu.sl", programmeCode: "BSCCS", yearLevel: 1, department: "Computer Science" },
  { name: "Saidu Mansaray", email: "student.saidu@iamco.edu.sl", programmeCode: "BSCCS", yearLevel: 1, department: "Computer Science" },
  // BSCCS Year 2
  { name: "Hawanatu Fofanah", email: "student.hawanatu@iamco.edu.sl", programmeCode: "BSCCS", yearLevel: 2, department: "Computer Science" },
  { name: "Mustapha Bah", email: "student.mustapha@iamco.edu.sl", programmeCode: "BSCCS", yearLevel: 2, department: "Computer Science" },
  // BBA Year 1
  { name: "Adama Sankoh", email: "student.adama@iamco.edu.sl", programmeCode: "BBA", yearLevel: 1, department: "Business Administration" },
  { name: "Foday Lansana", email: "student.foday@iamco.edu.sl", programmeCode: "BBA", yearLevel: 1, department: "Business Administration" },
  { name: "Memunatu Kallon", email: "student.memunatu@iamco.edu.sl", programmeCode: "BBA", yearLevel: 1, department: "Business Administration" },
  // BBA Year 2
  { name: "Salieu Dumbuya", email: "student.salieu@iamco.edu.sl", programmeCode: "BBA", yearLevel: 2, department: "Business Administration" },
  { name: "Zainab Conteh", email: "student.zainab@iamco.edu.sl", programmeCode: "BBA", yearLevel: 2, department: "Business Administration" },
  // DGS Year 1
  { name: "Tamba Komeh", email: "student.tamba@iamco.edu.sl", programmeCode: "DGS", yearLevel: 1, department: "General Studies" },
  { name: "Kadiatu Yansaneh", email: "student.kadiatu@iamco.edu.sl", programmeCode: "DGS", yearLevel: 1, department: "General Studies" },
];

// IAM CO official grade scale (per the diploma grade sheet)
const DEFAULT_GRADE_SCALE = [
  { min: 80, max: 100, grade: "A+", gpa: 4.5, remark: "Excellent" },
  { min: 75, max: 79, grade: "A", gpa: 4.0, remark: "Fairly Good" },
  { min: 70, max: 74, grade: "A-", gpa: 3.75, remark: "V Good" },
  { min: 65, max: 69, grade: "B+", gpa: 3.5, remark: "Fairly Good" },
  { min: 60, max: 64, grade: "B", gpa: 3.0, remark: "Good" },
  { min: 55, max: 59, grade: "B-", gpa: 2.75, remark: "Credit" },
  { min: 50, max: 54, grade: "C+", gpa: 2.5, remark: "Credit" },
  { min: 46, max: 49, grade: "C", gpa: 2.0, remark: "Pass" },
  { min: 40, max: 45, grade: "C-", gpa: 1.5, remark: "Pass" },
  { min: 35, max: 39, grade: "D", gpa: 1.0, remark: "Fail" },
  { min: 30, max: 34, grade: "E", gpa: 0.5, remark: "Fail" },
  { min: 0, max: 29, grade: "F", gpa: 0.0, remark: "Fail" },
];

async function upsertStaff(seed: SeedStaff): Promise<InstanceType<typeof User>> {
  const existing = await User.findOne({ email: seed.email });
  if (existing) return existing;
  const created = await User.create({
    name: seed.name,
    email: seed.email,
    password: DEFAULT_PASSWORD,
    role: seed.role,
    department: seed.department,
    staffId: seed.staffId,
    isActive: true,
    mustChangePassword: seed.mustChangePassword ?? true,
  });
  return created;
}

async function upsertStudent(
  seed: SeedStudent,
  programmeId: mongoose.Types.ObjectId,
): Promise<InstanceType<typeof User>> {
  const existing = await User.findOne({ email: seed.email });
  if (existing) return existing;
  const created = await User.create({
    name: seed.name,
    email: seed.email,
    password: DEFAULT_PASSWORD,
    role: "student",
    department: seed.department,
    programmeId,
    yearLevel: seed.yearLevel,
    isActive: true,
    mustChangePassword: true,
  });
  return created;
}

async function run() {
  console.log(
    `MONGODB_URI: ${process.env.MONGODB_URI ? "(set)" : "(missing)"}`,
  );
  await connectDB();
  console.log(`Connected to ${mongoose.connection.name}`);

  if (RESET && SUPERADMIN_ONLY) {
    throw new Error(
      "Refusing to --reset while in superadmin-only mode (production). " +
        "Remove --reset or unset NODE_ENV=production to run a full reset.",
    );
  }

  if (RESET) {
    console.log("--reset: dropping collections…");
    await Promise.all([
      User.deleteMany({}),
      Programme.deleteMany({}),
      Module.deleteMany({}),
      Grade.deleteMany({}),
      Attendance.deleteMany({}),
      GradingRule.deleteMany({}),
      AcademicPeriod.deleteMany({}),
    ]);
    // Drop the old `courses` collection if it still exists from a previous schema
    try {
      await mongoose.connection.db?.collection("courses").drop();
      console.log("dropped legacy 'courses' collection");
    } catch {
      // collection didn't exist — fine
    }
  }

  // Drop any indexes that no longer match the Mongoose schema (e.g. left over
  // from renamed fields like courseId→moduleId). Without this, unique indexes
  // on missing fields collapse all new docs onto the same `null` key and the
  // second write fails with E11000 duplicate key.
  console.log("Syncing indexes…");
  for (const M of [User, Programme, Module, Grade, Attendance, GradingRule, AcademicPeriod]) {
    const dropped = await M.syncIndexes();
    if (dropped.length) {
      console.log(`  ${M.collection.name}: dropped → ${dropped.join(", ")}`);
    }
  }

  console.log("Seeding super admin…");
  const superAdmin = await upsertStaff(SUPER_ADMIN);

  if (SUPERADMIN_ONLY) {
    console.log(
      "\n✓ Superadmin-only seed complete (NODE_ENV=production or --superadmin-only).",
    );
    console.log(
      `  Super admin: ${SUPER_ADMIN.email} (password '${DEFAULT_PASSWORD}' — change immediately)`,
    );
    void superAdmin;
    await mongoose.disconnect();
    return;
  }

  console.log("Seeding admins…");
  for (const a of ADMINS) await upsertStaff(a);

  console.log("Seeding lecturers…");
  const lecturerDocs: InstanceType<typeof User>[] = [];
  for (const l of LECTURERS) lecturerDocs.push(await upsertStaff(l));

  console.log("Seeding programmes…");
  const programmeByCode = new Map<string, mongoose.Types.ObjectId>();
  for (const p of PROGRAMMES) {
    const existing = await Programme.findOne({ code: p.code });
    if (existing) {
      programmeByCode.set(p.code, existing._id);
      continue;
    }
    const doc = await Programme.create({
      name: p.name,
      code: p.code,
      department: p.department,
      isActive: true,
    });
    programmeByCode.set(p.code, doc._id);
  }

  console.log("Seeding students…");
  const studentDocs: InstanceType<typeof User>[] = [];
  for (const s of STUDENTS) {
    const programmeId = programmeByCode.get(s.programmeCode);
    if (!programmeId) {
      throw new Error(`Programme not found for code ${s.programmeCode}`);
    }
    studentDocs.push(await upsertStudent(s, programmeId));
  }

  console.log("Seeding default grading rule…");
  const rule = await GradingRule.findOneAndUpdate(
    { name: "IAM CO Default", courseId: null },
    {
      $setOnInsert: {
        name: "IAM CO Default",
        courseId: null,
        caWeight: 30,
        examWeight: 70,
        attendanceThreshold: 75,
        gradeScale: DEFAULT_GRADE_SCALE,
        createdBy: superAdmin._id,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  console.log("Seeding academic period…");
  await AcademicPeriod.findOneAndUpdate(
    { year: ACADEMIC_YEAR, semester: SEMESTER },
    {
      $setOnInsert: {
        year: ACADEMIC_YEAR,
        semester: SEMESTER,
        isCurrent: true,
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-01-31"),
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  console.log("Seeding modules…");
  const studentsByProgrammeYear = new Map<string, mongoose.Types.ObjectId[]>();
  for (const s of studentDocs) {
    const key = `${String(s.programmeId)}|${s.yearLevel}`;
    const arr = studentsByProgrammeYear.get(key) ?? [];
    arr.push(s._id);
    studentsByProgrammeYear.set(key, arr);
  }

  const lecByEmail = new Map(lecturerDocs.map((l) => [l.email, l]));

  const modules: Array<{
    code: string;
    name: string;
    programmeCode: string;
    yearLevel: number;
    lecturerEmail: string;
  }> = [
    {
      code: "CS101",
      name: "Introduction to Computer Science",
      programmeCode: "BSCCS",
      yearLevel: 1,
      lecturerEmail: "lecturer.fatmata@iamco.edu.sl",
    },
    {
      code: "CS201",
      name: "Data Structures",
      programmeCode: "BSCCS",
      yearLevel: 2,
      lecturerEmail: "lecturer.ibrahim@iamco.edu.sl",
    },
    {
      code: "BUS101",
      name: "Principles of Management",
      programmeCode: "BBA",
      yearLevel: 1,
      lecturerEmail: "lecturer.isatu@iamco.edu.sl",
    },
    {
      code: "BUS201",
      name: "Financial Accounting",
      programmeCode: "BBA",
      yearLevel: 2,
      lecturerEmail: "lecturer.isatu@iamco.edu.sl",
    },
    {
      code: "GEN101",
      name: "English Communication",
      programmeCode: "DGS",
      yearLevel: 1,
      lecturerEmail: "lecturer.sheku@iamco.edu.sl",
    },
  ];

  for (const m of modules) {
    const lec = lecByEmail.get(m.lecturerEmail);
    if (!lec) throw new Error(`Lecturer not found: ${m.lecturerEmail}`);
    const programmeId = programmeByCode.get(m.programmeCode);
    if (!programmeId) {
      throw new Error(`Programme not found for code ${m.programmeCode}`);
    }
    const enrolled =
      studentsByProgrammeYear.get(`${String(programmeId)}|${m.yearLevel}`) ?? [];
    await Module.findOneAndUpdate(
      {
        code: m.code,
        programmeId,
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
      },
      {
        $set: {
          name: m.name,
          programmeId,
          yearLevel: m.yearLevel,
          academicYear: ACADEMIC_YEAR,
          semester: SEMESTER,
          lecturerId: lec._id,
          enrolledStudents: enrolled,
          gradingRuleId: rule?._id,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  const totals = {
    users: await User.countDocuments(),
    admins: await User.countDocuments({ role: "admin" }),
    lecturers: await User.countDocuments({ role: "lecturer" }),
    students: await User.countDocuments({ role: "student" }),
    programmes: await Programme.countDocuments(),
    modules: await Module.countDocuments(),
  };

  console.log("\n✓ Seed complete");
  console.log(totals);
  console.log("\nLogin credentials (all use password 'iamco1234' unless changed):");
  console.log(`  Super admin: ${SUPER_ADMIN.email} (no password change required)`);
  console.log(`  Admin:       ${ADMINS[0].email} (must change password on first login)`);
  console.log(`  Lecturer:    ${LECTURERS[0].email} (must change password on first login)`);
  console.log(`  Student:     ${STUDENTS[0].email} (must change password on first login)`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
