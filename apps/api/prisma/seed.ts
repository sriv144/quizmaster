import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { QuestionType, QuizStatus, Role } from "../src/generated/prisma/enums.js";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: [resolve(packageDir, "../../.env"), resolve(packageDir, ".env")], quiet: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const email = (process.env.ADMIN_EMAIL ?? "admin@quizmaster.local").toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
if (process.env.NODE_ENV === "production" && (
  !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || password === "ChangeMe123!" ||
  password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)
)) {
  throw new Error("Set ADMIN_EMAIL and a unique ADMIN_PASSWORD (12+ characters, uppercase, lowercase, number) before seeding a hosted database");
}
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

const admin = await prisma.user.upsert({
  where: { email },
  // Repeated demo boots must not overwrite an account's password or role.
  update: {},
  create: {
    email,
    displayName: "QuizMaster Admin",
    role: Role.ADMIN,
    passwordHash,
    passwordResetRequired: false,
    emailVerifiedAt: new Date(),
  },
});

if (process.env.SEED_DEMO_DATA !== "false" && (await prisma.subject.count()) === 0) {
  await prisma.subject.create({
    data: {
      name: "General Knowledge",
      code: "GK",
      description: "A sample subject for local development.",
      chapters: {
        create: {
          name: "World & Science",
          sequence: 1,
          quizzes: {
            create: {
              title: "Starter Challenge",
              description: "A short sample quiz to verify the full attempt flow.",
              status: QuizStatus.PUBLISHED,
              durationSeconds: 600,
              createdById: admin.id,
              questions: {
                create: [
                  {
                    prompt: "Which planet is known as the Red Planet?",
                    type: QuestionType.SINGLE_CHOICE,
                    sequence: 1,
                    options: {
                      create: [
                        { text: "Venus", position: 1, isCorrect: false },
                        { text: "Mars", position: 2, isCorrect: true },
                        { text: "Jupiter", position: 3, isCorrect: false },
                      ],
                    },
                  },
                  {
                    prompt: "Water freezes at 0°C at standard pressure.",
                    type: QuestionType.TRUE_FALSE,
                    sequence: 2,
                    correctBoolean: true,
                  },
                ],
              },
            },
          },
        },
      },
    },
  });
}

await prisma.$disconnect();
console.log(`Seed complete. Administrator: ${email}`);
