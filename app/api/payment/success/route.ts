import { NextResponse } from "next/server";

// Monime redirects the browser here after a successful payment (POST per the
// hosted-checkout spec; GET fallback to support manual refresh / direct hits).
// We bounce to the student-facing success page as a GET so it can run the
// verify-by-session flow.
export async function POST(request: Request) {
  const base = new URL(request.url).origin;
  return NextResponse.redirect(`${base}/student/access/success`, {
    status: 303,
  });
}

export async function GET(request: Request) {
  const base = new URL(request.url).origin;
  return NextResponse.redirect(`${base}/student/access/success`, {
    status: 302,
  });
}
