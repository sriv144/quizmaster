import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  layout("routes/learner-layout.tsx", [
    route("app", "routes/learner-dashboard.tsx"),
    route("subjects", "routes/subjects.tsx"),
    route("quizzes/:quizId", "routes/quiz-detail.tsx"),
    route("attempts/:attemptId", "routes/attempt-player.tsx"),
    route("results/:attemptId", "routes/attempt-result.tsx"),
    route("analytics", "routes/learner-analytics.tsx"),
  ]),
  layout("routes/admin-layout.tsx", [
    route("admin", "routes/admin-dashboard.tsx"),
    route("admin/content", "routes/admin-content.tsx"),
    route("admin/users", "routes/admin-users.tsx"),
  ]),
] satisfies RouteConfig;
