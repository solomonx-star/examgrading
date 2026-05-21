import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { GradingRule } from "@/models/GradingRule";
import { Course } from "@/models/Course";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function GradingRulesPage() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  await connectDB();
  const rules = await GradingRule.find().sort({ createdAt: 1 }).lean();
  const courses = await Course.find({
    gradingRuleId: { $in: rules.map((r) => r._id) },
  })
    .select("code name gradingRuleId")
    .lean();

  const usageByRule = new Map<string, number>();
  for (const c of courses) {
    const k = String(c.gradingRuleId);
    usageByRule.set(k, (usageByRule.get(k) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Grading rules"
        description="Global default + per-course overrides. CA + exam weights must total 100."
      />

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">CA / Exam</th>
              <th className="px-4 py-3">Attendance min</th>
              <th className="px-4 py-3">Courses</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {rules.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No grading rules. Run the seed to create the default.
                </td>
              </tr>
            ) : (
              rules.map((r) => {
                const id = String(r._id);
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {r.courseId ? "Course-specific" : "Global"}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {r.caWeight}% / {r.examWeight}%
                    </td>
                    <td className="px-4 py-3 text-body">
                      {r.attendanceThreshold}%
                    </td>
                    <td className="px-4 py-3 text-body">
                      {usageByRule.get(id) ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/superadmin/grading-rules/${id}`}
                        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
