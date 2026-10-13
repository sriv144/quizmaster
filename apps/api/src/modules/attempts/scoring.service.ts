import { Injectable } from "@nestjs/common";
import { QuestionType } from "../../generated/prisma/enums.js";

export interface GradeInput {
  type: QuestionType;
  answerKey: unknown;
  answer: unknown;
  marks: number;
  negativeMarks: number;
}

export interface GradeResult {
  answered: boolean;
  correct: boolean;
  marksAwarded: number;
}

@Injectable()
export class ScoringService {
  grade(input: GradeInput): GradeResult {
    const answered = this.hasAnswer(input.answer);
    if (!answered) return { answered: false, correct: false, marksAwarded: 0 };

    let correct = false;
    if (input.type === QuestionType.SINGLE_CHOICE) {
      const expected = Array.isArray(input.answerKey) ? input.answerKey[0] : input.answerKey;
      correct = typeof input.answer === "string" && input.answer === expected;
    } else if (input.type === QuestionType.MULTIPLE_CHOICE) {
      correct = this.sameStringSet(input.answerKey, input.answer);
    } else if (input.type === QuestionType.INTEGER) {
      correct = Number.isInteger(input.answer) && input.answer === input.answerKey;
    } else if (input.type === QuestionType.TRUE_FALSE) {
      correct = typeof input.answer === "boolean" && input.answer === input.answerKey;
    }

    return {
      answered: true,
      correct,
      marksAwarded: correct ? input.marks : -Math.abs(input.negativeMarks),
    };
  }

  private hasAnswer(answer: unknown) {
    if (Array.isArray(answer)) return answer.length > 0;
    return answer !== null && answer !== undefined && answer !== "";
  }

  private sameStringSet(expected: unknown, actual: unknown) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    if (!expected.every((value) => typeof value === "string")) return false;
    if (!actual.every((value) => typeof value === "string")) return false;
    const left = [...new Set(expected)].sort();
    const right = [...new Set(actual)].sort();
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
}
