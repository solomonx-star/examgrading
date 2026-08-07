import { isPostHogConfigured, loadPostHogReport } from "@/lib/posthog-reporting";
import { PostHogCardContent, PostHogNotConfigured } from "./PostHogCardContent";

export async function PostHogCard() {
  if (!isPostHogConfigured()) return <PostHogNotConfigured />;

  const report = await loadPostHogReport();

  if (!report) {
    return (
      <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm text-center">
        <p className="text-sm text-body">Failed to load PostHog data.</p>
      </div>
    );
  }

  return <PostHogCardContent report={report} />;
}
