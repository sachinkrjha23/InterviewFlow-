import { Component } from "react";
import { FiAlertTriangle } from "react-icons/fi";

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("UI error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-soft text-rose-deep">
            <FiAlertTriangle size={22} aria-hidden="true" />
          </div>
          <h1 className="text-xl font-medium text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            The page hit an unexpected problem. Reloading usually fixes it.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
            >
              Go to home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;