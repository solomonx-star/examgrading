import { connectDB } from "@/lib/db";
import { Programme } from "@/models/Programme";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewStudentForm } from "./new-student-form";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  await requireAdminScope();
  await connectDB();
  const programmes = await Programme.find({ isActive: true })
    .select("name code")
    .sort({ name: 1 })
    .lean();

  return (
    <div>
      <PageHeader
        title="New student"
        description="ID is generated automatically (IAMCO-YYYY-NNNN)."
      />
      <NewStudentForm
        programmes={programmes.map((p) => ({
          id: String(p._id),
          name: p.name as string,
          code: p.code as string,
        }))}
      />
    </div>
  );
}
