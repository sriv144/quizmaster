import { api, apiClient, type QuestionType, type Subject } from "@quizmaster/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "../components/ui.js";

export default function AdminContent() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["subjects"], queryFn: apiClient.subjects });
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [mode, setMode] = useState<"subject" | "chapter" | "quiz" | "question" | null>(null);
  const invalidate = () => client.invalidateQueries({ queryKey: ["subjects"] });
  const mutation = useMutation({
    mutationFn: ({ path, body, method = "POST" }: { path: string; body: unknown; method?: string }) => api(path, { method, body: JSON.stringify(body) }),
    onSuccess: async () => { setMode(null); await invalidate(); },
  });
  const quiz = useMemo(() => query.data?.flatMap((subject) => subject.chapters.flatMap((chapter) => chapter.quizzes)).find((item) => item.id === selectedQuiz), [query.data, selectedQuiz]);
  return <>
    <PageHeader eyebrow="Content workspace" title="Subjects, quizzes, and questions" description="Build in draft, review the answer key, then publish to learners." action={<button className="button primary" onClick={() => setMode("subject")}><Plus size={17}/> New subject</button>} />
    <div className="content-workspace">
      <aside className="content-tree">
        {query.data?.map((subject) => <SubjectTree key={subject.id} subject={subject} selectedQuiz={selectedQuiz} onSelect={setSelectedQuiz}/>) }
      </aside>
      <section className="content-editor">
        {!quiz ? <div className="empty-editor"><span>QM</span><h2>Select a quiz to edit</h2><p>Choose an item from the content hierarchy or create a new subject.</p></div> : <><div className="editor-header"><div><p className="eyebrow">{quiz.status}</p><h2>{quiz.title}</h2><p>{quiz.description}</p></div><div className="button-row"><button className="button secondary" onClick={() => setMode("question")}><Plus size={17}/> Add question</button>{quiz.status !== "PUBLISHED" && <button className="button primary" onClick={() => mutation.mutate({ path: `/admin/quizzes/${quiz.id}`, method: "PATCH", body: { status: "PUBLISHED" } })}><Check size={17}/> Publish</button>}</div></div><div className="editor-facts"><span><strong>{quiz._count.questions}</strong><small>questions</small></span><span><strong>{quiz.durationSeconds ? Math.ceil(quiz.durationSeconds / 60) : "—"}</strong><small>minutes</small></span><span><strong>{quiz.maxAttempts ?? "∞"}</strong><small>attempts</small></span></div><p className="editor-note">Open the learner preview from the quiz catalog after publishing. Existing attempts retain their own question snapshots when this quiz changes.</p></>}
      </section>
    </div>
    <div className="content-actions"><button onClick={() => setMode("chapter")} disabled={!query.data?.length}>New chapter</button><button onClick={() => setMode("quiz")} disabled={!query.data?.some((s) => s.chapters.length)}>New quiz</button></div>
    {mode && <EditorDrawer mode={mode} subjects={query.data ?? []} quizId={selectedQuiz} busy={mutation.isPending} error={mutation.error?.message} onClose={() => setMode(null)} onSubmit={(path, body) => mutation.mutate({ path, body })}/>}
  </>;
}

function SubjectTree({ subject, selectedQuiz, onSelect }: { subject: Subject; selectedQuiz: string | null; onSelect: (id: string) => void }) {
  return <div className="tree-subject"><strong>{subject.name}</strong>{subject.chapters.map((chapter) => <div key={chapter.id} className="tree-chapter"><span>{chapter.name}</span>{chapter.quizzes.map((quiz) => <button key={quiz.id} className={selectedQuiz === quiz.id ? "selected" : ""} onClick={() => onSelect(quiz.id)}><ChevronRight size={14}/>{quiz.title}<i className={`dot ${quiz.status.toLowerCase()}`}/></button>)}</div>)}</div>;
}

