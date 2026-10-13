import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AnswerRevealPolicy,
  AttemptStatus,
  Prisma,
  QuizStatus,
  type QuestionType,
} from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { SaveAnswerDto } from "./attempts.dto.js";
import { ScoringService } from "./scoring.service.js";

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorer: ScoringService,
  ) {}

  async start(quizId: string, userId: string, context: { ipAddress?: string; deviceInfo?: string }) {
    const existing = await this.prisma.quizAttempt.findFirst({
      where: { quizId, userId, status: AttemptStatus.IN_PROGRESS },
      orderBy: { attemptNumber: "desc" },
    });
    if (existing && (!existing.expiresAt || existing.expiresAt > new Date())) {
      return this.getAttempt(existing.id, userId);
    }
    if (existing) await this.finalize(existing.id, userId, true);

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { sequence: "asc" },
          include: { options: { orderBy: { position: "asc" } } },
        },
      },
    });
    if (!quiz || quiz.status !== QuizStatus.PUBLISHED) throw new NotFoundException("Quiz not found");
    const now = new Date();
    if (quiz.opensAt && now < quiz.opensAt) throw new ForbiddenException("Quiz is not open yet");
    if (quiz.closesAt && now >= quiz.closesAt) throw new GoneException("Quiz has closed");
    if (!quiz.questions.length) throw new BadRequestException("Quiz has no questions");

    const usedAttempts = await this.prisma.quizAttempt.count({ where: { quizId, userId } });
    if (quiz.maxAttempts !== null && usedAttempts >= quiz.maxAttempts) {
      throw new ForbiddenException("Maximum attempts reached");
    }

    const seed = randomUUID();
    const questions = quiz.randomizeQuestions
      ? [...quiz.questions].sort((left, right) =>
          this.seededValue(seed, left.id).localeCompare(this.seededValue(seed, right.id)),
        )
      : quiz.questions;
    const durationExpiry = quiz.durationSeconds
      ? new Date(now.getTime() + quiz.durationSeconds * 1000)
      : null;
    const expiresAt = durationExpiry && quiz.closesAt
      ? new Date(Math.min(durationExpiry.getTime(), quiz.closesAt.getTime()))
      : (durationExpiry ?? quiz.closesAt);

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        attemptNumber: usedAttempts + 1,
        orderSeed: seed,
        maxScore: questions.reduce((sum, question) => sum + Number(question.marks), 0),
        ...(expiresAt ? { expiresAt } : {}),
        ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
        ...(context.deviceInfo ? { deviceInfo: context.deviceInfo.slice(0, 300) } : {}),
        questions: {
          create: questions.map((question, index) => {
            const options = question.options.map((option) => ({
              id: option.id,
              text: option.text,
              position: option.position,
            }));
            const answerKey: Prisma.InputJsonValue =
              question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE"
                ? question.options.filter((option) => option.isCorrect).map((option) => option.id)
                : question.type === "INTEGER"
                  ? (question.correctInteger as number)
                  : (question.correctBoolean as boolean);
            return {
              sourceQuestionId: question.id,
              position: index + 1,
              prompt: question.prompt,
              explanation: question.explanation,
              type: question.type,
              ...(options.length ? { options } : {}),
              answerKey,
              marks: question.marks,
              negativeMarks: question.negativeMarks,
            };
          }),
        },
      },
    });
    return this.getAttempt(attempt.id, userId);
  }

  async getAttempt(id: string, userId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id },
      include: {
        quiz: { select: { id: true, title: true, instructions: true } },
        questions: { orderBy: { position: "asc" }, include: { answer: true } },
      },
    });
    if (!attempt || attempt.userId !== userId) throw new NotFoundException("Attempt not found");
    return this.attemptView(attempt);
  }

  async saveAnswer(id: string, questionId: string, userId: string, dto: SaveAnswerDto) {
    const attempt = await this.prisma.quizAttempt.findUnique({ where: { id } });
    if (!attempt || attempt.userId !== userId) throw new NotFoundException("Attempt not found");
    if (attempt.status !== AttemptStatus.IN_PROGRESS) throw new ConflictException("Attempt is finalized");
    if (attempt.expiresAt && attempt.expiresAt <= new Date()) throw new GoneException("Attempt has expired");
    const question = await this.prisma.attemptQuestion.findFirst({
      where: { id: questionId, attemptId: id },
    });
    if (!question) throw new NotFoundException("Question not found in this attempt");
    this.validateAnswer(question.type, dto.answer);
    return this.prisma.attemptAnswer.upsert({
      where: { attemptQuestionId: questionId },
      create: {
        attemptQuestionId: questionId,
        answer: dto.answer as Prisma.InputJsonValue,
        timeSpentSeconds: dto.timeSpentSeconds ?? 0,
      },
      update: {
        answer: dto.answer as Prisma.InputJsonValue,
        answeredAt: new Date(),
        ...(dto.timeSpentSeconds !== undefined ? { timeSpentSeconds: dto.timeSpentSeconds } : {}),
      },
    });
  }

  submit(id: string, userId: string) {
    return this.finalize(id, userId, false);
  }

  async result(id: string, userId: string, admin = false) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id },
      include: {
        quiz: true,
        questions: { orderBy: { position: "asc" }, include: { answer: true } },
        comments: { where: admin ? {} : { private: false }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!attempt || (!admin && attempt.userId !== userId)) throw new NotFoundException("Attempt not found");
    const reveal = admin || attempt.quiz.revealPolicy === AnswerRevealPolicy.AFTER_SUBMISSION ||
      (attempt.quiz.revealPolicy === AnswerRevealPolicy.AFTER_CLOSE &&
        !!attempt.quiz.closesAt && attempt.quiz.closesAt <= new Date());
    return {
      id: attempt.id,
      status: attempt.status,
      totalScore: Number(attempt.totalScore),
      maxScore: Number(attempt.maxScore),
      questionsAnswered: attempt.questionsAnswered,
      questionsCorrect: attempt.questionsCorrect,
      timeSpentSeconds: attempt.timeSpentSeconds,
      submittedAt: attempt.submittedAt,
      quiz: { id: attempt.quiz.id, title: attempt.quiz.title, passingPercent: Number(attempt.quiz.passingPercent) },
      questions: attempt.questions.map((question) => ({
        id: question.id,
        position: question.position,
        prompt: question.prompt,
        type: question.type,
        options: question.options,
        answer: question.answer?.answer ?? null,
        isCorrect: question.answer?.isCorrect ?? false,
        marksAwarded: Number(question.answer?.marksAwarded ?? 0),
        ...(reveal ? { answerKey: question.answerKey, explanation: question.explanation } : {}),
      })),
      comments: attempt.comments,
    };
  }

  private async finalize(id: string, userId: string, timedOut: boolean) {
    for (let tryNumber = 0; tryNumber < 2; tryNumber += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const attempt = await tx.quizAttempt.findUnique({
            where: { id },
            include: { questions: { include: { answer: true } } },
          });
          if (!attempt || attempt.userId !== userId) throw new NotFoundException("Attempt not found");
          if (attempt.status !== AttemptStatus.IN_PROGRESS) {
            return { id, status: attempt.status };
          }
          const now = new Date();
          const expired = !!attempt.expiresAt && attempt.expiresAt <= now;
          let totalScore = 0;
          let answered = 0;
          let correct = 0;
          for (const question of attempt.questions) {
            const grade = this.scorer.grade({
              type: question.type,
              answerKey: question.answerKey,
              answer: question.answer?.answer,
              marks: Number(question.marks),
              negativeMarks: Number(question.negativeMarks),
            });
            totalScore += grade.marksAwarded;
            if (grade.answered) answered += 1;
            if (grade.correct) correct += 1;
            if (question.answer) {
              await tx.attemptAnswer.update({
                where: { id: question.answer.id },
                data: { isCorrect: grade.correct, marksAwarded: grade.marksAwarded },
              });
            }
          }
          await tx.quizAttempt.update({
            where: { id },
            data: {
              status: timedOut || expired ? AttemptStatus.TIMED_OUT : AttemptStatus.SUBMITTED,
              submittedAt: now,
              totalScore,
              questionsAnswered: answered,
              questionsCorrect: correct,
              timeSpentSeconds: Math.max(0, Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000)),
            },
          });
          return { id, status: timedOut || expired ? AttemptStatus.TIMED_OUT : AttemptStatus.SUBMITTED };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (tryNumber === 0 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") continue;
        throw error;
      }
    }
    throw new ConflictException("Attempt could not be finalized");
  }

  private attemptView(attempt: Awaited<ReturnType<AttemptsService["loadAttemptForView"]>>) {
    return {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      quiz: attempt.quiz,
      questions: attempt.questions.map(({ answerKey: _, explanation: __, ...question }) => ({
        ...question,
        answer: question.answer?.answer ?? null,
      })),
    };
  }

  private loadAttemptForView(id: string) {
    return this.prisma.quizAttempt.findUniqueOrThrow({
      where: { id },
      include: {
        quiz: { select: { id: true, title: true, instructions: true } },
        questions: { orderBy: { position: "asc" }, include: { answer: true } },
      },
    });
  }

  private validateAnswer(type: QuestionType, answer: unknown) {
    const valid = type === "SINGLE_CHOICE"
      ? typeof answer === "string"
      : type === "MULTIPLE_CHOICE"
        ? Array.isArray(answer) && answer.every((value) => typeof value === "string")
        : type === "INTEGER"
          ? Number.isInteger(answer)
          : typeof answer === "boolean";
    if (!valid) throw new BadRequestException("Answer does not match the question type");
  }

  private seededValue(seed: string, value: string) {
    return createHash("sha256").update(`${seed}:${value}`).digest("hex");
  }
}
