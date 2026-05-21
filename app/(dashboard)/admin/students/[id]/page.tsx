import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { EditStudentForm } from "./edit-student-form";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminScope();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const student = await User.findOne({
    _id: id,
    role: "student",
  }).lean();
  if (!student) notFound();

  const programmes = await Programme.find({ isActive: true })
    .select("name code")
    .sort({ name: 1 })
    .lean();

  return (
    <div>
      <PageHeader
        title={student.name}
        description={`Student ID ${student.studentId ?? "—"} · ${student.email}`}
      />
      <EditStudentForm
        id={String(student._id)}
        defaults={{
          name: student.name,
          email: student.email,
          programmeId: student.programmeId ? String(student.programmeId) : "",
          yearLevel: student.yearLevel ?? 1,
          isActive: student.isActive,
          mustChangePassword: student.mustChangePassword,
        }}
        programmes={programmes.map((p) => ({
          id: String(p._id),
          name: p.name as string,
          code: p.code as string,
        }))}
      />
    </div>
  );
}
