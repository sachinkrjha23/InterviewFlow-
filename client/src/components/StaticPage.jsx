import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { CONTACT_EMAIL } from "../utils/siteInfo.js";
import { motion } from "motion/react";

export function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function MailLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-deep underline underline-offset-2">
      {CONTACT_EMAIL}
    </a>
  );
}

function StaticPage({ title, intro, updated, children }) {
  useEffect(() => {
    document.title = `${title} | InterviewFlow`;
    return () => {
      document.title = "InterviewFlow";
    };
  }, [title]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full max-w-3xl flex-1 px-6 py-12"
      >
        <h1 className="text-3xl font-medium text-ink">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted">Last updated {updated}</p>}
        {intro && <p className="mt-4 text-base leading-relaxed text-muted">{intro}</p>}
        <div className="mt-8 space-y-8">{children}</div>
      </motion.main>
      <Footer />
    </div>
  );
}

export default StaticPage;