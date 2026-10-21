import { Link } from "react-router-dom";
import { BsRobot } from "react-icons/bs";

function Logo({ link = true }) {
  const content = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo text-white">
        <BsRobot size={18} aria-hidden="true" />
      </span>
      <span className="hidden text-lg font-medium text-ink sm:inline">InterviewFlow</span>
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