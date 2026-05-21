import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function LecturerBulkImportPage() {
  const me = await requireAdminScope();
  return (
    <div>
      <PageHeader
        title="Bulk import lecturers"
        description={`Department: ${me.department}. Upload a CSV with columns "name, email" (staffId optional).`}
      />
      <ImportForm />
    </div>
  );
}
