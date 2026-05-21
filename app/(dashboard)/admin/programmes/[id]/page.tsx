import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Programme } from "@/models/Programme";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { EditProgrammeForm } from "./edit-programme-form";

export const dynamic = "force-dynamic";

export default async function EditProgrammePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminScope();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const programme = await Programme.findOne({ _id: id }).lean();
  if (!programme) notFound();

  return (
    <div>
      <PageHeader
        title={programme.name}
        description={`Code: ${programme.code}`}
      />
      <EditProgrammeForm
        id={String(programme._id)}
        defaults={{
          name: programme.name,
          code: programme.code,
          isActive: programme.isActive,
        }}
      />
    </div>
  );
}
