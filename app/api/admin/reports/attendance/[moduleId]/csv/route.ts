import { NextResponse } from "next/server";
import { requireAdminScope } from "@/lib/admin-scope";
import {
  loadAttendanceReport,
  loadCourseForDepartment,
} from "@/lib/report-data";
import { safeFilename, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseYMD(value: string | null): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ moduleId: string }> },
) {
  const me = await requireAdminScope();
  const { moduleId } = await ctx.params;
  const mod = await loadCourseForDepartment(moduleId, me.department);
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const from = parseYMD(url.searchParams.get("from"));
  const toDate = parseYMD(url.searchParams.get("to"));
  const toEod = toDate
    ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1)
    : undefined;

  const { log } = await loadAttendanceReport(moduleId, from, toEod);

  const headers = ["Date", "Student ID", "Name", "Status", "Notes"];
  const data = log.map((r) => ({
    Date: r.date.toISOString().slice(0, 10),
    "Student ID": r.studentCode,
    Name: r.name,
    Status: r.status,
    Notes: r.notes ?? "",
  }));

  const csv = toCsv(data, headers);
  const range =
    url.searchParams.get("from") || url.searchParams.get("to")
      ? `-${url.searchParams.get("from") ?? "start"}-to-${url.searchParams.get("to") ?? "end"}`
      : "";
  const filename = `${safeFilename(mod.code)}-attendance${range}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
