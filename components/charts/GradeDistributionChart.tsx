"use client";

import { ApexChart } from "./ApexChart";

export type GradeBucket = { grade: string; count: number };

export function GradeDistributionChart({
  buckets,
}: {
  buckets: GradeBucket[];
}) {
  return (
    <ApexChart
      type="bar"
      height={300}
      series={[{ name: "Students", data: buckets.map((b) => b.count) }]}
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
        dataLabels: { enabled: true },
        legend: { show: false },
        grid: { borderColor: "#e2e8f0" },
        xaxis: {
          categories: buckets.map((b) => b.grade),
          title: { text: "Grade", style: { color: "#64748b" } },
          labels: { style: { colors: "#64748b" } },
        },
        yaxis: {
          title: { text: "Students", style: { color: "#64748b" } },
          labels: {
            style: { colors: "#64748b" },
            formatter: (v) => `${Math.round(v)}`,
          },
        },
        tooltip: { theme: "light" },
      }}
    />
  );
}
