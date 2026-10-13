import * as Dialog from "@radix-ui/react-dialog";
import { apiClient, type AttemptQuestion } from "@quizmaster/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock3, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

export default function AttemptPlayer() {
  const { attemptId = "" } = useParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["attempt", attemptId], queryFn: () => apiClient.attempt(attemptId), refetchInterval: 30_000 });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const enteredAt = useRef(Date.now());
  const autoSubmitted = useRef(false);
  const save = useMutation({ mutationFn: ({ questionId, answer, time }: { questionId: string; answer: unknown; time: number }) => apiClient.saveAnswer(attemptId, questionId, answer, time) });
  const saveAnswer = save.mutate;
  const submit = useMutation({
    mutationFn: () => apiClient.submitAttempt(attemptId),
    onSuccess: () => navigate(`/results/${attemptId}`),
  });
  const submitAttempt = submit.mutate;

  useEffect(() => {
    if (!query.data) return;
    setAnswers(Object.fromEntries(query.data.questions.map((question) => [question.id, question.answer])));
  }, [query.data]);

  const activeQuestionId = query.data?.questions[index]?.id;
  const activeAnswer = activeQuestionId ? answers[activeQuestionId] : undefined;
  useEffect(() => {
    if (!activeQuestionId || !hasAnswer(activeAnswer)) return;
    const timeout = window.setTimeout(() => {
      saveAnswer({
        questionId: activeQuestionId,
        answer: activeAnswer,
        time: Math.max(0, Math.round((Date.now() - enteredAt.current) / 1000)),
      });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [activeAnswer, activeQuestionId, saveAnswer]);

  useEffect(() => {
    const expiresAt = query.data?.expiresAt;
    if (!expiresAt) { setRemaining(null); return; }
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        submitAttempt();
      }
    };
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [query.data?.expiresAt, submitAttempt]);

  if (query.isPending) return <div className="screen-loader"><span /></div>;
  const attempt = query.data;
  if (!attempt) return null;
  const question = attempt.questions[index];
  if (!question) return null;
  const unanswered = attempt.questions.filter((item) => !hasAnswer(answers[item.id])).length;

  const persistCurrent = async () => {
    const elapsed = Math.max(0, Math.round((Date.now() - enteredAt.current) / 1000));
    const answer = answers[question.id];
    if (hasAnswer(answer)) await save.mutateAsync({ questionId: question.id, answer, time: elapsed });
    enteredAt.current = Date.now();
  };
  const move = async (next: number) => {
    await persistCurrent();
    setIndex(Math.max(0, Math.min(next, attempt.questions.length - 1)));
  };
  const update = (value: unknown) => setAnswers((current) => ({ ...current, [question.id]: value }));

  return (
    <div className="attempt-page">
      <header className="attempt-header">
        <div><p className="eyebrow">Attempt in progress</p><h1>{attempt.quiz.title}</h1></div>
        <div className={remaining !== null && remaining < 60 ? "attempt-timer urgent" : "attempt-timer"}><Clock3 /> <strong>{remaining === null ? "Untimed" : formatTime(remaining)}</strong><small>remaining</small></div>
      </header>
      <div className="attempt-layout">
        <aside className="question-navigator">
          <div className="navigator-heading"><span>{attempt.questions.length} questions</span><span>{attempt.questions.length - unanswered} answered</span></div>
          <div className="question-dots">{attempt.questions.map((item, itemIndex) => <button key={item.id} className={`${itemIndex === index ? "current" : ""} ${hasAnswer(answers[item.id]) ? "answered" : ""}`} onClick={() => move(itemIndex)} aria-label={`Question ${itemIndex + 1}`}>{hasAnswer(answers[item.id]) && itemIndex !== index ? <Check size={14} /> : itemIndex + 1}</button>)}</div>
          <div className="save-state">{save.isPending ? "Saving answer…" : save.isError ? "Answer not saved" : "Progress saved"}</div>
        </aside>
        <section className="question-workspace">
          <AnimatePresence mode="wait">
            <motion.div key={question.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              <p className="eyebrow">Question {index + 1} of {attempt.questions.length} · {Number(question.marks)} points</p>
              <h2>{question.prompt}</h2>
              <AnswerField question={question} value={answers[question.id]} onChange={update} />
            </motion.div>
          </AnimatePresence>
          <footer className="question-actions">
            <button className="button secondary" onClick={() => move(index - 1)} disabled={index === 0}><ArrowLeft size={17} /> Previous</button>
            {index < attempt.questions.length - 1 ? <button className="button primary" onClick={() => move(index + 1)}>Save & next <ArrowRight size={17} /></button> : <button className="button primary" onClick={async () => { await persistCurrent(); setConfirmOpen(true); }}><Send size={17} /> Review & submit</button>}
          </footer>
        </section>
      </div>
      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content"><Dialog.Close className="dialog-close"><X /></Dialog.Close><span className="dialog-icon"><AlertTriangle /></span><Dialog.Title>Submit this attempt?</Dialog.Title><Dialog.Description>{unanswered ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered.` : "Every question has an answer."} You cannot edit the attempt after submission.</Dialog.Description><div className="dialog-actions"><Dialog.Close className="button secondary">Keep working</Dialog.Close><button className="button primary" onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit attempt"}</button></div></Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function AnswerField({ question, value, onChange }: { question: AttemptQuestion; value: unknown; onChange: (value: unknown) => void }) {
  if (question.type === "INTEGER") return <label className="integer-answer">Your answer<input type="number" value={typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /></label>;
  if (question.type === "TRUE_FALSE") return <div className="answer-options">{[true, false].map((option) => <button key={String(option)} className={value === option ? "answer-option selected" : "answer-option"} onClick={() => onChange(option)}><span>{value === option && <Check />}</span>{option ? "True" : "False"}</button>)}</div>;
  const selected = question.type === "MULTIPLE_CHOICE" && Array.isArray(value) ? value as string[] : [];
  return <div className="answer-options">{question.options?.map((option) => {
    const active = question.type === "MULTIPLE_CHOICE" ? selected.includes(option.id) : value === option.id;
    return <button key={option.id} className={active ? "answer-option selected" : "answer-option"} onClick={() => {
      if (question.type === "MULTIPLE_CHOICE") onChange(active ? selected.filter((id) => id !== option.id) : [...selected, option.id]);
      else onChange(option.id);
    }}><span>{active && <Check />}</span>{option.text}</button>;
  })}</div>;
}

function hasAnswer(value: unknown) { return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== ""; }
function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
