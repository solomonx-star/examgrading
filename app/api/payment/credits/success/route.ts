import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const base = new URL(request.url).origin;
  return NextResponse.redirect(`${base}/student/credits/success`, { status: 303 });
}

export async function GET(request: Request) {
  const base = new URL(request.url).origin;
  return NextResponse.redirect(`${base}/student/credits/success`, { status: 302 });
}
