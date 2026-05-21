"use client";

import { ApexChart } from "./ApexChart";

export function PlatformSnapshotChart({
  students,
  lecturers,
  programmes,
  modules,
}: {
  students: number;
  lecturers: number;
  programmes: number;
  modules: number;
}) {
  return (
    <ApexChart
      type="bar"
      height={280}
      series={[
        {
          name: "Count",
          data: [students, lecturers, programmes, modules],
        },
      ]}
      options={{
        chart: { toolbar: { show: false }, fontFamily: "inherit" },
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 6,
            distributed: true,
            barHeight: "55%",
          },
        },
        colors: ["#1A56A0", "#10b981", "#F5C518", "#dc3545"],
        dataLabels: {
          enabled: true,
          style: { fontSize: "12px", colors: ["#fff"] },
        },
        legend: { show: false },
        grid: { borderColor: "#e2e8f0" },
        xaxis: {
          categories: ["Students", "Lecturers", "Programmes", "Modules"],
          labels: { style: { colors: "#64748b" } },
        },
        yaxis: { labels: { style: { colors: "#64748b" } } },
        tooltip: { theme: "light" },
      }}
    />
  );
}
