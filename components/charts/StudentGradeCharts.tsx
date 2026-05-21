"use client";

import { ApexChart } from "./ApexChart";

export type StudentChartGrade = { grade: string | null };
export type StudentGpaPoint = { label: string; gpa: number };

export function StudentGradeCharts({
  grades,
  gpaTrend,
}: {
  grades: StudentChartGrade[];
  gpaTrend: StudentGpaPoint[];
}) {
  const order = ["A", "B+", "B", "C+", "C", "D+", "D", "F"];
  const counts = new Map<string, number>();
  for (const g of grades) {
    if (!g.grade) continue;
    counts.set(g.grade, (counts.get(g.grade) ?? 0) + 1);
  }
  const buckets = order
    .filter((label) => counts.has(label))
    .map((label) => ({ label, count: counts.get(label) ?? 0 }));
  for (const [label, count] of counts) {
    if (!order.includes(label)) buckets.push({ label, count });
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-body">
          Grade distribution
        </p>
        <p className="mt-1 mb-3 text-sm text-body">
          Across {grades.length} published module
          {grades.length === 1 ? "" : "s"}.
        </p>
        {buckets.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-body">
            No grades yet.
          </div>
        ) : (
          <ApexChart
            type="bar"
            height={280}
            series={[
              { name: "Modules", data: buckets.map((b) => b.count) },
            ]}
            options={{
              chart: { toolbar: { show: false }, fontFamily: "inherit" },
              plotOptions: {
                bar: {
                  borderRadius: 6,
                  columnWidth: "55%",
                  distributed: true,
                },
              },
              colors: [
                "#10b981",
                "#22c55e",
                "#1A56A0",
                "#3b82f6",
                "#F5C518",
                "#f97316",
                "#dc3545",
                "#94a3b8",
              ],
              legend: { show: false },
              dataLabels: { enabled: true },
              grid: { borderColor: "#e2e8f0" },
              xaxis: {
                categories: buckets.map((b) => b.label),
                labels: { style: { colors: "#64748b" } },
              },
              yaxis: {
                labels: {
                  style: { colors: "#64748b" },
                  formatter: (v) => `${Math.round(v)}`,
                },
              },
              tooltip: { theme: "light" },
            }}
          />
        )}
      </div>

      <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-body">
          GPA over time
        </p>
        <p className="mt-1 mb-3 text-sm text-body">
          {gpaTrend.length === 0
            ? "No completed periods yet."
            : "Semester-by-semester GPA from published grades."}
        </p>
        {gpaTrend.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-body">
            No data yet.
          </div>
        ) : (
          <ApexChart
            type="line"
            height={280}
            series={[{ name: "GPA", data: gpaTrend.map((p) => p.gpa) }]}
            options={{
              chart: { toolbar: { show: false }, fontFamily: "inherit" },
              colors: ["#1A56A0"],
              stroke: { curve: "smooth", width: 3 },
              markers: { size: 5 },
              dataLabels: { enabled: false },
              grid: { borderColor: "#e2e8f0" },
              xaxis: {
                categories: gpaTrend.map((p) => p.label),
                labels: { style: { colors: "#64748b" } },
              },
              yaxis: {
                min: 0,
                max: 4,
                tickAmount: 4,
                labels: {
                  style: { colors: "#64748b" },
                  formatter: (v) => v.toFixed(1),
                },
              },
              tooltip: {
                theme: "light",
                y: { formatter: (v) => v.toFixed(2) },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
