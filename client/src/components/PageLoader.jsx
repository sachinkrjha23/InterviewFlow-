function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-canvas"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-indigo" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default PageLoader;