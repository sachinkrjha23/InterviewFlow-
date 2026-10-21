const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Blocks state-changing requests that come from some other website.
// Needed because the login cookie is SameSite=None in production.
export const originCheck = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  // Razorpay's webhook is server-to-server (no browser); its signature check protects it
  if (req.originalUrl.startsWith("/api/payment/webhook")) return next();

  const source = req.get("origin") || req.get("referer");
  if (!source) return next(); 

  try {
    const allowed = new URL(
      process.env.CLIENT_URL || "http://localhost:5173",
    ).origin;
    if (new URL(source).origin === allowed) return next();
  } catch {
    // unparseable origin falls through to the 403 below
  }

  return res.status(403).json({ message: "Request blocked." });
};