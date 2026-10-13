import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  QuestionType,
  QuizStatus,
  type Prisma,
  type Role,
} from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  CreateChapterDto,
  CreateQuestionDto,
  CreateQuizDto,
  CreateSubjectDto,
  UpdateQuizDto,
} from "./catalog.dto.js";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listSubjects(admin = false) {
    return this.prisma.subject.findMany({
      where: admin ? {} : { active: true },
      orderBy: { name: "asc" },
      include: {
        chapters: {
          where: admin ? {} : { active: true },
          orderBy: [{ sequence: "asc" }, { name: "asc" }],
          include: {
            quizzes: {
              where: admin ? {} : { status: QuizStatus.PUBLISHED },
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                status: true,
                opensAt: true,
                closesAt: true,
                durationSeconds: true,
                maxAttempts: true,
                _count: { select: { questions: true } },
              },
            },
          },
        },
      },
    });
  }

  async getQuiz(id: string, role: Role) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        chapter: { include: { subject: true } },
        questions: {
          orderBy: { sequence: "asc" },
          include: { options: { orderBy: { position: "asc" } } },
        },
      },
    });
    if (!quiz || (role !== "ADMIN" && quiz.status !== QuizStatus.PUBLISHED)) {
      throw new NotFoundException("Quiz not found");
    }
    if (role !== "ADMIN") {
      return {
        ...quiz,
        questions: quiz.questions.map(({ options, correctBoolean: _correctBoolean, correctInteger: _correctInteger, ...question }) => ({
          ...question,
          options: options.map(({ isCorrect: _, ...option }) => option),
        })),
      };
    }
    return quiz;
  }

  createSubject(dto: CreateSubjectDto) {
    return this.prisma.subject.create({
      data: {
        name: dto.name.trim(),
        ...(dto.description ? { description: dto.description.trim() } : {}),
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      },
    });
  }

  createChapter(dto: CreateChapterDto) {
    return this.prisma.chapter.create({
      data: {
        subjectId: dto.subjectId,
        name: dto.name.trim(),
        ...(dto.description ? { description: dto.description.trim() } : {}),
        ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
      },
    });
  }

  createQuiz(dto: CreateQuizDto, userId: string) {
    this.validateSchedule(dto.opensAt, dto.closesAt);
    return this.prisma.quiz.create({ data: this.quizCreateData(dto, userId) });
  }

  async updateQuiz(id: string, dto: UpdateQuizDto) {
    const existing = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Quiz not found");
    this.validateSchedule(
      dto.opensAt ?? existing.opensAt?.toISOString(),
      dto.closesAt ?? existing.closesAt?.toISOString(),
    );
    if (dto.status === QuizStatus.PUBLISHED) await this.validatePublishable(id);
    return this.prisma.quiz.update({
      where: { id },
      data: this.quizUpdateData(dto),
    });
  }

  async deleteQuiz(id: string) {
    const attempts = await this.prisma.quizAttempt.count({ where: { quizId: id } });
    if (attempts) {
      return this.prisma.quiz.update({ where: { id }, data: { status: QuizStatus.ARCHIVED } });
    }
    return this.prisma.quiz.delete({ where: { id } });
  }

  createQuestion(quizId: string, dto: CreateQuestionDto) {
    this.validateQuestion(dto);
    return this.prisma.question.create({
      data: {
        quizId,
        prompt: dto.prompt.trim(),
        ...(dto.explanation ? { explanation: dto.explanation.trim() } : {}),
        type: dto.type,
        difficulty: dto.difficulty?.trim() || "Medium",
        marks: dto.marks,
        negativeMarks: dto.negativeMarks ?? 0,
        required: dto.required ?? true,
        sequence: dto.sequence ?? 0,
        ...(dto.correctInteger !== undefined ? { correctInteger: dto.correctInteger } : {}),
        ...(dto.correctBoolean !== undefined ? { correctBoolean: dto.correctBoolean } : {}),
        ...(dto.options?.length
          ? {
              options: {
                create: dto.options.map((option) => ({
                  text: option.text.trim(),
                  position: option.position,
                  isCorrect: option.isCorrect,
                })),
              },
            }
          : {}),
      },
      include: { options: { orderBy: { position: "asc" } } },
    });
  }

  async deleteQuestion(id: string) {
    const snapshotted = await this.prisma.attemptQuestion.count({ where: { sourceQuestionId: id } });
    if (snapshotted) throw new BadRequestException("Question is part of attempt history and cannot be deleted");
    return this.prisma.question.delete({ where: { id } });
  }

  private quizCreateData(dto: CreateQuizDto, createdById: string): Prisma.QuizUncheckedCreateInput {
    return {
      chapterId: dto.chapterId,
      title: dto.title.trim(),
      createdById,
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.instructions !== undefined ? { instructions: dto.instructions.trim() } : {}),
      ...(dto.type ? { type: dto.type } : {}),
      ...(dto.opensAt !== undefined ? { opensAt: new Date(dto.opensAt) } : {}),
      ...(dto.closesAt !== undefined ? { closesAt: new Date(dto.closesAt) } : {}),
      ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
      ...(dto.maxAttempts !== undefined ? { maxAttempts: dto.maxAttempts } : {}),
      ...(dto.passingPercent !== undefined ? { passingPercent: dto.passingPercent } : {}),
      ...(dto.revealPolicy ? { revealPolicy: dto.revealPolicy } : {}),
      ...(dto.randomizeQuestions !== undefined ? { randomizeQuestions: dto.randomizeQuestions } : {}),
    };
  }

  private quizUpdateData(dto: UpdateQuizDto): Prisma.QuizUncheckedUpdateInput {
    return {
      ...(dto.chapterId !== undefined ? { chapterId: dto.chapterId } : {}),
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.instructions !== undefined ? { instructions: dto.instructions.trim() } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.opensAt !== undefined ? { opensAt: new Date(dto.opensAt) } : {}),
      ...(dto.closesAt !== undefined ? { closesAt: new Date(dto.closesAt) } : {}),
      ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
      ...(dto.maxAttempts !== undefined ? { maxAttempts: dto.maxAttempts } : {}),
      ...(dto.passingPercent !== undefined ? { passingPercent: dto.passingPercent } : {}),
      ...(dto.revealPolicy !== undefined ? { revealPolicy: dto.revealPolicy } : {}),
      ...(dto.randomizeQuestions !== undefined ? { randomizeQuestions: dto.randomizeQuestions } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
  }

  private validateSchedule(opensAt?: string, closesAt?: string) {
    if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) {
      throw new BadRequestException("Quiz closing time must be after its opening time");
    }
  }

  private validateQuestion(dto: CreateQuestionDto) {
    const options = dto.options ?? [];
    const correctCount = options.filter((option) => option.isCorrect).length;
    if (dto.type === QuestionType.SINGLE_CHOICE && (options.length < 2 || correctCount !== 1)) {
      throw new BadRequestException("Single-choice questions need at least two options and one correct answer");
    }
    if (dto.type === QuestionType.MULTIPLE_CHOICE && (options.length < 2 || correctCount < 1)) {
      throw new BadRequestException("Multiple-choice questions need at least two options and a correct answer");
    }
    if (dto.type === QuestionType.INTEGER && dto.correctInteger === undefined) {
      throw new BadRequestException("Integer questions need a correct integer");
    }
    if (dto.type === QuestionType.TRUE_FALSE && dto.correctBoolean === undefined) {
      throw new BadRequestException("True/false questions need a correct boolean");
    }
  }

  private async validatePublishable(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz?.questions.length) throw new BadRequestException("Add at least one question before publishing");
    if (quiz.questions.some((question) => question.migrationStatus === "NEEDS_REVIEW")) {
      throw new BadRequestException("Resolve migrated questions before publishing");
    }
  }
}
