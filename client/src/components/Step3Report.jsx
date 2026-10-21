import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { FaArrowLeft, FaChevronDown, FaDownload } from "react-icons/fa";
import ScoreChart from "./ScoreChart";
import { generateReportPdf } from "../utils/generateReportPdf";
import { fetchModelAnswers } from "../utils/reportApi";
import { deliverySummary, paceLabel, summarizeDelivery } from "../utils/delivery";

const toneFor = (score) =>
  score >= 7
    ? { soft: "bg-teal-soft", text: "text-teal-deep", stroke: "stroke-teal" }
    : score >= 4
      ? { soft: "bg-amber-soft", text: "text-amber-deep", stroke: "stroke-amber" }
      : { soft: "bg-rose-soft", text: "text-rose-deep", stroke: "stroke-rose" };

const gradeFor = (score) =>
  score >= 9 ? "Outstanding" : score >= 8 ? "Excellent" : score >= 7 ? "Good" : score >= 5 ? "Average" : "Needs work";

const METRICS = [
  { key: "confidence", label: "Confidence", tile: "bg-sky-soft text-sky-deep", bar: "bg-sky" },
  { key: "communication", label: "Communication", tile: "bg-violet-soft text-violet-deep", bar: "bg-violet" },
  { key: "correctness", label: "Correctness", tile: "bg-teal-soft text-teal-deep", bar: "bg-teal" },
];

const MODEL_ERROR = "Couldn't prepare the model answer. Please try again.";

const SPRING = { type: "spring", stiffness: 400, damping: 17 };

