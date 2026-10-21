import { Link } from "react-router-dom";
import Logo from "./Logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Start an interview", to: "/interview" },
      { label: "Interview history", to: "/history" },
      { label: "Credits", to: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "FAQ", to: "/faq" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms and conditions", to: "/terms" },
      { label: "Privacy policy", to: "/privacy" },
    ],
  },
];

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              AI-powered mock interviews with spoken questions, scored feedback and
              downloadable performance reports.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-sm font-medium text-ink">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm text-muted hover:text-indigo-deep">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} InterviewFlow. All rights reserved.</p>
          <p>Scores and feedback are AI-generated for practice and can be wrong.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;