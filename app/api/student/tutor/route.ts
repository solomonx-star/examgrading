import mongoose from "mongoose";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { User } from "@/models/User";
import { TutorSession } from "@/models/TutorSession";
import { deductCredits, getBalance } from "@/lib/ai-credits-service";

const TUTOR_CREDIT_COST = 1;
const MAX_HISTORY = 20; // messages to include as context

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { courseId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { courseId, message } = body;
  if (
    !courseId ||
    !mongoose.Types.ObjectId.isValid(courseId) ||
    !message?.trim()
  ) {
    return NextResponse.json({ error: "Missing courseId or message." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured." }, { status: 503 });
  }

  await connectDB();

  const studentId = session.user.id;
  const studentOid = new mongoose.Types.ObjectId(studentId);
  const courseOid = new mongoose.Types.ObjectId(courseId);

  // Verify student is enrolled
  const [student, mod] = await Promise.all([
    User.findOne({ _id: studentOid, role: "student", isActive: true })
      .select("name")
      .lean(),
    Course.findOne({ _id: courseOid, enrolledStudents: studentOid })
      .select("code name yearLevel")
      .lean(),
  ]);

  if (!student || !mod) {
    return NextResponse.json({ error: "Module not found or not enrolled." }, { status: 403 });
  }

  // Check balance
  const balance = await getBalance(studentId);
  if (balance < TUTOR_CREDIT_COST) {
    return NextResponse.json(
      { error: `Insufficient credits. You need ${TUTOR_CREDIT_COST} credit to send a message.` },
      { status: 402 },
    );
  }

  // Load or create tutor session (one per student per course)
  let tutorSession = await TutorSession.findOne({
    studentId: studentOid,
    courseId: courseOid,
  });
  if (!tutorSession) {
    tutorSession = await TutorSession.create({
      studentId: studentOid,
      courseId: courseOid,
      messages: [],
    });
  }

  // Build conversation history for Claude (last MAX_HISTORY messages)
  const history = tutorSession.messages.slice(-MAX_HISTORY);
  const claudeMessages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message.trim() },
  ];

  const systemPrompt = `You are an AI tutor helping a student study ${mod.code} — ${mod.name}, a Year ${mod.yearLevel} university module at IAM CO College, Sierra Leone.

Your role:
- Explain concepts clearly and at the right academic level
- Answer questions about the module's subject matter
- Help students understand difficult topics with examples
- Encourage critical thinking rather than just giving answers
- Be supportive and encouraging

Keep responses focused and concise. If asked about something outside this module's scope, gently redirect.`;

  // Deduct credit before streaming (prevents abuse; cost is fair since Anthropic is called)
  try {
    await deductCredits({
      studentId,
      amount: TUTOR_CREDIT_COST,
      reason: "spend.tutor",
      note: `AI Tutor: ${mod.code}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Insufficient credits.";
    return NextResponse.json({ error: msg }, { status: 402 });
  }

  const client = new Anthropic({ apiKey });

  // Stream the response
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  (async () => {
    let fullResponse = "";
    try {
      const anthropicStream = client.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
      });

      for await (const event of anthropicStream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          await writer.write(encoder.encode(event.delta.text));
        }
      }

      // Save both messages to DB after successful stream
      await TutorSession.findByIdAndUpdate(tutorSession!._id, {
        $push: {
          messages: {
            $each: [
              { role: "user", content: message.trim(), createdAt: new Date() },
              { role: "assistant", content: fullResponse, createdAt: new Date() },
            ],
          },
        },
      });
    } catch {
      await writer.write(encoder.encode("\n\n[An error occurred. Please try again.]"));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
