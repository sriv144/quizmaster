import { apiClient } from "@quizmaster/api-client";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock3, Home, X } from "lucide-react";
import { Link, useParams } from "react-router";

export default function AttemptResult() {
  const { attemptId = "" } = useParams();
  const result = useQuery({ queryKey: ["result", attemptId], queryFn: () => apiClient.result(attemptId) });
  if (result.isPending) return <div className="screen-loader"><span /></div>;
  if (!result.data) return null;
  const percent = result.data.maxScore > 0 ? result.data.totalScore / result.data.maxScore * 100 : 0;
  const passed = percent >= result.data.quiz.passingPercent;
  return <div className="result-page">
    <header className="result-hero"><p className="eyebrow">Attempt complete</p><h1>{result.data.quiz.title}</h1><div className="result-score"><strong>{percent.toFixed(0)}%</strong><span>{result.data.totalScore.toFixed(1)} of {result.data.maxScore.toFixed(1)} points</span></div><span className={passed ? "pass-state passed" : "pass-state"}>{passed ? "Passed" : "Not passed"}</span></header>
    <div className="result-summary"><span><strong>{result.data.questionsCorrect}</strong><small>correct</small></span><span><strong>{result.data.questionsAnswered}</strong><small>answered</small></span><span><Clock3/><strong>{Math.round(result.data.timeSpentSeconds / 60)}m</strong><small>time spent</small></span></div>
    <section className="review-section"><div className="section-heading"><div><p className="eyebrow">Review</p><h2>Question breakdown</h2></div><Link className="button secondary" to="/app"><Home size={17}/> Dashboard</Link></div><div className="review-list">{result.data.questions.map((question) => <article key={question.id} className="review-row"><span className={question.isCorrect ? "review-icon correct" : "review-icon incorrect"}>{question.isCorrect ? <Check/> : <X/>}</span><div><small>Question {question.position}</small><h3>{question.prompt}</h3>{question.explanation && <p>{question.explanation}</p>}</div><strong>{question.marksAwarded > 0 ? "+" : ""}{question.marksAwarded}</strong></article>)}</div></section>
    {result.data.comments.length > 0 && <section className="feedback-section"><p className="eyebrow">Instructor feedback</p>{result.data.comments.map((comment) => <blockquote key={comment.id}>{comment.text}</blockquote>)}</section>}
  </div>;
}
