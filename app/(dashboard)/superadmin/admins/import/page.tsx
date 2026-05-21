import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function AdminBulkImportPage() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  return (
    <div>
      <PageHeader
        title="Bulk import admins"
        description={`Upload a CSV with columns "name, email" (staffId optional).`}
      />
      <ImportForm />
    </div>
  );
}
