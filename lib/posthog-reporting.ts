import "server-only";

export type PostHogOverview = {
  activeUsers: number;
  pageViews: number;
  avgEngagement: number;
  onlineUsers: number;
  sessions: number;
  avgSessionDuration: number; // in seconds
};

export type PostHogTopPage = {
  path: string;
  views: number;
};

export type PostHogBreakdown = {
  label: string;
  count: number;
};

export type PostHogRecentEvent = {
  event: string;
  timestamp: string;
};

export type PostHogChartData = {
  date: string;
  views: number;
  users: number;
};

export type PostHogReport = {
  overview: PostHogOverview;
  topPages: PostHogTopPage[];
  browsers: PostHogBreakdown[];
  devices: PostHogBreakdown[];
  recentEvents: PostHogRecentEvent[];
  chartData: PostHogChartData[];
};

const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

function getApiHost() {
  const publicHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "";
  if (publicHost.includes("eu")) {
    return "https://eu.posthog.com";
  }
  return "https://us.posthog.com";
}

export function isPostHogConfigured(): boolean {
  return Boolean(API_KEY && PROJECT_ID);
}

async function posthogQuery(hogql: string) {
  const apiHost = getApiHost();
  const url = `${apiHost}/api/projects/${PROJECT_ID}/query/`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query: hogql,
      },
    }),
    next: { revalidate: 60 }, 
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error(`PostHog Query Error [${res.status}]:`, errorBody);
    throw new Error(`PostHog API error: ${res.statusText}`);
  }

  return res.json();
}

export async function loadPostHogReport(): Promise<PostHogReport | null> {
  if (!isPostHogConfigured()) return null;

  try {
    const queries = {
      overview: `
        SELECT
          count() AS page_views,
          count(DISTINCT distinct_id) AS unique_users,
          if(count(DISTINCT distinct_id) = 0, 0, count() / count(DISTINCT distinct_id)) AS avg_views
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= now() - INTERVAL 7 DAY
      `,
      sessions: `
        SELECT
          count() AS total_sessions,
          avg(dateDiff('second', min_ts, max_ts)) AS avg_duration
        FROM (
          SELECT
            properties.$session_id AS session_id,
            min(timestamp) AS min_ts,
            max(timestamp) AS max_ts
          FROM events
          WHERE timestamp >= now() - INTERVAL 7 DAY
            AND properties.$session_id IS NOT NULL
            AND properties.$session_id != ''
          GROUP BY properties.$session_id
        )
      `,
      online: `
        SELECT count(DISTINCT distinct_id)
        FROM events
        WHERE timestamp >= now() - INTERVAL 5 MINUTE
      `,
      topPages: `
        SELECT properties.$pathname as path, count() as views
        FROM events 
        WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY path ORDER BY views DESC LIMIT 5
      `,
      browsers: `
        SELECT properties.$browser AS browser, count() AS count
        FROM events
        WHERE timestamp >= now() - INTERVAL 7 DAY
          AND properties.$browser IS NOT NULL
          AND properties.$browser != ''
        GROUP BY properties.$browser
        ORDER BY count DESC LIMIT 3
      `,
      devices: `
        SELECT properties.$device_type AS device, count() AS count
        FROM events
        WHERE timestamp >= now() - INTERVAL 7 DAY
          AND properties.$device_type IS NOT NULL
          AND properties.$device_type != ''
        GROUP BY properties.$device_type
        ORDER BY count DESC LIMIT 3
      `,
      recentEvents: `
        SELECT event, timestamp
        FROM events 
        WHERE event NOT IN ('$pageview', '$feature_flag_called', '$autocapture', '$identify', '$set')
        ORDER BY timestamp DESC LIMIT 5
      `,
      chart: `
        SELECT 
          toStartOfDay(timestamp) as day,
          count() as views,
          count(DISTINCT distinct_id) as users
        FROM events 
        WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY day
        ORDER BY day ASC
      `
    };

    const [overviewRes, sessionRes, onlineRes, topPagesRes, browsersRes, devicesRes, recentRes, chartRes] = await Promise.all([
      posthogQuery(queries.overview),
      posthogQuery(queries.sessions),
      posthogQuery(queries.online),
      posthogQuery(queries.topPages),
      posthogQuery(queries.browsers),
      posthogQuery(queries.devices),
      posthogQuery(queries.recentEvents),
      posthogQuery(queries.chart),
    ]);

    const overview = overviewRes.results?.[0] || [0, 0, 0];
    const sessionData = sessionRes.results?.[0] || [0, 0];
    const onlineUsers = onlineRes.results?.[0]?.[0] || 0;
    
    return {
      overview: {
        pageViews: Number(overview[0]),
        activeUsers: Number(overview[1]),
        avgEngagement: Number(overview[2] || 0),
        onlineUsers: Number(onlineUsers),
        sessions: Number(sessionData[0]),
        avgSessionDuration: Number(sessionData[1] || 0),
      },
      topPages: (topPagesRes.results || []).map((row: any) => ({
        path: row[0] || "/",
        views: row[1] || 0,
      })),
      browsers: (browsersRes.results || []).map((row: any) => ({
        label: row[0] || "Unknown",
        count: row[1] || 0,
      })),
      devices: (devicesRes.results || []).map((row: any) => ({
        label: row[0] || "Desktop",
        count: row[1] || 0,
      })),
      recentEvents: (recentRes.results || []).map((row: any) => ({
        event: row[0],
        timestamp: row[1],
      })),
      chartData: (chartRes.results || []).map((row: any) => ({
        date: row[0],
        views: Number(row[1]),
        users: Number(row[2]),
      })),
    };
  } catch (error) {
    console.error("Failed to load PostHog report:", error);
    return null;
  }
}
