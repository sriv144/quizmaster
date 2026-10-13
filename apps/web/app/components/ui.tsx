import { ArrowUpRight, Clock3, FileQuestion, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { QuizSummary } from "@quizmaster/api-client";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</header>;
}

export function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: ReactNode; detail?: string }> }) {
  return <section className="metric-strip">{metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong>{metric.detail && <small>{metric.detail}</small>}</div>)}</section>;
}

export function QuizRow({ quiz }: { quiz: QuizSummary }) {
  const now = Date.now();
  const closed = quiz.closesAt ? new Date(quiz.closesAt).getTime() <= now : false;
  const scheduled = quiz.opensAt ? new Date(quiz.opensAt).getTime() > now : false;
  const state = closed ? "Closed" : scheduled ? "Scheduled" : "Available";
  return (
    <Link className="quiz-row" to={`/quizzes/${quiz.id}`}>
      <span className="quiz-symbol"><FileQuestion /></span>
      <span className="quiz-copy"><strong>{quiz.title}</strong><small>{quiz.description || "No description provided"}</small></span>
      <span className={`status ${state.toLowerCase()}`}>{state}</span>
      <span className="quiz-meta"><Clock3 size={15} /> {quiz.durationSeconds ? `${Math.ceil(quiz.durationSeconds / 60)} min` : "Untimed"}</span>
      <span className="quiz-meta"><Trophy size={15} /> {quiz._count.questions} questions</span>
      <ArrowUpRight className="row-arrow" />
    </Link>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span>∅</span><h3>{title}</h3><p>{detail}</p></div>;
}
