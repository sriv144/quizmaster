import { apiClient } from "@quizmaster/api-client";
import { useQuery } from "@tanstack/react-query";
import { BookMarked } from "lucide-react";
import { EmptyState, PageHeader, QuizRow } from "../components/ui.js";

export default function Subjects() {
  const query = useQuery({ queryKey: ["subjects"], queryFn: apiClient.subjects });
  return (
    <>
      <PageHeader eyebrow="Quiz catalog" title="Subjects and chapters" description="Find an available quiz by the topic you want to practise." />
      <div className="subject-list">
        {query.data?.map((subject) => (
          <section className="subject-section" key={subject.id}>
            <header><span className="subject-icon"><BookMarked /></span><div><h2>{subject.name}</h2><p>{subject.description}</p></div></header>
            {subject.chapters.map((chapter) => <div className="chapter-block" key={chapter.id}><h3>{chapter.name}</h3><div className="row-list">{chapter.quizzes.map((quiz) => <QuizRow quiz={quiz} key={quiz.id} />)}</div></div>)}
          </section>
        ))}
        {!query.isPending && query.data?.length === 0 && <EmptyState title="No subjects yet" detail="An administrator can publish content from the content workspace." />}
      </div>
    </>
  );
}
