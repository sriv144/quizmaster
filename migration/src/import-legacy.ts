import { config as loadEnv } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../../apps/api/src/generated/prisma/client.js";
import {
  AttemptStatus,
  MigrationStatus,
  QuestionType,
  QuizStatus,
  Role,
} from "../../apps/api/src/generated/prisma/enums.js";

type Legacy = Record<string, unknown>;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: resolve(repositoryRoot, ".env"), quiet: true });
const sourcePath = resolve(repositoryRoot, process.env.LEGACY_DATABASE_PATH ?? "migration/input/quiz_master.db");
const outputDir = resolve(repositoryRoot, process.env.MIGRATION_OUTPUT_DIR ?? "migration/output");
const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const report = {
  sourcePath,
  startedAt: new Date().toISOString(),
  counts: {} as Record<string, number>,
  normalized: [] as Array<{ entity: string; legacyId: number; reason: string }>,
  needsReview: [] as Array<{ entity: string; legacyId: number; reason: string }>,
  skippedAssets: [] as Array<{ legacyId: number; path: string }>,
};

const rows = (table: string) => sqlite.prepare(`SELECT * FROM ${table}`).all() as Legacy[];
const number = (value: unknown) => value === null || value === undefined ? null : Number(value);
const text = (value: unknown) => value === null || value === undefined ? null : String(value);
const bool = (value: unknown) => value === 1 || value === true;
const legacyDate = (value: unknown) => {
  if (!value) return null;
  const raw = String(value).trim().replace(" ", "T");
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const normalized = dateOnly
    ? `${raw}T00:00:00.000Z`
    : /[zZ]|[+-]\d\d:\d\d$/.test(raw)
      ? raw
      : `${raw}+05:30`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function mappedType(raw: unknown): QuestionType {
  const value = String(raw ?? "").toLowerCase();
  if (value === "mcq" || value === "single") return QuestionType.SINGLE_CHOICE;
  if (value === "multiselect" || value === "multiple") return QuestionType.MULTIPLE_CHOICE;
  if (value === "integer") return QuestionType.INTEGER;
  return QuestionType.TRUE_FALSE;
}

function decodeOptionTokens(correct: string | null, options: string[]) {
  if (!correct) return [] as number[];
  return correct.split(",").map((token) => token.trim()).flatMap((token) => {
    const optionMatch = token.match(/^option\s*(\d+)$/i);
    const numeric = optionMatch ? Number(optionMatch[1]) : /^\d+$/.test(token) ? Number(token) : null;
    if (numeric && numeric >= 1 && numeric <= options.length) return [numeric - 1];
    const literalIndex = options.findIndex((option) => option.trim().toLowerCase() === token.toLowerCase());
    return literalIndex >= 0 ? [literalIndex] : [];
  });
}

const users = new Map<number, string>();
for (const row of rows("users")) {
  const legacyId = number(row.id)!;
  const email = String(row.username ?? row.email ?? `legacy-${legacyId}@invalid.local`).trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { legacyId },
    update: {},
    create: {
      legacyId,
      email,
      displayName: text(row.full_name),
      contactPhone: text(row.contact_no),
      dateOfBirth: legacyDate(row.dob),
      role: String(row.role).toLowerCase() === "admin" ? Role.ADMIN : Role.LEARNER,
      passwordHash: null,
      passwordResetRequired: true,
      active: row.is_active === null ? true : bool(row.is_active),
      createdAt: legacyDate(row.created_at) ?? new Date(),
      lastLoginAt: legacyDate(row.last_login),
    },
  });
  users.set(legacyId, user.id);
}
report.counts.users = users.size;

const subjects = new Map<number, string>();
for (const row of rows("subjects")) {
  const legacyId = number(row.id)!;
  const subject = await prisma.subject.upsert({
    where: { legacyId },
    update: {},
    create: {
      legacyId,
      name: String(row.name),
      description: text(row.description),
      code: text(row.code),
      active: row.is_active === null ? true : bool(row.is_active),
      createdAt: legacyDate(row.created_at) ?? new Date(),
    },
  });
  subjects.set(legacyId, subject.id);
}
report.counts.subjects = subjects.size;

const chapters = new Map<number, string>();
for (const row of rows("chapters")) {
  const legacyId = number(row.id)!;
  const subjectId = subjects.get(number(row.subject_id)!);
  if (!subjectId) continue;
  const chapter = await prisma.chapter.upsert({
    where: { legacyId },
    update: {},
    create: {
      legacyId,
      subjectId,
      name: String(row.name),
      description: text(row.description),
      sequence: number(row.seq_num) ?? 0,
      active: row.is_active === null ? true : bool(row.is_active),
      createdAt: legacyDate(row.created_at) ?? new Date(),
    },
  });
  chapters.set(legacyId, chapter.id);
}
report.counts.chapters = chapters.size;

