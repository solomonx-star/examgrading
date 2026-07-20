import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { extractPdfText, parseQuestionsFromText } from "@/lib/pdf-extract";
import { gradeQuestionsWithAI } from "@/lib/ai-grader";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const { testId } = await params;
  if (!mongoose.Types.ObjectId.isValid(testId)) {
    return NextResponse.json({ error: "Invalid test id." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read upload." },
      { status: 400 },
    );
  }

  const courseId = form.get("courseId");
  const file = form.get("file");
  if (typeof courseId !== "string") {
    return NextResponse.json(
      { error: "Missing courseId." },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Attach a PDF file." },
      { status: 400 },
    );
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `PDF is over ${Math.round(MAX_BYTES / 1024 / 1024)}MB.` },
      { status: 413 },
    );
  }

  const { course: mod } = await requireLecturerCourse(courseId);

  await connectDB();
  const test = await Test.findOne({ _id: testId, courseId: mod._id });
  if (!test) {
    return NextResponse.json({ error: "Test not found." }, { status: 404 });
  }
  const submissionExists = await TestSubmission.exists({ testId: test._id });
  if (test.isPublished && submissionExists) {
    return NextResponse.json(
      {
        error:
          "Students have already started — unpublish and clear submissions before importing new questions.",
      },
      { status: 409 },
    );
  }

  const buffer = await file.arrayBuffer();

  let text = "";
  try {
    text = await extractPdfText(buffer);
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not read this PDF. Make sure it's text-based (not a scan or image).",
      },
      { status: 422 },
    );
  }

  const parsedRaw = parseQuestionsFromText(text);
  if (parsedRaw.length === 0) {
    return NextResponse.json(
      {
        error:
          "Couldn't find any questions in this PDF. Expected numbered prompts (1., Q1.) and lettered options (A., a)).",
        rawTextPreview: text.slice(0, 1500),
        extractedChars: text.length,
      },
      { status: 422 },
    );
  }

  const { questions: parsed, aiGraded } = await gradeQuestionsWithAI(parsedRaw);

  let storedUrl: string | null = null;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const blob = await put(`tests/${test._id}/${Date.now()}-${safeName}`, file, {
        access: "public",
        contentType: "application/pdf",
      });
      storedUrl = blob.url;
      test.sourcePdfUrl = storedUrl;
      test.sourcePdfName = file.name;
      await test.save();
    } catch {
      // Don't fail the import if blob upload fails — parsing succeeded.
      storedUrl = null;
    }
  }

  await audit({
    action: "test.pdfImport",
    summary: `Imported ${parsed.length} question${parsed.length === 1 ? "" : "s"} from "${file.name}" into "${test.title}"`,
    entityType: "Test",
    entityId: String(test._id),
    metadata: {
      questionCount: parsed.length,
      fileName: file.name,
      fileSize: file.size,
      stored: !!storedUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    questions: parsed,
    aiGraded,
    storedUrl,
    rawTextPreview: text.slice(0, 600),
  });
}
