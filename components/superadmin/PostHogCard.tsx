import {
  Users,
  Eye,
  Activity,
  AlertCircle,
  MousePointer2,
  Monitor,
  Globe,
  Clock,
  Navigation,
  Timer,
} from "lucide-react";
import { isPostHogConfigured, loadPostHogReport } from "@/lib/posthog-reporting";
import { PostHogTrafficChart } from "./PostHogTrafficChart";

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function NotConfigured() {
  return (
    <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-body" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-body">
          PostHog Analytics
        </p>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-stroke bg-whiter p-3 text-sm text-body">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-meta-1" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Not configured</p>
          <p className="mt-1">
            Set <code className="font-mono text-xs">POSTHOG_PERSONAL_API_KEY</code> and{" "}
            <code className="font-mono text-xs">POSTHOG_PROJECT_ID</code> in your environment.
          </p>
        </div>
      </div>
    </div>
  );
}

export async function PostHogCard() {
  if (!isPostHogConfigured()) return <NotConfigured />;

  const report = await loadPostHogReport();

  if (!report) {
    return (
      <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm text-center">
        <p className="text-sm text-body">Failed to load PostHog data.</p>
      </div>
    );
  }

  const { overview, topPages, browsers, devices, recentEvents } = report;

  return (
    <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-lg font-bold text-foreground">PostHog Analytics</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-meta-3 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-meta-3"></span>
            </span>
            <span className="text-sm font-semibold text-meta-3">
              {overview.onlineUsers} online now
            </span>
          </div>
          <div className="rounded-full bg-meta-3/10 px-3 py-1 text-xs font-medium text-meta-3">
            Last 7 days
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Active Users"
          value={overview.activeUsers.toLocaleString()}
          Icon={Users}
        />
        <Metric
          label="Page Views"
          value={overview.pageViews.toLocaleString()}
          Icon={Eye}
        />
        <Metric
          label="Sessions"
          value={overview.sessions.toLocaleString()}
          Icon={Navigation}
        />
        <Metric
          label="Avg. Duration"
          value={formatDuration(overview.avgSessionDuration)}
          Icon={Timer}
        />
        <Metric
          label="Views/User"
          value={overview.avgEngagement.toFixed(1)}
          Icon={MousePointer2}
        />
      </div>

      {/* Traffic Chart */}
      <PostHogTrafficChart data={report.chartData} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Top Pages */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-body">
            <Globe className="h-4 w-4" /> Top Pages
          </h3>
          <ul className="mt-4 space-y-3">
            {topPages.map((p, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="truncate text-sm font-medium text-foreground">{p.path}</span>
                <span className="text-sm font-semibold text-primary">{p.views}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Live Activity */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-body">
            <Clock className="h-4 w-4" /> Live Activity
          </h3>
          <ul className="mt-4 space-y-3">
            {recentEvents.length === 0 ? (
                <li className="text-sm text-body">No recent activity.</li>
            ) : (
                recentEvents.map((e, i) => (
                <li key={i} className="flex items-center justify-between border-b border-stroke pb-2 last:border-0">
                    <span className="text-sm font-medium text-foreground capitalize">
                        {e.event.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-body">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </li>
                ))
            )}
          </ul>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="mt-8 border-t border-stroke pt-6">
        <div className="grid grid-cols-2 gap-8">
            <div>
                <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase text-body">
                    <Monitor className="h-3 w-3" /> Devices
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                    {devices.map((d, i) => (
                        <div key={i} className="rounded-lg bg-whiter px-2 py-1 text-xs">
                            <span className="font-medium">{d.label}:</span> {d.count}
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase text-body">
                    <Globe className="h-3 w-3" /> Browsers
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                    {browsers.map((b, i) => (
                        <div key={i} className="rounded-lg bg-whiter px-2 py-1 text-xs">
                            <span className="font-medium">{b.label}:</span> {b.count}
                        </div>
                    ))}
                </div>
            </div>
        </div>
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
  Icon: any;
}) {
  return (
    <div className="rounded-2xl border border-stroke bg-whiter p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-body">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
