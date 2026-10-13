import { apiClient } from "@quizmaster/api-client";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, FileQuestion, Users } from "lucide-react";
import { Link } from "react-router";
import { MetricStrip, PageHeader } from "../components/ui.js";

interface AdminSummary {
  learners: number;
  quizzes: number;
  questions: number;
  attempts: number;
  needsReview: number;
  recent: Array<{ id: string; status: string; totalScore: string; startedAt: string; user: { email: string; displayName: string | null }; quiz: { title: string } }>;
}

export default function AdminDashboard() {
  const query = useQuery({ queryKey: ["admin", "analytics"], queryFn: apiClient.adminAnalytics });
  const data = query.data as unknown as AdminSummary | undefined;
  return <>
    <PageHeader eyebrow="Administration" title="QuizMaster overview" description="Operational totals, migration review, and the latest learner activity." action={<Link className="button primary" to="/admin/content">Manage content</Link>} />
    <MetricStrip metrics={[{ label: "Learners", value: data?.learners ?? "—" }, { label: "Quizzes", value: data?.quizzes ?? "—" }, { label: "Questions", value: data?.questions ?? "—" }, { label: "Attempts", value: data?.attempts ?? "—" }]} />
    {(data?.needsReview ?? 0) > 0 && <div className="notice warning"><AlertCircle/> <span><strong>{data?.needsReview} migrated attempts need review.</strong> Their original grades remain unchanged.</span></div>}
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Recent activity</p><h2>Latest attempts</h2></div></div><div className="admin-table"><div className="table-head"><span>Learner</span><span>Quiz</span><span>Status</span><span>Date</span></div>{data?.recent.map((attempt) => <div className="table-row" key={attempt.id}><span><strong>{attempt.user.displayName ?? "Learner"}</strong><small>{attempt.user.email}</small></span><span>{attempt.quiz.title}</span><span><i className="status available">{attempt.status.replaceAll("_", " ")}</i></span><span>{new Date(attempt.startedAt).toLocaleDateString()}</span></div>)}</div></section>
    <div className="admin-shortcuts"><Link to="/admin/content"><BookOpen/><span><strong>Content workspace</strong><small>Subjects, chapters, quizzes, and questions</small></span></Link><Link to="/admin/users"><Users/><span><strong>Learner accounts</strong><small>Access, activity, and reset status</small></span></Link><Link to="/admin/content"><FileQuestion/><span><strong>Publishing queue</strong><small>Review drafts before learners see them</small></span></Link></div>
  </>;
}