function Step3Report({ report, interviewId, onRestart }) {
  const [modelAnswers, setModelAnswers] = useState(() => {
    const initial = {};
    (report?.questionWiseScore || []).forEach((q, i) => {
      if (q.modelAnswer) initial[q.index ?? i] = q.modelAnswer;
    });
    return initial;
  });
  const [open, setOpen] = useState({});
  const [loadingKey, setLoadingKey] = useState(null);
  const [errors, setErrors] = useState({});
  const [downloading, setDownloading] = useState(false);
  const [pdfNote, setPdfNote] = useState("");

  if (!report) return null;

  const {
    role,
    experience,
    mode,
    createdAt,
    finalScore = 0,
    questionWiseScore = [],
  } = report;

  const id = interviewId || report.interviewId;
  const isIncomplete = report.status === "Incomplete";
  const overall = toneFor(Number(finalScore));
  const questions = questionWiseScore.map((q, i) => ({ ...q, key: q.index ?? i }));
  const allPrepared = questions.length > 0 && questions.every((q) => modelAnswers[q.key]);
  const allOpen = allPrepared && questions.every((q) => open[q.key]);
  const busy = loadingKey !== null;

  let performanceText;
  let shortTagline;
  if (isIncomplete) {
    performanceText = "Interview not finished";
    shortTagline = `You answered ${questions.length} of ${report.totalQuestions || 6} questions, so scores only reflect those.`;
  } else if (finalScore >= 8) {
    performanceText = "Strong performance.";
    shortTagline = "Clear, well-structured answers.";
  } else if (finalScore >= 5) {
    performanceText = "Solid base, room to improve.";
    shortTagline = "Add more specifics and examples to strengthen your answers.";
  } else {
    performanceText = "Needs more practice.";
    shortTagline = "Focus on clarity, structure and confidence.";
  }

  // numbering that skips follow-ups: Question 1, Question 2, Follow-up, Question 3 ...
  let mainCount = 0;
  const labels = questions.map((q) =>
    q.isFollowUp
      ? { long: "Follow-up", short: `Q${mainCount}+` }
      : { long: `Question ${++mainCount}`, short: `Q${mainCount}` },
  );
  const chartData = questions.map((q, i) => ({ name: labels[i].short, score: q.score ?? 0 }));
  const delivery = summarizeDelivery(questions);

  const toggleModelAnswer = async (key) => {
    if (loadingKey !== null) return;
    if (modelAnswers[key]) {
      setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
      return;
    }
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setLoadingKey(key);
    try {
      const result = await fetchModelAnswers(id, key);
      if (result[key]) {
        setModelAnswers((prev) => ({ ...prev, ...result }));
        setOpen((prev) => ({ ...prev, [key]: true }));
      } else {
        setErrors((prev) => ({ ...prev, [key]: MODEL_ERROR }));
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, [key]: error.response?.data?.message || MODEL_ERROR }));
    } finally {
      setLoadingKey(null);
    }
  };

  const toggleAll = async () => {
    if (loadingKey !== null) return;
    if (allPrepared) {
      const next = !allOpen;
      setOpen(Object.fromEntries(questions.map((q) => [q.key, next])));
      return;
    }
    setErrors({});
    setLoadingKey("all");
    try {
      const result = await fetchModelAnswers(id);
      setModelAnswers((prev) => ({ ...prev, ...result }));
      setOpen(Object.fromEntries(questions.filter((q) => result[q.key]).map((q) => [q.key, true])));
    } catch (error) {
      setErrors({ all: error.response?.data?.message || MODEL_ERROR });
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    setPdfNote("");

    let answers = modelAnswers;
    if (!allPrepared && id) {
      try {
        const result = await fetchModelAnswers(id);
        answers = { ...modelAnswers, ...result };
        setModelAnswers(answers);
      } catch {
        setPdfNote("Some model answers couldn't be prepared, so the PDF is missing them.");
      }
    }

    try {
      await generateReportPdf({
        ...report,
        questionWiseScore: questions.map((q) => ({ ...q, modelAnswer: answers[q.key] || "" })),
      });
    } catch {
      setPdfNote("Failed to generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const actionButton =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link to="/history" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
        <FaArrowLeft size={12} aria-hidden="true" />
        Back to history
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium text-ink">{role || "Interview report"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            {experience && <span>{experience}</span>}
            {mode && (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                  mode === "HR" ? "bg-violet-soft text-violet-deep" : "bg-indigo-soft text-indigo-deep"
                }`}
              >
                {mode}
              </span>
            )}
            {createdAt && (
              <span>
                {new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <motion.button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            whileHover={downloading ? undefined : { scale: 1.03 }}
            whileTap={downloading ? undefined : { scale: 0.97 }}
            transition={SPRING}
            className={`${actionButton} bg-indigo text-white hover:opacity-90`}
          >
            <FaDownload size={13} aria-hidden="true" />
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </motion.button>
          {onRestart ? (
            <motion.button
              type="button"
              onClick={onRestart}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING}
              className={`${actionButton} border border-line-strong bg-surface text-ink hover:bg-canvas`}
            >
              New interview
            </motion.button>
          ) : (
            <Link to="/interview" className={`${actionButton} border border-line-strong bg-surface text-ink hover:bg-canvas`}>
              New interview
            </Link>
          )}
        </div>
      </div>

      {pdfNote && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber-deep">
          {pdfNote}
        </p>
      )}

      {isIncomplete && (
        <p className="mt-4 rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber-deep">
          This interview wasn't finished. Scores only reflect the questions you answered.
        </p>
      )}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-6 rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex flex-col items-center gap-8 md:flex-row">
          <div className="relative h-36 w-36 shrink-0">
            <svg className="h-36 w-36 -rotate-90" viewBox="0 0 160 160" aria-hidden="true">
              <circle cx="80" cy="80" r="70" className="fill-none stroke-line" strokeWidth="12" />
              <circle
                cx="80"
                cy="80"
                r="70"
                className={`fill-none ${overall.stroke}`}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(Math.max(0, Math.min(10, finalScore)) / 10) * 440} 440`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-medium text-ink">{Number(finalScore).toFixed(1)}</span>
              <span className="text-xs text-muted">out of 10</span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${overall.soft} ${overall.text}`}>
              {gradeFor(finalScore)}
            </span>
            <h2 className="mt-3 text-xl font-medium text-ink">{performanceText}</h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{shortTagline}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {METRICS.map((m) => {
            const value = Number(report[m.key] ?? 0);
            return (
              <div key={m.key} className={`rounded-xl p-4 ${m.tile}`}>
                <p className="text-xs">{m.label}</p>
                <p className="mt-0.5 text-2xl font-medium">
                  {value.toFixed(1)}
                  <span className="text-sm font-normal"> / 10</span>
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-surface">
                  <div className={`h-1.5 rounded-full ${m.bar}`} style={{ width: `${Math.max(0, Math.min(10, value)) * 10}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      <div className="mt-6">
        <ScoreChart data={chartData} />
      </div>

      {delivery && (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-medium text-ink">Speaking delivery</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-sky-soft p-4 text-sky-deep">
              <p className="text-xs">Pace</p>
              <p className="mt-0.5 text-2xl font-medium">
                {delivery.wpm > 0 ? delivery.wpm : "—"}
                <span className="text-sm font-normal"> wpm</span>
              </p>
              <p className="text-xs">{paceLabel(delivery.wpm) || "Not enough speech to measure"}</p>
            </div>
            <div className="rounded-xl bg-violet-soft p-4 text-violet-deep">
              <p className="text-xs">Filler words</p>
              <p className="mt-0.5 text-2xl font-medium">{delivery.fillerCount}</p>
              <p className="text-xs">{delivery.topFillers.join(", ") || "None detected"}</p>
            </div>
            <div className="rounded-xl bg-amber-soft p-4 text-amber-deep">
              <p className="text-xs">Long pauses</p>
              <p className="mt-0.5 text-2xl font-medium">{delivery.longPauseCount}</p>
              <p className="text-xs">1.5 seconds or more</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Based on {delivery.answers} recorded answer{delivery.answers === 1 ? "" : "s"}. A comfortable
            interview pace is roughly 110 to 165 words per minute. Filler counts depend on the
            transcription and can be lower than the real number.
          </p>
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">Detailed breakdown</h2>
        {questions.length > 0 && (
          <motion.button
            type="button"
            onClick={toggleAll}
            disabled={busy}
            whileHover={busy ? undefined : { scale: 1.03 }}
            whileTap={busy ? undefined : { scale: 0.97 }}
            transition={SPRING}
            className={`${actionButton} bg-violet-soft text-violet-deep hover:opacity-90`}
          >
            {loadingKey === "all" ? "Preparing model answers…" : allOpen ? "Hide all model answers" : "Show all model answers"}
          </motion.button>
        )}
      </div>
      {errors.all && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-soft px-4 py-3 text-sm text-rose-deep">
          {errors.all}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const t = toneFor(Number(q.score ?? 0));
          const isOpen = !!open[q.key] && !!modelAnswers[q.key];
          const isLoading = loadingKey === q.key;
          return (
            <motion.article
              key={q.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.05 }}
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-indigo-deep">
                    {labels[i].long}
                    {q.difficulty && <span className="font-normal text-muted"> · {q.difficulty}</span>}
                  </p>
                  <h3 className="mt-1 font-medium leading-relaxed text-ink">{q.question}</h3>
                </div>
                <span className={`rounded-md px-2.5 py-1 text-sm font-medium ${t.soft} ${t.text}`}>
                  {q.score ?? 0} / 10
                </span>
              </div>

              <div className="mt-4 rounded-xl bg-canvas p-4">
                <p className="text-xs font-medium text-muted">Your answer</p>
                {q.answer && q.answer.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{q.answer}</p>
                ) : (
                  <p className="mt-1 text-sm italic text-muted">No answer submitted.</p>
                )}
                {q.delivery && q.delivery.wordCount > 0 && (
                  <p className="mt-2 text-xs text-sky-deep">Delivery: {deliverySummary(q.delivery)}</p>
                )}
              </div>

              {q.feedback && (
                <div className="mt-3 rounded-xl bg-indigo-soft p-4">
                  <p className="text-xs font-medium text-indigo-deep">Feedback</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{q.feedback}</p>
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2">
                {METRICS.map((m) => (
                  <div key={m.key} className={`rounded-lg px-2 py-2 text-center ${m.tile}`}>
                    <p className="text-base font-medium">{q[m.key] ?? 0}</p>
                    <p className="text-[11px]">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <motion.button
                  type="button"
                  onClick={() => toggleModelAnswer(q.key)}
                  disabled={busy}
                  aria-expanded={isOpen}
                  aria-controls={`model-answer-${q.key}`}
                  whileHover={busy ? undefined : { scale: 1.03 }}
                  whileTap={busy ? undefined : { scale: 0.97 }}
                  transition={SPRING}
                  className={`${actionButton} bg-violet-soft py-2 text-violet-deep hover:opacity-90`}
                >
                  {isLoading ? "Preparing model answer…" : isOpen ? "Hide model answer" : "Show model answer"}
                  <FaChevronDown
                    size={11}
                    aria-hidden="true"
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </motion.button>

                {errors[q.key] && (
                  <p role="alert" className="mt-3 rounded-lg bg-rose-soft px-4 py-3 text-sm text-rose-deep">
                    {errors[q.key]}
                  </p>
                )}

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`model-answer-${q.key}`}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 rounded-xl bg-violet-soft p-4"
                    >
                      <p className="text-xs font-medium text-violet-deep">Model answer</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{modelAnswers[q.key]}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.article>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Scores, feedback and model answers are AI-generated for practice and can be wrong.
      </p>
    </main>
  );
}

export default Step3Report;