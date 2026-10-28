import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/authRouter.js";
import userRouter from "./routes/userRouter.js";
import interviewRouter from "./routes/interviewRouter.js";
import paymentRouter from "./routes/paymentRouter.js";
import { originCheck } from "./middleware/originCheck.js";
import resumeRouter from "./routes/resumeRouter.js";
import voiceRouter from "./routes/voiceRouter.js";
import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";

// CORS compares the origin as exact text, so normalize CLIENT_URL
// (a trailing slash or path in the env value would otherwise block every request)
const clientOrigin = new URL(process.env.CLIENT_URL || "http://localhost:5173")
  .origin;

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"];
      const id =
        typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    customLogLevel: (req, res, err) =>
      err || res.statusCode >= 500
        ? "error"
        : res.statusCode >= 400
          ? "warn"
          : "info",
    autoLogging: {
      ignore: (req) => req.url === "/health" || req.url === "/ready",
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "100kb",
    verify: (req, res, buf) => {
      req.rawBody = buf; // needed to check the Razorpay webhook signature
    },
  }),
);
// Express 5 leaves req.body undefined when the Content-Type isn't JSON.
// Default it to an object so handlers answer with a clean 400, not a crash.
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

app.use(cookieParser());
app.use(originCheck);

// generous per-IP safety net (the per-user limiters on the routes are the strict ones)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      req.path === "/health" ||
      req.path === "/ready" ||
      req.originalUrl.startsWith("/api/payment/webhook"),
    message: { message: "Too many requests. Please slow down." },
  }),
);

app.get("/", (req, res) => res.json({ message: "Server is running" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// "ready" also checks the database, for a host's health check
app.get("/ready", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1)
      throw new Error("db not connected");
    await mongoose.connection.db.admin().ping();
    return res.json({ status: "ready" });
  } catch {
    return res.status(503).json({ status: "unavailable" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/interview", interviewRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/resume", resumeRouter);
app.use("/api/voice", voiceRouter);

app.use((req, res) => res.status(404).json({ message: "Route not found." }));

// Express 5 sends errors from async handlers here too
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body too large." });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body." });
  }
  logger.error({ err, requestId: req.id }, "unhandled error");
  return res
    .status(500)
    .json({ message: "Something went wrong. Please try again." });
});

export default app;
