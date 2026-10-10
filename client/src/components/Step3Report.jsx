import React, { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaTrophy,
  FaCheckCircle,
  FaLightbulb,
  FaCommentDots,
  FaChartLine,
  FaDownload,
  FaSpinner,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { generateReportPdf } from "../utils/generateReportPdf";

function Step3Report({ report }) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState("");

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading Report...</p>
      </div>
    );
  }

  const {
    role,
    experience,
    mode,
    createdAt,
    finalScore = 0,
    confidence = 0,
    communication = 0,
    correctness = 0,
    questionWiseScore = [],
  } = report;

  const metrics = [
    { label: "Confidence", value: confidence, icon: <FaLightbulb /> },
    { label: "Communication", value: communication, icon: <FaCommentDots /> },
    { label: "Correctness", value: correctness, icon: <FaCheckCircle /> },
  ];

  const chartData = questionWiseScore.map((q, index) => ({
    name: `Q${index + 1}`,
    score: q.score ?? 0,
  }));

  const isIncomplete = report.status === "Incomplete";
  let performanceText = "";
  let shortTagline = "";

  if (isIncomplete) {
    performanceText = "Interview not finished";
    shortTagline =
      "This session wasn't completed, so scores only reflect the questions you answered.";
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

  const getScoreColor = (score) => {
    if (score >= 8) return "text-emerald-600";
    if (score >= 6) return "text-blue-600";
    if (score >= 4) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreBg = (score) => {
    if (score >= 8) return "bg-emerald-50 border-emerald-200";
    if (score >= 6) return "bg-blue-50 border-blue-200";
    if (score >= 4) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  const getGrade = (score) => {
    if (score >= 9) return "Outstanding";
    if (score >= 8) return "Excellent";
    if (score >= 7) return "Good";
    if (score >= 5) return "Average";
    return "Needs Work";
  };

  const getBarColor = (score) => {
    if (score >= 8) return "#10b981";
    if (score >= 6) return "#3b82f6";
    if (score >= 4) return "#f59e0b";
    return "#ef4444";
  };

  const handleDownloadPdf = () => {
    try {
      setPdfError("");
      setDownloading(true);
      generateReportPdf(report);
    } catch (err) {
      console.error(err);
      setPdfError("Failed to generate PDF. Please try again.");
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const buttonSpring = { type: "spring", stiffness: 400, damping: 17 };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/40 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 mb-8 flex-wrap"
        >
          <motion.button
            whileHover={{ scale: 1.08, x: -2 }}
            whileTap={{ scale: 0.94 }}
            transition={buttonSpring}
            onClick={() => navigate(-1)}
            className="mt-1 p-3 rounded-full bg-white border border-gray-200
                       text-gray-700 shadow-sm hover:shadow-md
                       hover:bg-gray-50 transition-colors"
          >
            <FaArrowLeft size={14} />
          </motion.button>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Interview Report
            </h1>
            <p className="text-gray-500 mt-1">
              {role} · {experience} · {mode} mode
              {createdAt && (
                <>
                  {" · "}
                  {new Date(createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </>
              )}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl border border-gray-200 shadow-lg p-8 mb-6
                     flex flex-col md:flex-row items-center gap-8
                     hover:shadow-xl transition-shadow"
        >
          <div className="relative w-40 h-40 flex-shrink-0">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="#f3f4f6"
                strokeWidth="12"
                fill="none"
              />
              <motion.circle
                cx="80"
                cy="80"
                r="70"
                stroke="url(#grad)"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: "0 440" }}
                animate={{
                  strokeDasharray: `${(finalScore / 10) * 440} 440`,
                }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                className="text-4xl font-bold text-gray-900"
              >
                {Number(finalScore).toFixed(1)}
              </motion.span>
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                out of 10
              </span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-emerald-50
                            text-emerald-700 px-3 py-1 rounded-full
                            text-xs font-semibold uppercase tracking-wide mb-3">
              <FaTrophy size={11} />
              {getGrade(finalScore)}
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {performanceText}
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed max-w-md">
              {shortTagline}
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`rounded-2xl border p-5 ${getScoreBg(m.value)}
                         hover:shadow-md transition-shadow cursor-default`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {m.label}
                </span>
                <span className={getScoreColor(m.value)}>{m.icon}</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${getScoreColor(m.value)}`}>
                  {Number(m.value).toFixed(1)}
                </span>
                <span className="text-sm text-gray-400">/ 10</span>
              </div>

              <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(m.value / 10) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                  className={`h-full rounded-full ${
                    m.value >= 8
                      ? "bg-emerald-500"
                      : m.value >= 6
                      ? "bg-blue-500"
                      : m.value >= 4
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-3xl border border-gray-200 shadow-lg
                       p-6 sm:p-8 mb-8 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-2 mb-1">
              <FaChartLine className="text-emerald-600" />
              <h3 className="text-lg font-bold text-gray-900">
                Score per Question
              </h3>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Higher is better. Bars are color-coded by performance.
            </p>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  }}
                  formatter={(value) => [`${value}/10`, "Score"]}
                />
                <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FaChartLine className="text-emerald-600" />
          Detailed Breakdown
        </h3>

        <div className="space-y-4">
          {questionWiseScore.map((q, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl border border-gray-200
                         shadow-sm hover:shadow-md hover:border-emerald-100
                         transition-all p-6"
            >
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide
                                text-emerald-600 mb-1">
                    Question {i + 1}
                    {q.difficulty && ` · ${q.difficulty}`}
                  </p>
                  <p className="font-semibold text-gray-900 leading-relaxed">
                    {q.question}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-2xl font-bold ${getScoreColor(q.score)}`}>
                    {q.score ?? 0}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    Score
                  </p>
                </div>
              </div>

              {q.answer && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide
                                text-gray-400 mb-1">
                    Your Answer
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {q.answer}
                  </p>
                </div>
              )}

              {q.feedback && (
                <div className="bg-emerald-50 border border-emerald-100
                                rounded-xl p-4 mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide
                                text-emerald-600 mb-1">
                    Feedback
                  </p>
                  <p className="text-sm text-emerald-900 leading-relaxed">
                    {q.feedback}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Confidence", value: q.confidence },
                  { label: "Communication", value: q.communication },
                  { label: "Correctness", value: q.correctness },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center bg-gray-50
                               rounded-lg py-2 border border-gray-100
                               hover:bg-white hover:border-emerald-100
                               transition-colors"
                  >
                    <span
                      className={`text-base font-bold ${getScoreColor(
                        s.value ?? 0
                      )}`}
                    >
                      {s.value ?? 0}
                    </span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-wide">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-3 mt-10 flex-wrap"
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={buttonSpring}
            onClick={() => navigate("/interview")}
            className="bg-gradient-to-r from-emerald-600 to-teal-500
                       hover:from-emerald-500 hover:to-teal-400
                       text-white px-8 py-3 rounded-full font-semibold
                       shadow-md hover:shadow-lg hover:shadow-emerald-500/30
                       transition-all"
          >
            Take Another Interview
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={buttonSpring}
            onClick={() => navigate("/history")}
            className="bg-white border border-gray-300 text-gray-700
                       hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900
                       px-8 py-3 rounded-full font-semibold
                       shadow-sm hover:shadow-md
                       transition-all"
          >
            View History
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={buttonSpring}
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-2
                       bg-black hover:bg-gray-800
                       text-white px-8 py-3 rounded-full font-semibold
                       shadow-md hover:shadow-lg hover:shadow-black/20
                       disabled:opacity-60 disabled:cursor-not-allowed
                       transition-all"
          >
            {downloading ? (
              <FaSpinner className="animate-spin" size={14} />
            ) : (
              <FaDownload size={14} />
            )}
            {downloading ? "Generating..." : "Download PDF"}
          </motion.button>
        </motion.div>

        {pdfError && (
          <p className="text-center text-sm text-red-500 mt-4">{pdfError}</p>
        )}
      </div>
    </div>
  );
}

export default Step3Report;