import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import { FaArrowRight, FaSearch } from "react-icons/fa";
import Navbar from "../components/Navbar";
import { serverUrl } from "../config";

const PAGE_SIZE = 20;
const STATUS_FILTERS = ["All", "Completed", "Incomplete"];
const MODE_FILTERS = ["All", "HR", "Technical"];

const scoreTone = (score) =>
  score >= 7 ? "text-teal-deep" : score >= 4 ? "text-amber-deep" : "text-rose-deep";

const fetchPage = async (page) => {
  const { data } = await axios.get(`${serverUrl}/api/interview/history`, {
    params: { page, limit: PAGE_SIZE },
    withCredentials: true,
  });
  return Array.isArray(data) ? data : [];
};

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${value === option
              ? "border-indigo bg-indigo-soft text-indigo-deep"
              : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
            }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function InterviewHistory() {
  const [interviews, setInterviews] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;
    fetchPage(1)
      .then((rows) => {
        if (cancelled) return;
        setInterviews(rows);
        setPage(1);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load interviews.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setError("");
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    setMoreError("");
    try {
      const rows = await fetchPage(page + 1);
      setInterviews((prev) => {
        const seen = new Set(prev.map((i) => i._id));
        return [...prev, ...rows.filter((i) => !seen.has(i._id))];
      });
      setPage((p) => p + 1);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      setMoreError(err.response?.data?.message || "Couldn't load more. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return interviews.filter((item) => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (modeFilter !== "All" && item.mode !== modeFilter) return false;
      if (term) {
        const haystack = `${item.role} ${item.experience}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [interviews, search, statusFilter, modeFilter]);

  const filtersActive = search.trim() !== "" || statusFilter !== "All" || modeFilter !== "All";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setModeFilter("All");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Interview history</h1>
          <p className="mt-1 text-sm text-muted">
            Track your past interviews and open any report.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading interviews">
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-2xl bg-line" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose/30 bg-rose-soft p-8 text-center">
            <p className="text-sm font-medium text-rose-deep">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Try again
            </button>
          </div>
        ) : interviews.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center">
            <p className="text-muted">No interviews yet.</p>
            <Link
              to="/interview"
              className="mt-4 inline-block rounded-lg bg-indigo px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Start your first interview
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5 space-y-3 rounded-2xl border border-line bg-surface p-4">
              <label className="relative block">
                <span className="sr-only">Search by role or experience</span>
                <FaSearch
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  size={13}
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by role or experience"
                  className="w-full rounded-lg border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-indigo focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <FilterGroup
                  label="Status"
                  options={STATUS_FILTERS}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                <FilterGroup
                  label="Mode"
                  options={MODE_FILTERS}
                  value={modeFilter}
                  onChange={setModeFilter}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface p-10 text-center">
                <p className="text-muted">No interviews match your filters.</p>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="space-y-3">
                {filtered.map((item, index) => {
                  const isComplete = item.status === "Completed";
                  const score = Number(item.finalScore || 0);
                  return (
                    <motion.li
                      key={item._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(index % PAGE_SIZE, 8) * 0.03 }}
                    >
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Link
                          to={`/report/${item._id}`}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold text-ink">
                                {item.role}
                              </h3>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.mode === "HR"
                                    ? "bg-violet-soft text-violet-deep"
                                    : "bg-indigo-soft text-indigo-deep"
                                  }`}
                              >
                                {item.mode}
                              </span>
                            </div>
                            <p className="text-sm text-muted">
                              {item.experience} ·{" "}
                              {new Date(item.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-4">
                            <div className="text-right">
                              <p
                                className={`text-2xl font-bold leading-none ${isComplete ? scoreTone(score) : "text-muted"
                                  }`}
                              >
                                {isComplete ? score.toFixed(1) : "—"}
                              </p>
                              <span
                                className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isComplete
                                    ? "bg-teal-soft text-teal-deep"
                                    : "bg-amber-soft text-amber-deep"
                                  }`}
                              >
                                {isComplete
                                  ? "Completed"
                                  : `Incomplete · ${item.answeredCount ?? 0}/${item.totalQuestions ?? 6}`}
                              </span>
                            </div>
                            <FaArrowRight className="text-line-strong" />
                          </div>
                        </Link>
                      </motion.div>
                    </motion.li>
                  );
                })}
              </ul>
            )}

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-line-strong bg-surface px-6 py-2.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-60"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
                {moreError && <p className="mt-2 text-sm text-rose-deep">{moreError}</p>}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default InterviewHistory;