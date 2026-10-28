import { Fragment, useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import AuthModel from "../components/AuthModel";
import { useSelector } from "react-redux";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { BsMic, BsClock, BsSliders, BsCheck2 } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

const EASE = [0.16, 1, 0.3, 1];

const steps = [
  {
    icon: <BsSliders size={18} aria-hidden="true" />,
    title: "Role & Experience Selection",
    desc: "AI adjusts difficulty based on the role and experience you pick.",
  },
  {
    icon: <BsMic size={18} aria-hidden="true" />,
    title: "AI Voice Interviewer",
    desc: "Questions and feedback are spoken aloud. Answer by typing or by voice.",
  },
  {
    icon: <BsClock size={18} aria-hidden="true" />,
    title: "Timer Based Simulation",
    desc: "Real interview pressure with live time tracking and scoring.",
  },
];

const sampleScores = [
  { label: "Communication", value: 8, tone: "bg-violet" },
  { label: "Correctness", value: 9, tone: "bg-teal" },
  { label: "Confidence", value: 7, tone: "bg-sky" },
];

const headline = "Practice Interviews with AI Intelligence".split(" ");

// A bar that fills once when it scrolls into view
function Fill({ value, tone, delay = 0 }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: value / 10 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.9, delay, ease: EASE }}
        style={{ transformOrigin: "left" }}
        className={`h-full w-full rounded-full ${tone}`}
      />
    </div>
  );
}

// Types its text once, when it scrolls into view. The full text is always reserved
// in the layout, so nothing jumps while it types.
function Typed({ text }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView || reduce || count >= text.length) return undefined;
    const timer = setTimeout(() => setCount(count + 1), 28);
    return () => clearTimeout(timer);
  }, [inView, reduce, count, text]);

  return (
    <span ref={ref} className="relative block">
      <span className="invisible">{text}</span>
      <span className="absolute inset-0">
        {reduce ? text : text.slice(0, count)}
        <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-accent" />
      </span>
    </span>
  );
}

// A card with a soft light that follows the pointer, and a small lift on hover
const cardItem = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

