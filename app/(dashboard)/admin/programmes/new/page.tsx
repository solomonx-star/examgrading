import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewProgrammeForm } from "./new-programme-form";

export default async function NewProgrammePage() {
  const me = await requireAdminScope();
  return (
    <div>
      <PageHeader
        title="New programme"
        description={`Department: ${me.department}. Programme codes are uppercase and globally unique (e.g. BSCCS).`}
      />
      <NewProgrammeForm />
    </div>
  );
}
