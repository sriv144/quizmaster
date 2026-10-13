import { motion } from "framer-motion";
import { BrainCircuit, CheckCircle2, TimerReset } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

export function AuthFrame({ eyebrow, title, description, children, footer }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-poster" aria-label="QuizMaster introduction">
        <Link to="/" className="brand light"><span className="brand-mark"><span /><span /><span /></span> QuizMaster</Link>
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }} className="poster-copy">
          <motion.p variants={lineMotion} className="eyebrow">Learn with intent</motion.p>
          <motion.h2 variants={lineMotion}>Every answer becomes a clearer next step.</motion.h2>
          <motion.p variants={lineMotion}>Focused assessments, honest progress, and feedback that stays useful.</motion.p>
        </motion.div>
        <div className="poster-proof">
          <span><BrainCircuit /> Structured practice</span>
          <span><TimerReset /> Reliable timing</span>
          <span><CheckCircle2 /> Clear feedback</span>
        </div>
      </section>
      <section className="auth-panel">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="auth-content">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </motion.div>
      </section>
    </main>
  );
}

const lineMotion = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};
