import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewAdminForm } from "./new-admin-form";

export default async function NewAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  return (
    <div>
      <PageHeader
        title="New admin"
        description={`New accounts use the default password "iamco1234" and must change it on first login.`}
      />
      <NewAdminForm />
    </div>
  );
}
