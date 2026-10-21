import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { FaCheckCircle, FaFileUpload } from "react-icons/fa";
import { serverUrl, INTERVIEW_COST } from "../config";
import { setUserData } from "../redux/userSlice";
import Modal from "./Modal";
import { motion } from "motion/react";
import MicCheck from "./MicCheck";

const ROLE_SUGGESTIONS = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Software Engineer",
  "Data Analyst",
  "Data Scientist",
  "DevOps Engineer",
  "Android Developer",
  "QA Engineer",
  "UI/UX Designer",
];

const EXPERIENCE_OPTIONS = [
  "Fresher (0 years)",
  "Less than 1 year",
  "1-2 years",
  "2-4 years",
  "4-7 years",
  "7+ years",
];

const MODES = [
  {
    value: "Technical",
    title: "Technical",
    text: "Role-specific questions that get harder as you go.",
    selected: "peer-checked:border-indigo peer-checked:bg-indigo-soft",
  },
  {
    value: "HR",
    title: "HR",
    text: "Behaviour, communication and how you present yourself.",
    selected: "peer-checked:border-violet peer-checked:bg-violet-soft",
  },
];

const MAX_RESUME_MB = 5;
const MAX_SKILLS_SHOWN = 12;

const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20 disabled:cursor-not-allowed disabled:opacity-60";

