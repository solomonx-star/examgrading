import type { ITestQuestion } from "@/models/Test";

export type StudentAnswerInput = {
  questionId: string;
  selectedOptionIds: string[];
};

export type ScoredAnswer = {
  questionId: string;
  selectedOptionIds: string[];
  awardedPoints: number;
};

export type ScoreResult = {
  answers: ScoredAnswer[];
  score: number;
  maxScore: number;
  percentage: number;
};

/**
 * Score a set of student answers against the test's questions.
 * Rules:
 * - mcq / true_false: full points only if the single selection matches the
 *   single correct option.
 * - multi: full points only if the selected set EXACTLY matches the set of
 *   correct options (no partial credit — keeps the MVP grading deterministic).
 */
export function scoreAnswers(
  questions: ITestQuestion[],
  answers: StudentAnswerInput[],
): ScoreResult {
  const answerByQuestion = new Map(
    answers.map((a) => [a.questionId, new Set(a.selectedOptionIds)]),
  );

  const scored: ScoredAnswer[] = [];
  let score = 0;
  let maxScore = 0;

  for (const q of questions) {
    maxScore += q.points;
    const correctSet = new Set(
      q.options.filter((o) => o.isCorrect).map((o) => String(o._id)),
    );
    const selectedSet = answerByQuestion.get(String(q._id)) ?? new Set<string>();

    let awarded = 0;
    if (correctSet.size > 0 && selectedSet.size === correctSet.size) {
      let allMatch = true;
      for (const id of selectedSet) {
        if (!correctSet.has(id)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) awarded = q.points;
    }

    score += awarded;
    scored.push({
      questionId: String(q._id),
      selectedOptionIds: Array.from(selectedSet),
      awardedPoints: awarded,
    });
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  return { answers: scored, score, maxScore, percentage };
}
