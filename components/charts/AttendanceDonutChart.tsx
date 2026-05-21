"use client";

import { ApexChart } from "./ApexChart";

export function AttendanceDonutChart({
  present,
  absent,
  late,
}: {
  present: number;
  absent: number;
  late: number;
}) {
  const total = present + absent + late;

  if (total === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-body">
        No attendance recorded in this range.
      </div>
    );
  }

  return (
    <ApexChart
      type="donut"
      height={300}
      series={[present, absent, late]}
      options={{
        chart: { fontFamily: "inherit" },
        labels: ["Present", "Absent", "Late"],
        colors: ["#10b981", "#dc3545", "#F5C518"],
        legend: {
          position: "bottom",
          labels: { colors: "#64748b" },
        },
        dataLabels: {
          formatter: (val) =>
            typeof val === "number" ? `${val.toFixed(1)}%` : `${val}`,
        },
        plotOptions: {
          pie: {
            donut: {
              labels: {
                show: true,
                total: {
                  show: true,
                  label: "Sessions",
                  formatter: () => `${total}`,
                },
              },
            },
          },
        },
        tooltip: { theme: "light" },
      }}
    />
  );
}
