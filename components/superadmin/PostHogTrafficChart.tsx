"use client";

import { ApexChart } from "@/components/charts/ApexChart";
import { PostHogChartData } from "@/lib/posthog-reporting";
import type { ApexOptions } from "apexcharts";

export function PostHogTrafficChart({ data }: { data: PostHogChartData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="mt-6 flex h-[300px] items-center justify-center rounded-lg border border-dashed border-stroke bg-whiter text-sm text-body">
        No traffic data yet for the last 7 days.
      </div>
    );
  }

  const categories = data.map((d) => {
    const date = new Date(d.date);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  });

  const series = [
    {
      name: "Page Views",
      data: data.map((d) => d.views),
    },
    {
      name: "Unique Users",
      data: data.map((d) => d.users),
    },
  ];

  const options: ApexOptions = {
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#3C50E0", "#80CAEE"],
    chart: {
      fontFamily: "Satoshi, sans-serif",
      height: 335,
      type: "area",
      dropShadow: {
        enabled: true,
        color: "#623212",
        top: 10,
        blur: 4,
        left: 0,
        opacity: 0.1,
      },
      toolbar: {
        show: false,
      },
    },
    responsive: [
      {
        breakpoint: 1024,
        options: {
          chart: {
            height: 300,
          },
        },
      },
    ],
    stroke: {
      width: [2, 2],
      curve: "smooth",
    },
    grid: {
      xaxis: {
        lines: {
          show: true,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    markers: {
      size: 4,
      colors: "#fff",
      strokeColors: ["#3C50E0", "#80CAEE"],
      strokeWidth: 3,
      strokeOpacity: 0.9,
      strokeDashArray: 0,
      fillOpacity: 1,
      discrete: [],
      hover: {
        size: undefined,
        sizeOffset: 5,
      },
    },
    xaxis: {
      type: "category",
      categories: categories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      title: {
        style: {
          fontSize: "0px",
        },
      },
      min: 0,
    },
  };

  return (
    <div className="mt-6 -ml-5">
      <ApexChart type="area" series={series} options={options} height={300} />
    </div>
  );
}
