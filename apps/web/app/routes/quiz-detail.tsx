import { apiClient } from "@quizmaster/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3, ListChecks, RotateCcw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

export default function QuizDetail() {
  const { quizId = "" } = useParams();
  const navigate = useNavigate();
  const quiz = useQuery({ queryKey: ["quiz", quizId], queryFn: () => apiClient.quiz(quizId) });
  const start = useMutation({
    mutationFn: () => apiClient.startAttempt(quizId),
    onSuccess: (attempt) => navigate(`/attempts/${attempt.id}`),
  });
  if (quiz.isPending) return <div className="screen-loader"><span /></div>;
  if (!quiz.data) return null;
  return (
    <div className="detail-page">
      <Link to="/subjects" className="back-link"><ArrowLeft size={17} /> Back to subjects</Link>
      <p className="eyebrow">{quiz.data.chapter.subject.name} · {quiz.data.chapter.name}</p>
      <h1>{quiz.data.title}</h1>
      <p className="detail-lead">{quiz.data.description || "Review the details below before you begin."}</p>
      <div className="detail-facts">
        <span><ListChecks /> <strong>{quiz.data.questions.length}</strong><small>questions</small></span>
        <span><Clock3 /> <strong>{quiz.data.durationSeconds ? Math.ceil(quiz.data.durationSeconds / 60) : "No"}</strong><small>{quiz.data.durationSeconds ? "minutes" : "time limit"}</small></span>
        <span><RotateCcw /> <strong>{quiz.data.maxAttempts ?? "∞"}</strong><small>attempts</small></span>
      </div>
      <section className="instructions"><p className="eyebrow">Before you start</p><h2>Instructions</h2><p>{quiz.data.instructions || "Answer each question carefully. Your progress is saved as you move through the quiz."}</p></section>
      {start.error && <p className="form-error">{start.error.message}</p>}
      <button className="button primary large" onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending ? "Preparing attempt…" : "Start quiz"}</button>
    </div>
  );
}