function Step1SetUp({ onStart }) {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const ids = useId();

  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [mode, setMode] = useState("Technical");
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [projects, setProjects] = useState([]);
  const [skills, setSkills] = useState([]);
  const [resumeText, setResumeText] = useState("");
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const clickLockRef = useRef(false);
  const fileInputRef = useRef(null);

  const credits = userData?.credits ?? 0;
  const notEnoughCredits = credits < INTERVIEW_COST;
  const canStart = role.trim() && experience.trim();
  const isLocked = loading || started;

  const experienceOptions =
    experience && !EXPERIENCE_OPTIONS.includes(experience)
      ? [{ value: experience, label: `${experience} (from resume)` }, ...EXPERIENCE_OPTIONS.map((o) => ({ value: o, label: o }))]
      : EXPERIENCE_OPTIONS.map((o) => ({ value: o, label: o }));

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setErrorMsg("");
    if (!file) {
      setResumeFile(null);
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setErrorMsg("Please choose a PDF file.");
      setResumeFile(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_RESUME_MB * 1024 * 1024) {
      setErrorMsg(`That file is larger than ${MAX_RESUME_MB} MB. Please choose a smaller PDF.`);
      setResumeFile(null);
      e.target.value = "";
      return;
    }
    setResumeFile(file);
  };

  const clearResume = () => {
    setResumeFile(null);
    setAnalysisDone(false);
    setProjects([]);
    setSkills([]);
    setResumeText("");
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadResume = async () => {
    if (!resumeFile || analyzing) return;
    setAnalyzing(true);
    setErrorMsg("");

    const formdata = new FormData();
    formdata.append("resume", resumeFile);

    try {
      const result = await axios.post(serverUrl + "/api/interview/resume", formdata, {
        withCredentials: true,
      });

      setRole(result.data.role || "");
      setExperience(result.data.experience || "");
      setProjects(result.data.projects || []);
      setSkills(result.data.skills || []);
      setResumeText(result.data.resumeText || "");
      setAnalysisDone(true);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Failed to analyze resume");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStart = async () => {
    if (clickLockRef.current) return;
    if (!role.trim() || !experience.trim()) return;

    setErrorMsg("");
    setShowConfirm(false);

    clickLockRef.current = true;
    setLoading(true);
    setStarted(true);

    try {
      const result = await axios.post(
        serverUrl + "/api/interview/generateQuestions",
        { role, experience, mode, resumeText, projects, skills, jobDescription },
        { withCredentials: true },
      );

      if (userData) {
        dispatch(setUserData({ ...userData, credits: result.data.creditsLeft }));
      }

      onStart(result.data);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Failed to start interview");
      clickLockRef.current = false;
      setStarted(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-medium text-ink">Set up your interview</h1>
      <p className="mt-2 text-sm text-muted">
        Pick a role and a mode. Add your resume if you want questions based on it.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${ids}-role`} className="mb-1.5 block text-sm font-medium text-ink">
                Role
              </label>
              <input
                id={`${ids}-role`}
                type="text"
                list={`${ids}-roles`}
                placeholder="e.g. Frontend Developer"
                maxLength={100}
                disabled={isLocked}
                className={inputClass}
                onChange={(e) => setRole(e.target.value)}
                value={role}
              />
              <datalist id={`${ids}-roles`}>
                {ROLE_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor={`${ids}-exp`} className="mb-1.5 block text-sm font-medium text-ink">
                Experience
              </label>
              <select
                id={`${ids}-exp`}
                value={experience}
                disabled={isLocked}
                onChange={(e) => setExperience(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  Select your experience
                </option>
                {experienceOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <fieldset disabled={isLocked} className="rounded-2xl border border-line bg-surface p-6">
          <legend className="px-1 text-sm font-medium text-ink">Interview mode</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => (
              <label key={m.value} className="relative block cursor-pointer">
                <input
                  type="radio"
                  name="interview-mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="peer sr-only"
                />
                <span
                  className={`block rounded-xl border border-line p-4 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo peer-disabled:opacity-60 ${m.selected}`}
                >
                  <span className="block text-sm font-medium text-ink">{m.title}</span>
                  <span className="mt-1 block text-sm text-muted">{m.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-medium text-ink">
            Resume <span className="font-normal text-muted">(optional)</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Text-based PDF, up to {MAX_RESUME_MB} MB. We read the first two pages and fill in your role,
            experience and skills.
          </p>

          {!analysisDone && (
            <div className="mt-4">
              <input
                ref={fileInputRef}
                id={`${ids}-resume`}
                type="file"
                accept="application/pdf"
                disabled={isLocked || analyzing}
                onChange={handleFileChange}
                className="peer sr-only"
              />
              <label
                htmlFor={`${ids}-resume`}
                className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-line-strong bg-canvas px-6 py-8 text-center transition-colors hover:border-indigo hover:bg-indigo-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-soft text-indigo-deep">
                  <FaFileUpload size={18} aria-hidden="true" />
                </span>
                {resumeFile ? (
                  <span className="mt-3 text-sm font-medium text-ink">
                    {resumeFile.name}
                    <span className="ml-2 font-normal text-muted">
                      {(resumeFile.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </span>
                ) : (
                  <span className="mt-3 text-sm font-medium text-ink">Choose a PDF</span>
                )}
                <span className="mt-1 text-xs text-muted">
                  {resumeFile ? "Click to choose a different file" : "Click here to browse"}
                </span>
              </label>

              {resumeFile && (
                <button
                  type="button"
                  onClick={handleUploadResume}
                  disabled={analyzing || isLocked}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {analyzing && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {analyzing ? "Analyzing…" : "Analyze resume"}
                </button>
              )}
            </div>
          )}

          {analysisDone && (
            <div className="mt-4 rounded-xl bg-teal-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium text-teal-deep">
                  <FaCheckCircle aria-hidden="true" />
                  Resume analyzed. Check your role and experience above.
                </p>
                <button
                  type="button"
                  onClick={clearResume}
                  disabled={isLocked}
                  className="shrink-0 text-sm font-medium text-teal-deep underline underline-offset-2 disabled:opacity-60"
                >
                  Remove resume
                </button>
              </div>

              {skills.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-teal-deep">Skills found</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {skills.slice(0, MAX_SKILLS_SHOWN).map((skill) => (
                      <li key={skill} className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-teal-deep">
                        {skill}
                      </li>
                    ))}
                    {skills.length > MAX_SKILLS_SHOWN && (
                      <li className="rounded-md px-2 py-0.5 text-xs text-teal-deep">
                        +{skills.length - MAX_SKILLS_SHOWN} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {projects.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-teal-deep">Projects found</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-teal-deep">
                    {projects.slice(0, 4).map((project) => (
                      <li key={project}>{project}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6">
          <label htmlFor="job-description" className="block text-sm font-medium text-ink">
            Job description <span className="font-normal text-muted">(optional)</span>
          </label>
          <p className="mt-1 text-xs text-muted">
            Paste a job posting and your questions will follow it. Leave it empty for a general interview.
          </p>
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            maxLength={4000}
            rows={6}
            disabled={isLocked}
            placeholder="Paste the job description here"
            className="mt-3 w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-indigo focus:outline-none disabled:opacity-60"
          />
          <p className="mt-1 text-right text-xs text-muted">{jobDescription.length}/4000</p>
        </section>

        <MicCheck />

        {errorMsg && (
          <p role="alert" className="rounded-lg bg-rose-soft px-4 py-3 text-sm text-rose-deep">
            {errorMsg}
          </p>
        )}

        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-ink">
              This interview uses {INTERVIEW_COST} credits. You have {credits}.
            </p>
            {notEnoughCredits && (
              <p className="mt-2 inline-block rounded-md bg-amber-soft px-2.5 py-1 text-xs font-medium text-amber-deep">
                Not enough credits.{" "}
                <Link to="/pricing" className="underline underline-offset-2">
                  Buy credits
                </Link>
              </p>
            )}
          </div>
          <motion.button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!canStart || isLocked}
            whileHover={canStart && !isLocked ? { scale: 1.03 } : undefined}
            whileTap={canStart && !isLocked ? { scale: 0.97 } : undefined}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLocked && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {isLocked ? "Preparing your questions…" : "Start interview"}
          </motion.button>
        </div>
      </div>

      {showConfirm && (
        <Modal onClose={() => setShowConfirm(false)} labelledBy="confirm-title">
          <div className="rounded-2xl border border-line bg-surface p-7">
            <h2 id="confirm-title" className="text-xl font-medium text-ink">
              Before you start
            </h2>
            <p className="mt-1 text-sm text-muted">
              This interview uses {INTERVIEW_COST} credits. You have {credits}.
            </p>

            <ul className="mt-5 space-y-3 text-sm text-ink">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-soft text-xs font-medium text-sky-deep">
                  1
                </span>
                Make sure your internet connection is stable.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-soft text-xs font-medium text-amber-deep">
                  2
                </span>
                Stay on this page until you finish. If you refresh, close the tab or go back, the
                interview ends, it can't be reopened, and the {INTERVIEW_COST} credits are not
                refunded.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-soft text-xs font-medium text-violet-deep">
                  3
                </span>
                Each question is timed and spoken aloud, so turn your sound on.
              </li>
            </ul>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-canvas"
              >
                Cancel
              </button>
              {notEnoughCredits ? (
                <Link
                  to="/pricing"
                  className="flex-1 rounded-lg bg-indigo px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90"
                >
                  Buy credits
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex-1 rounded-lg bg-indigo px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                >
                  I understand, start
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

export default Step1SetUp;