const quizzes = new Map<number, string>();
for (const row of rows("quizzes")) {
  const legacyId = number(row.id)!;
  const chapterId = chapters.get(number(row.chapter_id)!);
  if (!chapterId) continue;
  const quiz = await prisma.quiz.upsert({
    where: { legacyId },
    update: {},
    create: {
      legacyId,
      chapterId,
      createdById: users.get(number(row.created_by) ?? -1) ?? null,
      title: String(row.name),
      description: text(row.description),
      instructions: text(row.instructions),
      status: QuizStatus.DRAFT,
      opensAt: legacyDate(row.start_time),
      closesAt: legacyDate(row.end_time),
      durationSeconds: number(row.time_duration) ? number(row.time_duration)! * 60 : null,
      maxAttempts: 1,
      passingPercent: number(row.passing_score) ?? 0,
      randomizeQuestions: bool(row.randomize_questions),
      createdAt: legacyDate(row.created_at) ?? new Date(),
    },
  });
  quizzes.set(legacyId, quiz.id);
}
report.counts.quizzes = quizzes.size;

const questions = new Map<number, { id: string; review: boolean }>();
const legacyQuestions = rows("questions");
for (const row of legacyQuestions) {
  const legacyId = number(row.id)!;
  const quizId = quizzes.get(number(row.quiz_id)!);
  if (!quizId) continue;
  const type = mappedType(row.question_type);
  const optionTexts = [row.option1, row.option2, row.option3, row.option4, row.option5, row.option6]
    .map(text)
    .filter((value): value is string => !!value);
  const correctRaw = text(row.correct_option);
  const correctIndexes = decodeOptionTokens(correctRaw, optionTexts);
  let needsReview = !correctRaw;
  if ((type === QuestionType.SINGLE_CHOICE || type === QuestionType.MULTIPLE_CHOICE) && !correctIndexes.length) {
    needsReview = true;
  }
  const correctInteger = type === QuestionType.INTEGER && correctRaw && /^-?\d+$/.test(correctRaw)
    ? Number(correctRaw)
    : null;
  const correctBoolean = type === QuestionType.TRUE_FALSE && correctRaw
    ? ["true", "1", "yes"].includes(correctRaw.toLowerCase())
    : null;
  if (type === QuestionType.INTEGER && correctInteger === null) needsReview = true;

  const question = await prisma.question.upsert({
    where: { legacyId },
    update: {},
    create: {
      legacyId,
      quizId,
      prompt: String(row.question_statement),
      explanation: text(row.explanation),
      type,
      difficulty: text(row.difficulty) ?? "Medium",
      marks: number(row.marks) ?? 1,
      negativeMarks: Math.abs(number(row.negative_marks) ?? 0),
      required: row.is_required === null ? true : bool(row.is_required),
      sequence: number(row.seq_num) ?? 0,
      correctInteger,
      correctBoolean,
      migrationStatus: needsReview ? MigrationStatus.NEEDS_REVIEW : MigrationStatus.NORMALIZED,
      options: {
        create: optionTexts.map((option, index) => ({
          text: option,
          position: index + 1,
          isCorrect: correctIndexes.includes(index),
        })),
      },
    },
  });
  questions.set(legacyId, { id: question.id, review: needsReview });
  if (needsReview) report.needsReview.push({ entity: "question", legacyId, reason: "Missing or ambiguous answer key" });
  else report.normalized.push({ entity: "question", legacyId, reason: `Mapped ${String(row.question_type)} to ${type}` });
  const imagePath = text(row.image_path);
  if (imagePath) report.skippedAssets.push({ legacyId, path: imagePath });
}
report.counts.questions = questions.size;

for (const [legacyId, quizId] of quizzes) {
  const quizQuestions = legacyQuestions.filter((row) => number(row.quiz_id) === legacyId);
  const hasReview = quizQuestions.length === 0 ||
    quizQuestions.some((row) => questions.get(number(row.id)!)?.review);
  await prisma.quiz.update({
    where: { id: quizId },
    data: {
      status: hasReview ? QuizStatus.DRAFT : QuizStatus.PUBLISHED,
      migrationStatus: hasReview ? MigrationStatus.NEEDS_REVIEW : MigrationStatus.NORMALIZED,
    },
  });
  if (quizQuestions.length === 0) {
    report.needsReview.push({ entity: "quiz", legacyId, reason: "Quiz has no questions" });
  }
}

