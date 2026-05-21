import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Module } from "@/models/Module";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { EditLecturerForm } from "./edit-lecturer-form";

export const dynamic = "force-dynamic";

export default async function EditLecturerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireAdminScope();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const lecturer = await User.findOne({
    _id: id,
    role: "lecturer",
    department: me.department,
  }).lean();
  if (!lecturer) notFound();

  const modules = await Module.find({ lecturerId: id, isActive: true })
    .select("code name yearLevel academicYear semester")
    .sort({ code: 1 })
    .lean();

  return (
    <div>
      <PageHeader title={lecturer.name} description={lecturer.email} />
      <EditLecturerForm
        id={String(lecturer._id)}
        defaults={{
          name: lecturer.name,
          email: lecturer.email,
          staffId: lecturer.staffId ?? "",
          isActive: lecturer.isActive,
          mustChangePassword: lecturer.mustChangePassword,
        }}
      />

      <div className="mt-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Assigned modules
        </h2>
        {modules.length === 0 ? (
          <p className="text-sm text-body">No modules assigned.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {modules.map((m) => (
              <li key={String(m._id)} className="text-body">
                <span className="font-mono text-xs text-foreground">
                  {m.code}
                </span>
                <span className="mx-2">·</span>
                {m.name}
                <span className="ml-2 text-xs text-body">
                  (Year {m.yearLevel} · {m.academicYear} {m.semester})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
