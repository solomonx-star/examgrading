"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-body">
      Loading chart…
    </div>
  ),
});

export type ApexChartProps = {
  type:
    | "line"
    | "area"
    | "bar"
    | "pie"
    | "donut"
    | "radialBar"
    | "scatter"
    | "bubble"
    | "heatmap"
    | "candlestick"
    | "boxPlot"
    | "radar"
    | "polarArea"
    | "rangeBar"
    | "rangeArea"
    | "treemap";
  series: ApexOptions["series"];
  options?: ApexOptions;
  height?: number | string;
  width?: number | string;
};

export function ApexChart({
  type,
  series,
  options = {},
  height = 320,
  width = "100%",
}: ApexChartProps) {
  return (
    <ReactApexChart
      type={type}
      series={series as never}
      options={options}
      height={height}
      width={width}
    />
  );
}
