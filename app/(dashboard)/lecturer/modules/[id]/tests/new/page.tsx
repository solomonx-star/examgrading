import { requireLecturerCourse } from "@/lib/lecturer-course";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateTestForm } from "./create-test-form";

export const dynamic = "force-dynamic";

export default async function NewTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { course: mod } = await requireLecturerCourse(id);

  return (
    <div>
      <PageHeader
        title="Create test"
        description={`${mod.code} — ${mod.name}`}
        secondaryAction={{
          href: `/lecturer/modules/${id}/tests`,
          label: "← Back to tests",
        }}
      />
      <CreateTestForm courseId={id} />
    </div>
  );
}