function EditorDrawer({ mode, subjects, quizId, busy, error, onClose, onSubmit }: { mode: "subject" | "chapter" | "quiz" | "question"; subjects: Subject[]; quizId: string | null; busy: boolean; error?: string | undefined; onClose: () => void; onSubmit: (path: string, body: unknown) => void }) {
  const [questionType, setQuestionType] = useState<QuestionType>("SINGLE_CHOICE");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (mode === "subject") onSubmit("/admin/subjects", { name: data.get("name"), description: data.get("description"), code: data.get("code") || undefined });
    if (mode === "chapter") onSubmit("/admin/chapters", { subjectId: data.get("subjectId"), name: data.get("name"), description: data.get("description") });
    if (mode === "quiz") onSubmit("/admin/quizzes", { chapterId: data.get("chapterId"), title: data.get("title"), description: data.get("description"), durationSeconds: Number(data.get("durationMinutes")) * 60, maxAttempts: Number(data.get("maxAttempts")) });
    if (mode === "question" && quizId) {
      const rawOptions = String(data.get("options") ?? "").split("\n").map((value) => value.trim()).filter(Boolean);
      const correct = String(data.get("correct") ?? "");
      const correctIndexes = correct.split(",").map((value) => Number(value.trim()) - 1);
      onSubmit(`/admin/quizzes/${quizId}/questions`, {
        prompt: data.get("prompt"), type: questionType, difficulty: data.get("difficulty"), marks: Number(data.get("marks")), negativeMarks: Number(data.get("negativeMarks")),
        ...(questionType === "INTEGER" ? { correctInteger: Number(correct) } : {}),
        ...(questionType === "TRUE_FALSE" ? { correctBoolean: correct === "true" } : {}),
        ...(questionType.includes("CHOICE") ? { options: rawOptions.map((text, index) => ({ text, position: index + 1, isCorrect: correctIndexes.includes(index) })) } : {}),
      });
    }
  };
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="editor-drawer"><p className="eyebrow">Create content</p><h2>New {mode}</h2><form className="form-stack" onSubmit={submit}>
    {mode === "subject" && <><label>Name<input name="name" required/></label><label>Code<input name="code"/></label><label>Description<textarea name="description" rows={4}/></label></>}
    {mode === "chapter" && <><label>Subject<select name="subjectId" required>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label>Name<input name="name" required/></label><label>Description<textarea name="description" rows={4}/></label></>}
    {mode === "quiz" && <><label>Chapter<select name="chapterId" required>{subjects.flatMap((subject) => subject.chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{subject.name} · {chapter.name}</option>))}</select></label><label>Title<input name="title" required/></label><label>Description<textarea name="description" rows={3}/></label><div className="form-grid"><label>Minutes<input name="durationMinutes" type="number" min="1" defaultValue="30"/></label><label>Attempts<input name="maxAttempts" type="number" min="1" defaultValue="1"/></label></div></>}
    {mode === "question" && <><label>Question<textarea name="prompt" rows={5} required/></label><label>Type<select value={questionType} onChange={(event) => setQuestionType(event.target.value as QuestionType)}><option value="SINGLE_CHOICE">Single choice</option><option value="MULTIPLE_CHOICE">Multiple choice</option><option value="INTEGER">Integer</option><option value="TRUE_FALSE">True / false</option></select></label>{questionType.includes("CHOICE") && <label>Options <small>one per line</small><textarea name="options" rows={5} required/></label>}<label>{questionType.includes("CHOICE") ? "Correct option number(s)" : "Correct answer"}<input name="correct" placeholder={questionType === "MULTIPLE_CHOICE" ? "1, 3" : questionType === "TRUE_FALSE" ? "true" : "1"} required/></label><div className="form-grid"><label>Difficulty<select name="difficulty"><option>Easy</option><option>Medium</option><option>Hard</option></select></label><label>Marks<input name="marks" type="number" min="0.01" step="0.01" defaultValue="1"/></label><label>Penalty<input name="negativeMarks" type="number" min="0" step="0.01" defaultValue="0"/></label></div></>}
    {error && <p className="form-error">{error}</p>}<div className="drawer-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : `Create ${mode}`}</button></div>
  </form></aside></div>;
}
