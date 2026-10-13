import { describe, expect, it } from "vitest";
import { QuestionType } from "../../generated/prisma/enums.js";
import { ScoringService } from "./scoring.service.js";

describe("ScoringService", () => {
  const scorer = new ScoringService();

  it("requires an exact set for multiple-choice answers", () => {
    expect(
      scorer.grade({
        type: QuestionType.MULTIPLE_CHOICE,
        answerKey: ["a", "c"],
        answer: ["c", "a"],
        marks: 4,
        negativeMarks: 1,
      }),
    ).toEqual({ answered: true, correct: true, marksAwarded: 4 });
    expect(
      scorer.grade({
        type: QuestionType.MULTIPLE_CHOICE,
        answerKey: ["a", "c"],
        answer: ["a"],
        marks: 4,
        negativeMarks: 1,
      }).marksAwarded,
    ).toBe(-1);
  });

  it("does not penalize an unanswered question", () => {
    expect(
      scorer.grade({
        type: QuestionType.INTEGER,
        answerKey: 42,
        answer: null,
        marks: 2,
        negativeMarks: 0.5,
      }),
    ).toEqual({ answered: false, correct: false, marksAwarded: 0 });
  });

  it("does not coerce integer or boolean answers", () => {
    expect(
      scorer.grade({
        type: QuestionType.INTEGER,
        answerKey: 1,
        answer: "1",
        marks: 1,
        negativeMarks: 0,
      }).correct,
    ).toBe(false);
    expect(
      scorer.grade({
        type: QuestionType.TRUE_FALSE,
        answerKey: true,
        answer: "true",
        marks: 1,
        negativeMarks: 0,
      }).correct,
    ).toBe(false);
  });
});
