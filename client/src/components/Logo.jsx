import { Link } from "react-router-dom";

function Mark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo text-white">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.5 4h11A3.5 3.5 0 0 1 21 7.5v6a3.5 3.5 0 0 1-3.5 3.5H11l-4 3.5V17h-.5A3.5 3.5 0 0 1 3 13.5v-6A3.5 3.5 0 0 1 6.5 4z" />
        <path d="M9 10.5v3M12 8.5V15M15 10v4" />
      </svg>
    </span>
  );
}

function Logo({ link = true }) {
  const content = (
    <>
      <Mark />
      <span className="hidden text-[17px] font-semibold tracking-tight text-ink sm:inline">InterviewFlow</span>
    </>
  );

  if (!link) return <div className="flex items-center gap-2.5">{content}</div>;

  return (
    <Link to="/" aria-label="InterviewFlow home" className="flex items-center gap-2.5">
      {content}
    </Link>
  );
}

export default Logo;