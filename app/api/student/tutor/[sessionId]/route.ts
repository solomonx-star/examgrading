import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { TutorSession } from "@/models/TutorSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CONTEXT_MESSAGES = 20;

function buildSystemPrompt(session: {
  moduleCode: string;
  moduleName: string;
  programmeName: string;
  yearLevel: number;
}): string {
  return `You are an academic study tutor helping a student with ${session.moduleCode} — ${session.moduleName}, a Year ${session.yearLevel} module${session.programmeName ? ` in the ${session.programmeName} programme` : ""} at I AM Community College, Freetown, Sierra Leone.

Your role:
- Explain course concepts clearly and at the right academic level for the year
- Help students understand material and prepare for tests and exams
- Give worked examples where useful
- Be encouraging, concise, and supportive

If a question is unrelated to this module, gently redirect the student. Do not answer questions about other students or internal grades.`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userSession = await auth();
  if (!userSession?.user?.id || userSession.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userMessage =
    typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (userMessage.length > 2000) {
    return NextResponse.json(
      { error: "Message too long (max 2000 characters)" },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 503 },
    );
  }

  await connectDB();
  const tutorSession = await TutorSession.findById(sessionId);
  if (
    !tutorSession ||
    String(tutorSession.student) !== userSession.user.id
  ) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  tutorSession.messages.push({
    role: "user",
    content: userMessage,
    createdAt: new Date(),
  });
  await tutorSession.save();

  const recentMessages = tutorSession.messages.slice(-MAX_CONTEXT_MESSAGES);
  const anthropicMessages = recentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: buildSystemPrompt(tutorSession),
          messages: anthropicMessages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullResponse += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        if (fullResponse) {
          tutorSession.messages.push({
            role: "assistant",
            content: fullResponse,
            createdAt: new Date(),
          });
          await tutorSession.save();
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}
