import { extractText, getDocumentProxy } from "unpdf";
import type { TestQuestionType } from "@/models/Test";

export type ParsedOption = {
  letter: string;
  text: string;
};

export type ParsedQuestion = {
  type: TestQuestionType;
  prompt: string;
  options: ParsedOption[];
};

/**
 * Pull the raw text out of a PDF (typed/text-based only — no OCR).
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

const QUESTION_LINE_RE =
  /^(?:question\s+|q[.:]?\s*)?(\d{1,3})\s*[.)\]:\-]\s*(.+)$/i;

const OPTION_LINE_RE =
  /^[\(\[]?\s*([A-Ha-h])\s*[\)\].:\-]\s*(.+)$/;

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Insert newlines before question/option markers that are sitting mid-line.
 * Many PDFs emit text as a single long stream — without this pre-pass the
 * line-based matcher would never see a marker at the start of a line.
 *
 * Question markers we recognise (1-3 digit number):
 *   1. / 1) / 1: / 1-     and   Q1. / Q.1 / Question 1:
 * Option markers we recognise (single letter A-H, upper or lower case):
 *   A. / A) / (A) / A:
 *
 * We only break BEFORE a marker that's preceded by whitespace or punctuation,
 * so digits inside other text ("RFC 1234", "version 2.0") aren't split out.
 */
function insertMarkerBreaks(input: string): string {
  let text = input.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ");

  // Newline before a question marker: 1. / 1) / Q1. / Question 1:
  text = text.replace(
    /([\s.?!,;:])((?:Question\s+|Q\.?\s*)?\d{1,3}\s*[.)\]:\-]\s+(?=[A-Za-z]))/g,
    "$1\n$2",
  );

  // Newline before an option marker: A. / a) / (A)
  text = text.replace(
    /([\s.?!,;:])([\(\[]?[A-Ha-h]\s*[\)\].:\-]\s+(?=[A-Za-z0-9]))/g,
    "$1\n$2",
  );

  return text;
}

function parseDrafts(text: string): {
  prompt: string;
  options: ParsedOption[];
}[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  type Draft = { prompt: string; options: ParsedOption[] };
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let lastOption: ParsedOption | null = null;

  for (const raw of lines) {
    const line = raw.replace(/ /g, " ").trim();
    const qm = line.match(QUESTION_LINE_RE);
    const om = line.match(OPTION_LINE_RE);

    if (qm) {
      current = { prompt: qm[2].trim(), options: [] };
      drafts.push(current);
      lastOption = null;
      continue;
    }

    if (om && current) {
      const opt: ParsedOption = {
        letter: om[1].toUpperCase(),
        text: om[2].trim(),
      };
      current.options.push(opt);
      lastOption = opt;
      continue;
    }

    if (!current) continue;
    if (lastOption) {
      lastOption.text = normaliseWhitespace(`${lastOption.text} ${line}`);
    } else {
      current.prompt = normaliseWhitespace(`${current.prompt} ${line}`);
    }
  }
  return drafts;
}

/**
 * Heuristic parser. Two passes:
 *   1. Line-by-line, assuming the PDF preserved visual line breaks.
 *   2. If that finds nothing, pre-process to inject newlines before any
 *      mid-stream question/option marker, then re-run pass 1.
 *
 * Each question must end up with 2–8 options and a non-empty prompt.
 */
export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  let drafts = parseDrafts(text);
  let usable = drafts.filter(
    (d) => d.prompt.length > 0 && d.options.length >= 2 && d.options.length <= 8,
  );

  if (usable.length === 0) {
    drafts = parseDrafts(insertMarkerBreaks(text));
    usable = drafts.filter(
      (d) =>
        d.prompt.length > 0 &&
        d.options.length >= 2 &&
        d.options.length <= 8,
    );
  }

  return usable.map<ParsedQuestion>((d) => {
    const isTrueFalse =
      d.options.length === 2 &&
      d.options.every((o) => /^(true|false|t|f)\b/i.test(o.text));
    const type: TestQuestionType = isTrueFalse ? "true_false" : "mcq";
    return {
      type,
      prompt: normaliseWhitespace(d.prompt),
      options: d.options.map((o) => ({
        letter: o.letter,
        text: normaliseWhitespace(o.text),
      })),
    };
  });
}
