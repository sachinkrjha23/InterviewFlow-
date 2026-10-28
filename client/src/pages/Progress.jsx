import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Navbar from "../components/Navbar";
import { serverUrl } from "../config";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({ title, note, children }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      <div className="mt-4 h-64">{children}</div>
    </section>
  );
}

function Tile({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone || "text-ink"}`}>{value}</p>
    </div>
  );
}

function Progress() {
  const [points, setPoints] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${serverUrl}/api/interview/progress`, { withCredentials: true })
      .then((res) => {
        if (!cancelled) setPoints(res.data.points || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load your progress.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = (points || []).map((p) => ({ ...p, date: fmtDate(p.createdAt) }));
  const spoken = data.filter((p) => p.wpm !== null);
  const first = data[0];
  const last = data[data.length - 1];
  const change = first && last ? Math.round((last.finalScore - first.finalScore) * 10) / 10 : 0;
  const best = data.length ? Math.max(...data.map((p) => p.finalScore)) : 0;

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Your progress</h1>
        <p className="mt-1 text-sm text-muted">
          How your scores and speaking change across your completed interviews.
        </p>

        {error ? (
          <p role="alert" className="mt-6 rounded-xl bg-rose-soft px-4 py-3 text-sm text-rose-deep">
            {error}
          </p>
        ) : points === null ? (
          <div className="mt-6 space-y-4" role="status" aria-label="Loading progress">
            <div className="h-24 animate-pulse rounded-2xl bg-line" />
            <div className="h-64 animate-pulse rounded-2xl bg-line" />
          </div>
        ) : data.length < 2 ? (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-10 text-center">
            <p className="text-muted">
              Complete at least two interviews to see how you are improving.
              {data.length === 1 ? " You have one so far." : ""}
            </p>
            <Link
              to="/interview"
              className="mt-4 inline-block rounded-lg bg-indigo px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Start an interview
            </Link>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 space-y-5"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Completed interviews" value={data.length} />
              <Tile label="Best score" value={best.toFixed(1)} tone="text-teal-deep" />
              <Tile label="Latest score" value={last.finalScore.toFixed(1)} />
              <Tile
                label="Change since your first"
                value={`${change > 0 ? "+" : ""}${change.toFixed(1)}`}
                tone={change >= 0 ? "text-teal-deep" : "text-rose-deep"}
              />
            </div>

            <ChartCard title="Overall score" note="Out of 10, oldest to newest (last 20 interviews).">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="finalScore"
                    name="Score"
                    stroke="var(--color-indigo)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Confidence, communication and correctness" note="Average per interview.">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="confidence" name="Confidence" stroke="var(--color-sky)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="communication" name="Communication" stroke="var(--color-violet)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="correctness" name="Correctness" stroke="var(--color-teal)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {spoken.length >= 2 && (
              <div className="grid gap-5 md:grid-cols-2">
                <ChartCard title="Speaking pace" note="Words per minute across voice answers. About 110 to 165 is comfortable.">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={spoken} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="var(--color-line)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="wpm" name="Words per minute" stroke="var(--color-sky)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Filler words" note="Average per recorded answer. Lower is better.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spoken} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="var(--color-line)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="fillersPerAnswer" name="Fillers per answer" fill="var(--color-amber)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default Progress;