const attempts = new Map<number, string>();
for (const row of rows("scores")) {
  const legacyId = number(row.id)!;
  const quizId = quizzes.get(number(row.quiz_id)!);
  const userId = users.get(number(row.user_id)!);
  if (!quizId || !userId) continue;
  const actualQuestionCount = legacyQuestions.filter((question) => number(question.quiz_id) === number(row.quiz_id)).length;
  const storedCount = number(row.total_questions) ?? 0;
  const mismatch = storedCount !== actualQuestionCount;
  const attempt = await prisma.quizAttempt.upsert({
    where: { legacyId },
    update: {},
    create: {
      legacyId,
      quizId,
      userId,
      attemptNumber: number(row.attempt_number) ?? 1,
      status: String(row.completion_status).toLowerCase().includes("timed")
        ? AttemptStatus.TIMED_OUT
        : AttemptStatus.SUBMITTED,
      startedAt: legacyDate(row.time_stamp_of_attempt) ?? new Date(),
      submittedAt: legacyDate(row.time_stamp_of_attempt) ?? new Date(),
      totalScore: number(row.total_scored) ?? 0,
      legacyScore: number(row.total_scored) ?? 0,
      legacyQuestionCount: storedCount,
      questionsAnswered: number(row.questions_answered) ?? 0,
      questionsCorrect: number(row.questions_correct) ?? 0,
      timeSpentSeconds: number(row.time_spent) ?? 0,
      orderSeed: `legacy-${legacyId}`,
      migrationStatus: mismatch ? MigrationStatus.NEEDS_REVIEW : MigrationStatus.NORMALIZED,
      migrationNote: mismatch ? `Stored ${storedCount} questions; current quiz has ${actualQuestionCount}` : null,
      ipAddress: text(row.ip_address),
      deviceInfo: text(row.device_info),
    },
  });
  attempts.set(legacyId, attempt.id);
  if (mismatch) report.needsReview.push({ entity: "attempt", legacyId, reason: "Question count mismatch" });
}
report.counts.attempts = attempts.size;

const attemptsByScore = new Map<number, Legacy[]>();
for (const row of rows("question_attempts")) {
  const scoreId = number(row.score_id)!;
  attemptsByScore.set(scoreId, [...(attemptsByScore.get(scoreId) ?? []), row]);
}
let answerCount = 0;
for (const [legacyScoreId, answerRows] of attemptsByScore) {
  const attemptId = attempts.get(legacyScoreId);
  if (!attemptId) continue;
  for (const [index, row] of answerRows.entries()) {
    const source = questions.get(number(row.question_id)!);
    if (!source) continue;
    const current = await prisma.question.findUniqueOrThrow({
      where: { id: source.id },
      include: { options: { orderBy: { position: "asc" } } },
    });
    const answerKey: Prisma.InputJsonValue = current.type === QuestionType.SINGLE_CHOICE || current.type === QuestionType.MULTIPLE_CHOICE
      ? current.options.filter((option) => option.isCorrect).map((option) => option.id)
      : current.type === QuestionType.INTEGER
        ? (current.correctInteger ?? 0)
        : (current.correctBoolean ?? false);
    const snapshot = await prisma.attemptQuestion.upsert({
      where: { attemptId_position: { attemptId, position: index + 1 } },
      update: {},
      create: {
        attemptId,
        sourceQuestionId: current.id,
        position: index + 1,
        prompt: current.prompt,
        explanation: current.explanation,
        type: current.type,
        options: current.options.map(({ id, text, position }) => ({ id, text, position })),
        answerKey,
        marks: current.marks,
        negativeMarks: current.negativeMarks,
      },
    });
    await prisma.attemptAnswer.upsert({
      where: { attemptQuestionId: snapshot.id },
      update: {},
      create: {
        attemptQuestionId: snapshot.id,
        answer: text(row.user_answer) ?? "",
        timeSpentSeconds: number(row.time_spent) ?? 0,
        isCorrect: bool(row.is_correct),
        marksAwarded: number(row.marks_awarded) ?? 0,
      },
    });
    answerCount += 1;
  }
}
report.counts.answers = answerCount;

let commentCount = 0;
for (const row of rows("score_comments")) {
  const attemptId = attempts.get(number(row.score_id)!);
  if (!attemptId) continue;
  await prisma.scoreComment.upsert({
    where: { legacyId: number(row.id)! },
    update: {},
    create: {
      legacyId: number(row.id)!,
      attemptId,
      authorId: users.get(number(row.admin_id) ?? -1) ?? null,
      text: text(row.comment_text) ?? "",
      private: bool(row.is_private),
      createdAt: legacyDate(row.created_at) ?? new Date(),
    },
  });
  commentCount += 1;
}
report.counts.comments = commentCount;

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "legacy-import-report.json"), JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2));
sqlite.close();
await prisma.$disconnect();
console.log(JSON.stringify(report.counts, null, 2));
