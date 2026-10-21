import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md text-center">
        <p className="inline-block rounded-lg bg-indigo-soft px-3 py-1 text-sm font-medium text-indigo-deep">
          404
        </p>
        <h1 className="mt-4 text-2xl font-medium text-ink">We can't find that page</h1>
        <p className="mt-2 text-sm text-muted">
          The link may be broken, or the page may have moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Go to home
          </Link>
          <Link
            to="/history"
            className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
          >
            My interviews
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;