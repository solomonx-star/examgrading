import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { PageHeader } from "@/components/ui/PageHeader";
import { EditAdminForm } from "./edit-admin-form";

export const dynamic = "force-dynamic";

export default async function EditAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const admin = await User.findOne({ _id: id, role: "admin" }).lean();
  if (!admin) notFound();

  return (
    <div>
      <PageHeader
        title={admin.name}
        description={`Admin · ${admin.email}`}
      />
      <EditAdminForm
        id={String(admin._id)}
        defaults={{
          name: admin.name,
          email: admin.email,
          department: admin.department ?? "",
          staffId: admin.staffId ?? "",
          isActive: admin.isActive,
          mustChangePassword: admin.mustChangePassword,
        }}
      />
    </div>
  );
}
