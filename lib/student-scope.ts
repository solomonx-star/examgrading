import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AccessPayment } from "@/models/AccessPayment";

export type StudentScope = {
  userId: string;
  name: string;
  email: string;
  studentId: string | null;
  department: string | null;
  programmeId: string | null;
  programmeName: string | null;
  programmeCode: string | null;
  yearLevel: number | null;
};

export async function requireStudentScope(): Promise<StudentScope> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "student") redirect("/");

  await connectDB();
  const me = await User.findById(session.user.id)
    .select("name email studentId department programmeId yearLevel isActive")
    .lean();
  if (!me || !me.isActive) redirect("/login");

  let programmeName: string | null = null;
  let programmeCode: string | null = null;
  if (me.programmeId) {
    const p = await Programme.findById(me.programmeId)
      .select("name code")
      .lean();
    programmeName = p?.name ?? null;
    programmeCode = p?.code ?? null;
  }

  return {
    userId: session.user.id,
    name: me.name,
    email: me.email,
    studentId: me.studentId ?? null,
    department: me.department ?? null,
    programmeId: me.programmeId ? String(me.programmeId) : null,
    programmeName,
    programmeCode,
    yearLevel: me.yearLevel ?? null,
  };
}

/**
 * Same as `requireStudentScope` but additionally enforces that the student
 * has paid the access fee for the current period. Students without active
 * access are bounced to `/student/access`.
 *
 * If no current period is set, or the period's accessFee is 0, access is
 * considered free and the gate is open.
 */
export async function requireActiveStudentAccess(): Promise<StudentScope> {
  const scope = await requireStudentScope();
  await connectDB();
  const period = await AcademicPeriod.findOne({ isCurrent: true })
    .select("accessFee")
    .lean();
  // No current period or free access → don't block.
  if (!period || !period.accessFee || period.accessFee <= 0) return scope;
  const paid = await AccessPayment.exists({
    student: scope.userId,
    period: period._id,
    status: "completed",
  });
  if (!paid) redirect("/student/access");
  return scope;
}
