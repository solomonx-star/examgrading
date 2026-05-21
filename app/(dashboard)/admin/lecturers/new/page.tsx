import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewLecturerForm } from "./new-lecturer-form";

export default async function NewLecturerPage() {
  await requireAdminScope();
  return (
    <div>
      <PageHeader
        title="New lecturer"
        description={`Default password "iamco1234"; the lecturer must change it on first login.`}
      />
      <NewLecturerForm />
    </div>
  );
}
