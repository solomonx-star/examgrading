import {
  BarChart3,
  Users,
  Eye,
  Clock,
  TrendingUp,
  Activity,
  AlertCircle,
} from "lucide-react";
import { isGAConfigured, loadGAReport } from "@/lib/ga-reporting";

function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function NotConfigured() {
  return (
    <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-body" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-body">
          Google Analytics
        </p>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-stroke bg-whiter p-3 text-sm text-body">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-meta-1" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Not configured</p>
          <p className="mt-1">
            Set <code className="font-mono text-xs">GA_PROPERTY_ID</code> and{" "}
            <code className="font-mono text-xs">
              GOOGLE_APPLICATION_CREDENTIALS_JSON
            </code>{" "}
            (and <code className="font-mono text-xs">NEXT_PUBLIC_GA_MEASUREMENT_ID</code>{" "}
            for client tracking) in your environment. See{" "}
            <code className="font-mono text-xs">lib/ga-reporting.ts</code> for
            the full setup steps.
          </p>
        </div>
      </div>
    </div>
  );
}

async function GAReportInner() {
  let report;
  try {
    report = await loadGAReport();
  } catch (err) {
    return (
      <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-body" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Google Analytics
          </p>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-meta-1/30 bg-meta-1/10 p-3 text-sm text-meta-1">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Couldn&apos;t reach Google Analytics:{" "}
            {err instanceof Error ? err.message : "unknown error"}
          </p>
        </div>
      </div>
    );
  }
  if (!report) return <NotConfigured />;

  const { overview, topPages, realtime } = report;

  return (
    <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-body" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Google Analytics
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Activity className="h-3.5 w-3.5 text-meta-3" aria-hidden />
          <span className="font-semibold text-foreground">
            {realtime.activeUsers}
          </span>
          <span className="text-body">live</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-body">Last 7 days</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          label="Active users"
          value={overview.activeUsers.toLocaleString()}
          Icon={Users}
        />
        <Metric
          label="Sessions"
          value={overview.sessions.toLocaleString()}
          Icon={TrendingUp}
        />
        <Metric
          label="Page views"
          value={overview.pageViews.toLocaleString()}
          Icon={Eye}
        />
        <Metric
          label="Avg. engagement"
          value={formatDuration(overview.avgEngagementSec)}
          Icon={Clock}
        />
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-body">
          Top pages
        </p>
        <ul className="mt-2 divide-y divide-stroke">
          {topPages.length === 0 ? (
            <li className="py-2 text-sm text-body">No data yet.</li>
          ) : (
            topPages.map((p, i) => (
              <li
                key={`${p.path}-${i}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.title || p.path || "(untitled)"}
                  </p>
                  <p className="truncate font-mono text-[11px] text-body">
                    {p.path || "/"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {p.views.toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-stroke bg-whiter p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-body">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export async function GoogleAnalyticsCard() {
  if (!isGAConfigured()) return <NotConfigured />;
  return <GAReportInner />;
}
