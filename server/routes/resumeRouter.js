import express from "express";
import { userLimiter } from "../middleware/userLimiter.js";
import isAuth from "../middleware/isAuth.js";
import { upload } from "../middleware/multer.js";
import { extractResumeText, tailorResume } from "../controllers/resumeController.js";

const resumeRouter = express.Router();

const extractLimiter = userLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  message: "Too many uploads, please slow down.",
});

// at most 3 tailoring requests a minute
const tailorLimiter = userLimiter({
  windowMs: 60 * 1000,
  limit: 3,
  message: "Too many requests, please slow down.",
});

// at most 15 a day; a request rejected for bad input (400) or by the in-flight lock (429)
// doesn't use up the day
const tailorDailyLimiter = userLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 15,
  message: "Daily limit reached. Please try again tomorrow.",
  skipFailedRequests: true,
  requestWasSuccessful: (req, res) => ![400, 429].includes(res.statusCode),
});

const uploadResume = (req, res, next) =>
  upload.single("resume")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });

resumeRouter.post("/extract", isAuth, extractLimiter, uploadResume, extractResumeText);
resumeRouter.post("/tailor", isAuth, tailorLimiter, tailorDailyLimiter, tailorResume);

export default resumeRouter;