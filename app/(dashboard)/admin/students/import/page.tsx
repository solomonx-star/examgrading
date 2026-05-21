import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function StudentBulkImportPage() {
  await requireAdminScope();
  return (
    <div>
      <PageHeader
        title="Bulk import students"
        description={`Upload a CSV with columns "name, email, course".`}
      />
      <ImportForm />
    </div>
  );
}
