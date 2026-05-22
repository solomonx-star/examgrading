// Server-only: pulls reporting data from the Google Analytics Data API.
//
// Setup:
//   1) Create a GA4 property at analytics.google.com and grab its numeric
//      Property ID (Admin → Property Settings).
//   2) In Google Cloud, create a service account and a JSON key. In the GA
//      property, add the service-account email as a Viewer (Admin → Account
//      Access Management).
//   3) Set env vars:
//        GA_PROPERTY_ID=123456789
//        GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account", ...}'
//      (the JSON file content, single-line, as the value).
import "server-only";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type GAOverview = {
  activeUsers: number;
  sessions: number;
  pageViews: number;
  avgEngagementSec: number;
};

export type GATopPage = {
  path: string;
  title: string;
  views: number;
};

export type GARealtime = {
  activeUsers: number;
};

export type GAReport = {
  overview: GAOverview;
  topPages: GATopPage[];
  realtime: GARealtime;
  range: { startDate: string; endDate: string };
};

let cachedClient: BetaAnalyticsDataClient | null = null;

function getCreds(): object | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as object;
  } catch {
    return null;
  }
}

function getClient(): BetaAnalyticsDataClient | null {
  if (cachedClient) return cachedClient;
  const credentials = getCreds();
  if (!credentials) return null;
  cachedClient = new BetaAnalyticsDataClient({ credentials });
  return cachedClient;
}

export function isGAConfigured(): boolean {
  return Boolean(
    process.env.GA_PROPERTY_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  );
}

export async function loadGAReport(): Promise<GAReport | null> {
  const propertyId = process.env.GA_PROPERTY_ID;
  const client = getClient();
  if (!propertyId || !client) return null;

  const property = `properties/${propertyId}`;
  const range = { startDate: "7daysAgo", endDate: "today" };

  const [overviewResp, topPagesResp, realtimeResp] = await Promise.all([
    client.runReport({
      property,
      dateRanges: [range],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "userEngagementDuration" },
      ],
    }),
    client.runReport({
      property,
      dateRanges: [range],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [
        { metric: { metricName: "screenPageViews" }, desc: true },
      ],
      limit: 5,
    }),
    client.runRealtimeReport({
      property,
      metrics: [{ name: "activeUsers" }],
    }),
  ]);

  const row = overviewResp[0]?.rows?.[0]?.metricValues ?? [];
  const activeUsers = Number(row[0]?.value ?? 0);
  const sessions = Number(row[1]?.value ?? 0);
  const pageViews = Number(row[2]?.value ?? 0);
  const engagement = Number(row[3]?.value ?? 0);
  const avgEngagementSec = activeUsers > 0 ? engagement / activeUsers : 0;

  const topPages: GATopPage[] = (topPagesResp[0]?.rows ?? []).map((r) => ({
    path: r.dimensionValues?.[0]?.value ?? "",
    title: r.dimensionValues?.[1]?.value ?? "",
    views: Number(r.metricValues?.[0]?.value ?? 0),
  }));

  const realtimeActive = Number(
    realtimeResp[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0,
  );

  return {
    overview: { activeUsers, sessions, pageViews, avgEngagementSec },
    topPages,
    realtime: { activeUsers: realtimeActive },
    range,
  };
}
