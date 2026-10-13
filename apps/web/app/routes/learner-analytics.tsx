import { apiClient } from "@quizmaster/api-client";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricStrip, PageHeader } from "../components/ui.js";

export default function LearnerAnalytics() {
  const analytics = useQuery({ queryKey: ["analytics", "me"], queryFn: apiClient.learnerAnalytics });
  const chart = [...(analytics.data?.timeline ?? [])].reverse().map((item) => ({
    name: item.quizTitle,
    percent: item.maxScore > 0 ? Math.round(item.score / item.maxScore * 100) : 0,
  }));
  return (
    <>
      <PageHeader eyebrow="Progress" title="Performance over time" description="Scores are calculated from finalized attempts only." />
      <MetricStrip metrics={[
        { label: "Attempts", value: analytics.data?.completed ?? "—" },
        { label: "Average accuracy", value: analytics.data ? `${analytics.data.averagePercent.toFixed(1)}%` : "—" },
        { label: "Total time", value: analytics.data ? `${Math.round(analytics.data.totalTimeSeconds / 60)} min` : "—" },
      ]} />
      <section className="chart-section"><div className="section-heading"><div><p className="eyebrow">Trend</p><h2>Score percentage</h2></div></div><div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#66d9e8" stopOpacity={0.35}/><stop offset="1" stopColor="#66d9e8" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#25313a" vertical={false}/><XAxis dataKey="name" hide/><YAxis domain={[0, 100]} tick={{ fill: "#82909c" }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "#111a20", border: "1px solid #2a3943", borderRadius: 8 }}/><Area type="monotone" dataKey="percent" stroke="#66d9e8" strokeWidth={3} fill="url(#scoreFill)"/></AreaChart></ResponsiveContainer>
      </div></section>
    </>
  );
}
