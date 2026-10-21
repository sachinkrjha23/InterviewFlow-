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

// CORS compares the origin as exact text, so normalize CLIENT_URL
// (a trailing slash or path in the env value would otherwise block every request)
const clientOrigin = new URL(process.env.CLIENT_URL || "http://localhost:5173")
  .origin;

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
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

app.get("/", (req, res) => res.json({ message: "Server is running" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

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
  console.error(err);
  return res
    .status(500)
    .json({ message: "Something went wrong. Please try again." });
});

export default app;
