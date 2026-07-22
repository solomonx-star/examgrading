import Anthropic from "@anthropic-ai/sdk";
import type { ParsedQuestion } from "./pdf-extract";

export async function gradeQuestionsWithAI(
  questions: ParsedQuestion[],
): Promise<{ questions: ParsedQuestion[]; aiGraded: boolean }> {
  if (questions.length === 0) return { questions, aiGraded: false };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { questions, aiGraded: false };

  try {
    const client = new Anthropic({ apiKey });

    const questionText = questions
      .map((q, i) => {
        const opts = q.options.map((o) => `${o.letter}. ${o.text}`).join("\n");
        return `Q${i + 1}: ${q.prompt}\n${opts}`;
      })
      .join("\n\n");

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are an academic expert. For each multiple-choice question below, identify the single correct answer. Respond ONLY with a JSON array — no explanation, no markdown:\n[{"q":1,"correct":"A"},{"q":2,"correct":"B"},...]\n\n${questionText}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text")
      return { questions, aiGraded: false };

    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { questions, aiGraded: false };

    const answers = JSON.parse(jsonMatch[0]) as { q: number; correct: string }[];
    const answerMap = new Map(
      answers.map((a) => [a.q, a.correct.toUpperCase().trim().charAt(0)]),
    );

    return {
      questions: questions.map((q, i) => {
        const letter = answerMap.get(i + 1);
        if (!letter) return q;
        return {
          ...q,
          options: q.options.map((o) => ({ ...o, isCorrect: o.letter === letter })),
        };
      }),
      aiGraded: true,
    };
  } catch {
    return { questions, aiGraded: false };
  }
}
