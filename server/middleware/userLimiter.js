import rateLimit from "express-rate-limit";

// Rate limit per signed-in user (not per IP), so people on shared wifi
// don't use up each other's limit. Use it AFTER isAuth.
export const userLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => String(req.userId),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });