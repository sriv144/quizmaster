import { apiClient } from "@quizmaster/api-client";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../lib/auth.js";
import { EmptyState, MetricStrip, PageHeader, QuizRow } from "../components/ui.js";

export default function LearnerDashboard() {
  const auth = useAuth();
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: apiClient.subjects });
  const analytics = useQuery({ queryKey: ["analytics", "me"], queryFn: apiClient.learnerAnalytics });
  const quizzes = subjects.data?.flatMap((subject) => subject.chapters.flatMap((chapter) => chapter.quizzes)) ?? [];
  return (
    <>
      <PageHeader eyebrow="Learner dashboard" title={`Good to see you, ${auth.data?.displayName?.split(" ")[0] ?? "learner"}.`} description="Continue an assessment or review how your recent work is trending." />
      <MetricStrip metrics={[
        { label: "Completed", value: analytics.data?.completed ?? "—", detail: "all attempts" },
        { label: "Average", value: analytics.data ? `${analytics.data.averagePercent.toFixed(1)}%` : "—", detail: "graded work" },
        { label: "Study time", value: analytics.data ? `${Math.round(analytics.data.totalTimeSeconds / 60)}m` : "—", detail: "across quizzes" },
      ]} />
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Ready now</p><h2>Available quizzes</h2></div><Link to="/subjects" className="text-link">Browse subjects <ArrowRight size={16} /></Link></div>
        <div className="row-list">
          {quizzes.slice(0, 6).map((quiz) => <QuizRow key={quiz.id} quiz={quiz} />)}
          {!subjects.isPending && quizzes.length === 0 && <EmptyState title="No quizzes available" detail="Published quizzes will appear here when they open." />}
        </div>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Recent work</p><h2>Latest results</h2></div><Link to="/analytics" className="text-link">View progress <ArrowRight size={16} /></Link></div>
        <div className="result-list">
          {analytics.data?.timeline.slice(0, 5).map((item) => (
            <Link to={`/results/${item.id}`} key={item.id} className="result-row">
              <span><strong>{item.quizTitle}</strong><small>{item.subject}</small></span>
              <span className="score-text">{item.score.toFixed(1)} / {item.maxScore.toFixed(1)}</span>
              <time>{new Date(item.submittedAt).toLocaleDateString()}</time>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
