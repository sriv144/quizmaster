export type Role = "ADMIN" | "LEARNER";
export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "INTEGER" | "TRUE_FALSE";
export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT" | "ABANDONED" | "NEEDS_REVIEW";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  active: boolean;
  passwordResetRequired: boolean;
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  durationSeconds: number | null;
  maxAttempts: number | null;
  _count: { questions: number };
}

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  chapters: Array<{
    id: string;
    name: string;
    description: string | null;
    quizzes: QuizSummary[];
  }>;
}

export interface QuizDetail extends QuizSummary {
  instructions: string | null;
  passingPercent: number;
  chapter: { id: string; name: string; subject: { id: string; name: string } };
  questions: Array<{ id: string; prompt: string; type: QuestionType }>;
}

export interface AttemptQuestion {
  id: string;
  position: number;
  prompt: string;
  type: QuestionType;
  options: Array<{ id: string; text: string; position: number }> | null;
  marks: string | number;
  answer: unknown;
}

export interface Attempt {
  id: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  quiz: { id: string; title: string; instructions: string | null };
  questions: AttemptQuestion[];
}

export interface AttemptResult {
  id: string;
  status: AttemptStatus;
  totalScore: number;
  maxScore: number;
  questionsAnswered: number;
  questionsCorrect: number;
  timeSpentSeconds: number;
  submittedAt: string;
  quiz: { id: string; title: string; passingPercent: number };
  questions: Array<AttemptQuestion & {
    isCorrect: boolean;
    marksAwarded: number;
    answerKey?: unknown;
    explanation?: string | null;
  }>;
  comments: Array<{ id: string; text: string; createdAt: string }>;
}

export interface LearnerAnalytics {
  completed: number;
  averagePercent: number;
  totalTimeSeconds: number;
  timeline: Array<{
    id: string;
    quizTitle: string;
    subject: string;
    score: number;
    maxScore: number;
    submittedAt: string;
    status: AttemptStatus;
  }>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

function csrfToken() {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith("qm_csrf="))
    ?.split("=")[1];
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = csrfToken();
    if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
  }
  const response = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "include" });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.message === "string" ? body.message : "Request failed";
    throw new ApiError(response.status, message, body);
  }
  return body as T;
}

export const apiClient = {
  me: () => api<User>("/auth/me"),
  login: (input: { email: string; password: string }) =>
    api<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  register: (input: { email: string; displayName: string; password: string }) =>
    api<{ user: User }>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  logout: () => api<{ message: string }>("/auth/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    api<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    api<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
  subjects: () => api<Subject[]>("/subjects"),
  quiz: (id: string) => api<QuizDetail>(`/quizzes/${id}`),
  startAttempt: (quizId: string) => api<Attempt>(`/quizzes/${quizId}/attempts`, { method: "POST" }),
  attempt: (id: string) => api<Attempt>(`/attempts/${id}`),
  saveAnswer: (attemptId: string, questionId: string, answer: unknown, timeSpentSeconds: number) =>
    api(`/attempts/${attemptId}/answers/${questionId}`, {
      method: "PUT",
      body: JSON.stringify({ answer, timeSpentSeconds }),
    }),
  submitAttempt: (id: string) => api<{ id: string; status: AttemptStatus }>(`/attempts/${id}/submit`, { method: "POST" }),
  result: (id: string) => api<AttemptResult>(`/attempts/${id}/results`),
  learnerAnalytics: () => api<LearnerAnalytics>("/analytics/me"),
  adminAnalytics: () => api<Record<string, unknown>>("/admin/analytics"),
  adminUsers: () => api<Array<Record<string, unknown>>>("/admin/users"),
};
