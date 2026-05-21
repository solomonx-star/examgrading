import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewProgrammeForm } from "./new-programme-form";

export default async function NewProgrammePage() {
  await requireAdminScope();
  return (
    <div>
      <PageHeader
        title="New programme"
        description="Programme codes are uppercase and globally unique (e.g. BSCCS)."
      />
      <NewProgrammeForm />
    </div>
  );
}
