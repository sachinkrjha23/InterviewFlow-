import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { diffWords } from "diff";
import {
  FaCheck,
  FaCopy,
  FaDownload,
  FaFileUpload,
  FaSpinner,
  FaUndo,
} from "react-icons/fa";
import Navbar from "../components/Navbar";
import { extractResume, tailorResume } from "../utils/resumeApi";
import { scoreKeywords } from "../utils/keywordMatch";
import { generateResumePdf } from "../utils/generateResumePdf";

const STORAGE_KEY = "interviewflow:resume-tailor";
const MIN_CHARS = 100;
const MAX_PDF_MB = 5;

const loadSaved = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const scoreTone = (score) =>
  score >= 70
    ? "text-teal-deep"
    : score >= 40
      ? "text-amber-deep"
      : "text-rose-deep";

const CHIP_STYLE = {
  had: "bg-teal-soft text-teal-deep",
  added: "bg-indigo-soft text-indigo-deep",
  missing: "bg-amber-soft text-amber-deep",
  removed: "bg-rose-soft text-rose-deep",
};

function KeywordGroup({ title, hint, status, items }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {title} ({items.length})
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((k) => (
          <span
            key={k.term}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${CHIP_STYLE[status]}`}
          >
            {k.term}
            {k.importance === "must" && (
              <span className="ml-1 text-[9px] font-bold uppercase opacity-70">
                must
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResumeTailor() {
  const [saved] = useState(loadSaved);

  const [jobDescription, setJobDescription] = useState(saved?.jobDescription || "");
  const [resumeText, setResumeText] = useState(saved?.resumeText || "");
  const [result, setResult] = useState(saved?.result || null);
  const [edited, setEdited] = useState(saved?.edited || "");
  const [showChanges, setShowChanges] = useState(false);

  const [reading, setReading] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const resultRef = useRef(null);
  const fileRef = useRef(null);

  const inputsReady =
    jobDescription.trim().length >= MIN_CHARS && resumeText.trim().length >= MIN_CHARS;
  const busy = reading || tailoring;

  // keep the work if the page is refreshed (the credits are already spent)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ jobDescription, resumeText, result, edited }),
        );
      } catch {
        // storage can be full or blocked; the page still works
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [jobDescription, resumeText, result, edited]);

  const live = useMemo(
    () => (result ? scoreKeywords(edited, result.keywords) : null),
    [result, edited],
  );

  const groups = useMemo(() => {
    if (!result || !live) return null;
    const out = { had: [], added: [], missing: [], removed: [] };
    for (const k of result.keywords) {
      const was = result.before.matched.includes(k.term);
      const now = live.matched.includes(k.term);
      if (now) (was ? out.had : out.added).push(k);
      else (was ? out.removed : out.missing).push(k);
    }
    return out;
  }, [result, live]);

  const diffParts = useMemo(
    () => (showChanges && result ? diffWords(result.original, edited) : null),
    [showChanges, result, edited],
  );

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setError(`PDF must be under ${MAX_PDF_MB} MB.`);
      return;
    }

    setError("");
    setReading(true);
    try {
      setResumeText(await extractResume(file));
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't read that PDF.");
    } finally {
      setReading(false);
    }
  };

  const handleTailor = async () => {
    if (busy || !inputsReady) return;
    setError("");
    setTailoring(true);
    try {
      const data = await tailorResume({ resumeText, jobDescription });
      setResult({ ...data, original: resumeText });
      setEdited(data.tailoredText);
      setShowChanges(false);
      setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50,
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Couldn't tailor your resume. Please try again.",
      );
    } finally {
      setTailoring(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(edited);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the text and copy it manually.");
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await generateResumePdf(edited);
    } catch {
      setError("Failed to create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleStartOver = () => {
    if (!window.confirm("Start over? Your tailored resume and edits will be cleared.")) return;
    setResult(null);
    setEdited("");
    setShowChanges(false);
    setError("");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage can be blocked by the browser; nothing to clear then
    }
  };

  const field =
    "w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-indigo focus:outline-none disabled:opacity-60";
  const smallButton =
    "inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Resume tailor</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Paste a job description and your resume. The AI rewords your resume for that job using only
          what is already in it, and you can edit the result before using it.
        </p>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-6 grid gap-5 rounded-2xl border border-line bg-surface p-6 lg:grid-cols-2"
        >
          <div>
            <label htmlFor="jd" className="block text-sm font-medium text-ink">
              Job description
            </label>
            <textarea
              id="jd"
              rows={12}
              maxLength={6000}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={tailoring}
              placeholder="Paste the full job posting here"
              className={`mt-2 ${field}`}
            />
            <p className="mt-1 text-right text-xs text-muted">{jobDescription.length}/6000</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="resume" className="block text-sm font-medium text-ink">
                Your resume
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={handleFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className={smallButton}
              >
                {reading ? (
                  <FaSpinner className="animate-spin" size={12} />
                ) : (
                  <FaFileUpload size={12} />
                )}
                {reading ? "Reading…" : "Upload PDF"}
              </button>
            </div>
            <textarea
              id="resume"
              rows={12}
              maxLength={12000}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              disabled={tailoring}
              placeholder="Paste your resume text, or upload a PDF"
              className={`mt-2 ${field}`}
            />
            <p className="mt-1 text-right text-xs text-muted">{resumeText.length}/12000</p>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
            <div>
              <p className="text-sm text-ink">Free to use. No credits needed.</p>
              {!inputsReady && (
                <p className="mt-1 text-xs text-muted">
                  Add at least a few lines to both boxes to continue.
                </p>
              )}
            </div>
            <motion.button
              type="button"
              onClick={handleTailor}
              disabled={busy || !inputsReady}
              whileHover={busy || !inputsReady ? undefined : { scale: 1.03 }}
              whileTap={busy || !inputsReady ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tailoring && <FaSpinner className="animate-spin" size={13} />}
              {tailoring ? "Tailoring… this can take a minute" : "Tailor my resume"}
            </motion.button>
          </div>
        </motion.section>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-4 py-3 text-sm text-rose-deep">
            {error}
          </p>
        )}

        {result && live && groups && (
          <section ref={resultRef} className="mt-8 scroll-mt-24">
            {(result.added.length > 0 || result.newNumbers.length > 0) && (
              <div className="mb-4 space-y-2 rounded-xl border border-amber/40 bg-amber-soft p-4 text-sm text-amber-deep">
                <p className="font-medium">Check these before you use the resume</p>
                {result.added.length > 0 && (
                  <p>
                    The tailored version mentions {result.added.length} keyword
                    {result.added.length === 1 ? "" : "s"} your original didn't:{" "}
                    {result.added.join(", ")}. Keep each one only if it is true for you.
                  </p>
                )}
                {result.newNumbers.length > 0 && (
                  <p>
                    New numbers appeared that weren't in your original: {result.newNumbers.join(", ")}.
                    Remove any you can't back up.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-5">
              <div className="rounded-2xl border border-line bg-surface p-5 lg:col-span-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-ink">Tailored resume</h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChanges((v) => !v)}
                      aria-pressed={showChanges}
                      className={`${smallButton} ${showChanges ? "border-indigo bg-indigo-soft text-indigo-deep" : ""}`}
                    >
                      {showChanges ? "Back to editing" : "Show changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdited(result.tailoredText)}
                      disabled={edited === result.tailoredText}
                      className={smallButton}
                    >
                      <FaUndo size={11} /> Reset to AI version
                    </button>
                  </div>
                </div>

                {diffParts ? (
                  <div
                    className="mt-3 max-h-[34rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-3 text-sm leading-relaxed text-ink"
                    aria-label="Changes compared with your original resume"
                  >
                    {diffParts.map((part, i) =>
                      part.added ? (
                        <span key={i} className="rounded bg-teal-soft text-teal-deep">
                          {part.value}
                        </span>
                      ) : part.removed ? (
                        <span key={i} className="rounded bg-rose-soft text-rose-deep line-through">
                          {part.value}
                        </span>
                      ) : (
                        <span key={i}>{part.value}</span>
                      ),
                    )}
                  </div>
                ) : (
                  <textarea
                    value={edited}
                    onChange={(e) => setEdited(e.target.value)}
                    rows={22}
                    maxLength={14000}
                    aria-label="Tailored resume, editable"
                    className={`mt-3 ${field}`}
                  />
                )}
                {diffParts && (
                  <p className="mt-2 text-xs text-muted">
                    Green was added, red was removed, compared with your original.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={handleCopy} className={smallButton}>
                    {copied ? <FaCheck size={11} /> : <FaCopy size={11} />}
                    {copied ? "Copied" : "Copy text"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className={smallButton}
                  >
                    <FaDownload size={11} />
                    {downloading ? "Preparing…" : "Download PDF"}
                  </button>
                  <button type="button" onClick={handleStartOver} className={`${smallButton} ml-auto`}>
                    Start over
                  </button>
                </div>
              </div>

              <aside className="space-y-5 lg:col-span-2">
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <h2 className="text-lg font-bold text-ink">Keyword match</h2>
                  <div className="mt-3 flex items-end gap-4">
                    <div>
                      <p className="text-xs text-muted">Your original</p>
                      <p className={`text-3xl font-bold ${scoreTone(result.before.score)}`}>
                        {result.before.score}%
                      </p>
                    </div>
                    <span className="pb-2 text-muted" aria-hidden="true">→</span>
                    <div>
                      <p className="text-xs text-muted">This version</p>
                      <p className={`text-3xl font-bold ${scoreTone(live.score)}`}>{live.score}%</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Updates as you edit. Must-have keywords count double. This estimates how well your
                    resume matches the job's wording. It is not an official ATS score.
                  </p>

                  <KeywordGroup title="Already in your resume" status="had" items={groups.had} />
                  <KeywordGroup
                    title="Added in this version"
                    hint="Keep only what is true for you."
                    status="added"
                    items={groups.added}
                  />
                  <KeywordGroup
                    title="Still missing"
                    hint="Add these only if you genuinely have the skill."
                    status="missing"
                    items={groups.missing}
                  />
                  <KeywordGroup
                    title="Removed by your edits"
                    status="removed"
                    items={groups.removed}
                  />
                </div>

                {result.changes.length > 0 && (
                  <div className="rounded-2xl border border-line bg-surface p-5">
                    <h2 className="text-lg font-bold text-ink">What changed and why</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink">
                      {result.changes.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-2xl border border-line bg-surface p-5">
                  <h2 className="text-lg font-bold text-ink">Why this helps with ATS</h2>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
                    <li>
                      Applicant tracking systems and recruiters search for exact skill words. Each
                      matching keyword makes your resume turn up in more searches.
                    </li>
                    <li>
                      Plain headings and simple bullets are read reliably. The PDF uses one column on
                      purpose.
                    </li>
                    <li>
                      Wording that matches the job's own terms for things you really did is stronger
                      than generic wording.
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default ResumeTailor;