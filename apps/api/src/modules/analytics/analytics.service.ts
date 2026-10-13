import { Injectable } from "@nestjs/common";
import { AttemptStatus, Role } from "../../generated/prisma/enums.js";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async learner(userId: string) {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT] } },
      orderBy: { submittedAt: "desc" },
      include: { quiz: { include: { chapter: { include: { subject: true } } } } },
    });
    const completed = attempts.length;
    const percentages = attempts
      .filter((attempt) => Number(attempt.maxScore) > 0)
      .map((attempt) => Number(attempt.totalScore) / Number(attempt.maxScore) * 100);
    return {
      completed,
      averagePercent: percentages.length
        ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
        : 0,
      totalTimeSeconds: attempts.reduce((sum, attempt) => sum + attempt.timeSpentSeconds, 0),
      timeline: attempts.map((attempt) => ({
        id: attempt.id,
        quizTitle: attempt.quiz.title,
        subject: attempt.quiz.chapter.subject.name,
        score: Number(attempt.totalScore),
        maxScore: Number(attempt.maxScore),
        submittedAt: attempt.submittedAt,
        status: attempt.status,
      })),
    };
  }

  history(userId: string) {
    return this.prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      include: {
        quiz: { select: { title: true } },
        _count: { select: { questions: true } },
      },
    });
  }

  async admin() {
    const [learners, quizzes, questions, attempts, needsReview, recent] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: Role.LEARNER } }),
      this.prisma.quiz.count(),
      this.prisma.question.count(),
      this.prisma.quizAttempt.count(),
      this.prisma.quizAttempt.count({ where: { migrationStatus: "NEEDS_REVIEW" } }),
      this.prisma.quizAttempt.findMany({
        take: 20,
        orderBy: { startedAt: "desc" },
        include: { user: { select: { email: true, displayName: true } }, quiz: { select: { title: true } } },
      }),
    ]);
    return { learners, quizzes, questions, attempts, needsReview, recent };
  }

  users() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        passwordResetRequired: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { attempts: true } },
      },
    });
  }

  setUserActive(id: string, active: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: { active } });
      if (!active) await tx.session.deleteMany({ where: { userId: id } });
      return { id: user.id, active: user.active };
    });
  }

  addComment(attemptId: string, authorId: string, text: string, isPrivate: boolean) {
    return this.prisma.scoreComment.create({
      data: { attemptId, authorId, text: text.trim(), private: isPrivate },
    });
  }
}