function SpotCard({ className = "", tint = "bg-surface", children }) {
  const handleMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
  };

  return (
    <motion.article
      variants={cardItem}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: EASE }}
      onPointerMove={handleMove}
      className={`group relative overflow-hidden rounded-2xl border border-line transition-colors duration-300 hover:border-line-strong ${tint} ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(280px circle at var(--mx, 50%) var(--my, 50%), rgb(124 155 255 / 0.10), transparent 70%)",
        }}
      />
      <div className="relative p-6 sm:p-8">{children}</div>
    </motion.article>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

// The 3D opening scene. When the page opens, five layers fly in from deep behind the screen
// and settle into one interview card. After that the scene drifts slowly, tilts toward the
// pointer, and rotates away as the page scrolls.
function HeroScene() {
  const reduce = useReducedMotion();
  const sceneRef = useRef(null);
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, { stiffness: 110, damping: 16 });
  const springY = useSpring(tiltY, { stiffness: 110, damping: 16 });

  const { scrollYProgress } = useScroll({ target: sceneRef, offset: ["start 0.85", "end start"] });
  const scrollTilt = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -26]);
  const lift = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -70]);
  const rotateX = useTransform([springX, scrollTilt], ([tilt, scroll]) => tilt + scroll);

  const handleMove = (event) => {
    if (reduce) return;
    const box = event.currentTarget.getBoundingClientRect();
    tiltY.set(((event.clientX - box.left) / box.width - 0.5) * 18);
    tiltX.set(-((event.clientY - box.top) / box.height - 0.5) * 14);
  };
  const handleLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  // each layer starts far behind the screen, turned away, and settles at its own depth
  const layer = (delay, depth, from = {}) => ({
    initial: reduce ? false : { opacity: 0, z: depth - 560, rotateY: -34, rotateX: 16, y: 40, ...from },
    animate: { opacity: 1, z: depth, rotateY: 0, rotateX: 0, y: 0, x: 0 },
    transition: { duration: 1.35, delay, ease: EASE },
  });

  return (
    <div
      ref={sceneRef}
      role="img"
      aria-label="Illustration of a sample interview: a question, a typed answer, a timer, scores and feedback"
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className="relative mx-auto w-full max-w-md pb-28 [perspective:1100px] lg:max-w-none"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -inset-y-6 -z-10 bg-[radial-gradient(circle,var(--color-line-strong)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      />

      <motion.div style={{ rotateX, rotateY: springY, y: lift, transformStyle: "preserve-3d" }} className="relative">
        <div className="animate-drift [transform-style:preserve-3d]">
          <motion.div
            aria-hidden="true"
            {...layer(0, -70, { x: 60 })}
            className="absolute inset-0 rounded-2xl border border-line bg-raised"
          />

          <motion.div {...layer(0.15, 0)} className="relative rounded-2xl border border-line-strong bg-surface p-5 shadow-xl sm:p-6">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Technical · Frontend Developer</span>
              <span>Question 2 of 5</span>
            </div>

            <p className="mt-5 text-lg font-semibold leading-snug text-ink sm:text-xl">
              Explain how closures work in JavaScript.
            </p>

            <div className="mt-5 rounded-lg border border-line bg-canvas p-4 text-sm leading-relaxed text-ink">
              A closure is a function that keeps access to the variables around it, even after the outer function has
              finished running.
            </div>

            <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full w-[62%] rounded-full bg-accent" />
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-muted">Sample session</span>
              <span className="rounded-lg bg-indigo px-3 py-1.5 text-xs font-medium text-white">Submit answer</span>
            </div>
          </motion.div>

          <motion.div
            {...layer(0.35, 70, { x: 80 })}
            className="absolute -right-2 -top-5 flex items-center gap-2 rounded-lg border border-line-strong bg-raised px-3 py-2 shadow-lg sm:-right-5"
          >
            <BsClock size={14} className="text-accent" aria-hidden="true" />
            <span className="text-sm font-semibold text-ink">01:24</span>
          </motion.div>

          <motion.div
            {...layer(0.5, 100, { x: -80 })}
            className="absolute -bottom-28 -left-2 w-56 rounded-xl border border-line-strong bg-raised p-4 shadow-xl sm:-left-8"
          >
            <p className="text-xs font-medium text-muted">Score for this answer</p>
            <div className="mt-3 space-y-3">
              {sampleScores.map((item, index) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink">{item.label}</span>
                    <span className="font-semibold text-ink">{item.value}/10</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <motion.div
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: item.value / 10 }}
                      transition={{ duration: 1, delay: 1.5 + index * 0.15, ease: EASE }}
                      style={{ transformOrigin: "left" }}
                      className={`h-full w-full rounded-full ${item.tone}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            {...layer(0.65, 130, { x: 90 })}
            className="absolute -bottom-24 -right-3 hidden w-52 rounded-xl border border-line-strong bg-raised p-4 shadow-xl sm:block"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-teal-deep">
              <BsCheck2 size={14} aria-hidden="true" />
              Feedback
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink">Good structure. Add a real example to make it land.</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function Home() {
  const { userData } = useSelector((state) => state.user);
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  const goTo = (path) => {
    if (!userData) return setShowAuth(true);
    navigate(path);
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />

      <main className="flex-1 [animation:none]">
        <section className="px-4 pb-24 pt-16 sm:px-6 lg:pb-32 lg:pt-24">
          <div className="mx-auto grid max-w-6xl items-center gap-20 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
            <div>
              <h1 className="text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl lg:text-[3.75rem]">
                {headline.map((word, index) => (
                  <Fragment key={index}>
                    <motion.span
                      initial={{ opacity: 0, y: 22, filter: "blur(10px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.8, delay: 0.1 + index * 0.08, ease: EASE }}
                      className="inline-block"
                    >
                      {word}
                    </motion.span>
                    {index < headline.length - 1 ? " " : null}
                  </Fragment>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
                className="mt-6 max-w-[52ch] text-base leading-relaxed text-muted sm:text-lg"
              >
                Role-based mock interviews with AI-voiced questions, rising difficulty, and instant performance
                evaluation.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.85, ease: EASE }}
                className="mt-9 flex flex-wrap items-center gap-3"
              >
                <motion.button
                  type="button"
                  onClick={() => goTo("/interview")}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-lg bg-indigo px-6 py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo/90"
                >
                  Start Interview
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => goTo("/history")}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-lg border border-line-strong bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-raised"
                >
                  View Interview History
                </motion.button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.1 }}
                className="mt-6 text-sm text-muted"
              >
                Each interview uses 50 credits. New accounts start with 150.
              </motion.p>
            </div>

            <HeroScene />
          </div>
        </section>

        <section className="border-y border-line bg-surface px-4 py-20 sm:px-6">
          <motion.ol
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12"
          >
            {steps.map((item, index) => (
              <motion.li key={item.title} variants={cardItem}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong bg-raised text-accent">
                    {item.icon}
                  </span>
                  <motion.span
                    aria-hidden="true"
                    variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 1, ease: EASE } } }}
                    style={{ transformOrigin: "left" }}
                    className="h-px flex-1 bg-line-strong"
                  />
                  <span className="text-sm font-medium text-muted" aria-label={`Step ${index + 1}`}>
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-muted">{item.desc}</p>
              </motion.li>
            ))}
          </motion.ol>
        </section>

        <section className="px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="max-w-xl text-3xl font-semibold text-ink sm:text-4xl">Advanced AI Capabilities</h2>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="mt-12 grid gap-4 lg:grid-cols-6"
            >
              <SpotCard className="lg:col-span-4">
                <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-ink">AI Answer Evaluation</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      Scores communication, technical accuracy and confidence, with follow-up questions when needed.
                    </p>
                  </div>
                  <div aria-hidden="true" className="space-y-4 rounded-xl border border-line bg-canvas p-5">
                    {sampleScores.map((item, index) => (
                      <div key={item.label}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-ink">{item.label}</span>
                          <span className="font-semibold text-ink">{item.value}/10</span>
                        </div>
                        <Fill value={item.value} tone={item.tone} delay={index * 0.12} />
                      </div>
                    ))}
                  </div>
                </div>
              </SpotCard>

              <SpotCard className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-ink">Resume &amp; Job Based Interview</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Questions based on your resume or a pasted job description. The free Resume tailor adapts your resume
                  to a job.
                </p>
                <div aria-hidden="true" className="mt-6 flex flex-wrap gap-2">
                  {[
                    ["React", true],
                    ["Node.js", true],
                    ["REST APIs", true],
                    ["Docker", false],
                  ].map(([word, found], index) => (
                    <motion.span
                      key={word}
                      initial={{ opacity: 0, scale: 0.85 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.3 + index * 0.12, ease: EASE }}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                        found ? "bg-teal-soft text-teal-deep" : "border border-dashed border-line-strong text-muted"
                      }`}
                    >
                      {found && <BsCheck2 size={12} />}
                      {word}
                    </motion.span>
                  ))}
                </div>
              </SpotCard>

              <SpotCard className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-ink">Downloadable PDF Report</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Download a full report with scores, your answers, feedback and speaking delivery.
                </p>
                <div aria-hidden="true" className="mt-6 rounded-lg border border-line bg-canvas p-4">
                  <div className="h-2 w-2/5 rounded-full bg-accent" />
                  <div className="mt-3 space-y-2">
                    {["w-full", "w-11/12", "w-4/5"].map((width, index) => (
                      <motion.div
                        key={width}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.3 + index * 0.15, ease: EASE }}
                        style={{ transformOrigin: "left" }}
                        className={`h-1.5 rounded-full bg-line-strong ${width}`}
                      />
                    ))}
                  </div>
                </div>
              </SpotCard>

              <SpotCard className="lg:col-span-4">
                <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-ink">History and Analytics</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      Review your past interviews and detailed reports anytime.
                    </p>
                  </div>
                  <ul aria-hidden="true" className="divide-y divide-line rounded-xl border border-line bg-canvas text-sm">
                    {[
                      ["Frontend Developer", "Technical", "7.5"],
                      ["Product Analyst", "HR", "8.2"],
                      ["Backend Developer", "Technical", "6.8"],
                    ].map(([role, mode, score], index) => (
                      <motion.li
                        key={role}
                        initial={{ opacity: 0, x: 16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 + index * 0.12, ease: EASE }}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <span className="text-ink">{role}</span>
                        <span className="flex items-center gap-3 text-muted">
                          {mode}
                          <span className="w-8 text-right font-semibold text-ink">{score}</span>
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </SpotCard>
            </motion.div>

            <p className="mt-4 text-xs text-muted">Illustrations on this page use sample data.</p>
          </div>
        </section>

        <section className="border-t border-line bg-surface px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="max-w-xl text-3xl font-semibold text-ink sm:text-4xl">Interview Modes and Features</h2>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="mt-12 grid gap-4 md:grid-cols-2"
            >
              <SpotCard tint="bg-canvas">
                <h3 className="text-lg font-semibold text-ink">HR Interview Mode</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Behavioural and communication based evaluation.
                </p>
                <p aria-hidden="true" className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm text-ink">
                  <Typed text="Tell me about a time you disagreed with a teammate." />
                </p>
              </SpotCard>

              <SpotCard tint="bg-canvas">
                <h3 className="text-lg font-semibold text-ink">Technical Interview Mode</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Deep technical questioning based on selected role.
                </p>
                <p aria-hidden="true" className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm text-ink">
                  <Typed text="How would you design a rate limiter for an API?" />
                </p>
              </SpotCard>
            </motion.div>

            <dl className="mt-10 grid gap-10 border-t border-line pt-10 md:grid-cols-2 md:gap-12">
              <div>
                <dt className="text-base font-semibold text-ink">Answer Scoring</dt>
                <dd className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted">
                  Each answer is scored out of 10 on confidence, communication and correctness.
                </dd>
              </div>
              <div>
                <dt className="text-base font-semibold text-ink">Credit System</dt>
                <dd className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted">
                  Each interview uses 50 credits; new accounts start with 150. The Resume tailor is free.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-2xl bg-indigo px-8 py-12 sm:flex-row sm:items-center sm:px-12"
          >
            <h2 className="max-w-md text-2xl font-semibold text-white sm:text-3xl">
              Your next interview starts with a practice run.
            </h2>
            <motion.button
              type="button"
              onClick={() => goTo("/interview")}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="shrink-0 rounded-lg bg-white px-6 py-3 text-sm font-medium text-canvas shadow-lg transition-colors hover:bg-indigo-deep"
            >
              Start Interview
            </motion.button>
          </motion.div>
        </section>
      </main>

      <Footer />

      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default Home;