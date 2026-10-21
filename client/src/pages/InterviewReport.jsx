import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import Step3Report from "../components/Step3Report";
import { serverUrl } from "../config";

function InterviewReport() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${serverUrl}/api/interview/report/${id}`, { withCredentials: true })
      .then((result) => {
        if (!cancelled) setReport(result.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Couldn't load this report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const retry = () => {
    setError("");
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />

      {loading && (
        <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8 sm:px-6" role="status" aria-label="Loading report">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-line" />
          <div className="h-52 animate-pulse rounded-2xl bg-line" />
          <div className="h-40 animate-pulse rounded-2xl bg-line" />
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto w-full max-w-md px-6 py-20 text-center">
          <h1 className="text-xl font-medium text-ink">We couldn't open this report</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Try again
            </button>
            <Link
              to="/history"
              className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
            >
              Back to history
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && report && <Step3Report report={report} interviewId={id} />}
    </div>
  );
}

export default InterviewReport;