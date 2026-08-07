import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Test } from "@/models/Test";
import { StudyPlan } from "@/models/StudyPlan";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { getBalance } from "@/lib/ai-credits-service";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudyPlanForm } from "./study-plan-form";
import { StudyPlanView } from "./study-plan-view";

export const dynamic = "force-dynamic";

const FREE_REGEN_HOURS = 24;

export default async function StudyPlanPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const meOid = new mongoose.Types.ObjectId(me.userId);
  const now = new Date();

  const [balance, latestPlan, enrolledCourses] = await Promise.all([
    getBalance(me.userId),
    StudyPlan.findOne({ studentId: meOid })
      .sort({ generatedAt: -1 })
      .lean(),
    Course.find({ enrolledStudents: meOid })
      .select("_id code name")
      .lean(),
  ]);

  const courseIds = enrolledCourses.map((c) => c._id);
  const upcomingTests = await Test.find({
    courseId: { $in: courseIds },
    isPublished: true,
    endsAt: { $gte: now },
  })
    .select("courseId title endsAt")
    .sort({ endsAt: 1 })
    .limit(5)
    .lean();

  const courseMap = new Map(enrolledCourses.map((c) => [String(c._id), c]));
  const upcomingTestSummaries = upcomingTests.map((t) => ({
    title: t.title,
    moduleCode: courseMap.get(String(t.courseId))?.code ?? "Unknown",
    date: new Date(t.endsAt).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }),
  }));

  const isFreeRegen =
    !!latestPlan &&
    latestPlan.generatedAt.getTime() >
      now.getTime() - FREE_REGEN_HOURS * 60 * 60 * 1000;

  return (
    <div>
      <PageHeader
        title="AI Study Plan"
        description="Personalised day-by-day schedule based on your upcoming tests and grades."
      />

      <div className="mb-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              AI credit balance:{" "}
              <span className="font-bold">
                {balance} credit{balance === 1 ? "" : "s"}
              </span>
            </p>
            <p className="mt-1 text-xs text-body">
              Generating a study plan costs <strong>5 credits</strong>.
              {isFreeRegen
                ? " Regeneration within 24 hours of your last plan is free."
                : ""}
            </p>
          </div>
          {isFreeRegen ? (
            <span className="rounded-full bg-meta-3/10 px-3 py-1 text-xs font-medium text-meta-3">
              Free regeneration available (within 24h)
            </span>
          ) : null}
        </div>

        {upcomingTestSummaries.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-body">
              Upcoming tests (pre-loaded)
            </p>
            <ul className="space-y-1">
              {upcomingTestSummaries.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  <strong>{t.moduleCode}</strong> — {t.title} —{" "}
                  <span className="text-body">{t.date}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-body">
            No upcoming tests found. The plan will cover your enrolled modules.
          </p>
        )}
      </div>

      <StudyPlanForm balance={balance} isFreeRegen={isFreeRegen} />

      {latestPlan ? (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Your study plan
            </h2>
            <p className="text-xs text-body">
              Generated{" "}
              {latestPlan.generatedAt.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <StudyPlanView plan={latestPlan.plan} />
        </div>
      ) : null}
    </div>
  );
}
