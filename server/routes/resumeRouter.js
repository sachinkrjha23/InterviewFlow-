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

const tailorLimiter = userLimiter({
  windowMs: 60 * 1000,
  limit: 3,
  message: "Too many requests, please slow down.",
});

const uploadResume = (req, res, next) =>
  upload.single("resume")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });

resumeRouter.post("/extract", isAuth, extractLimiter, uploadResume, extractResumeText);
const tailorDailyLimiter = userLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 15,
  message: "Daily limit reached. Please try again tomorrow.",
});

resumeRouter.post("/tailor", isAuth, tailorLimiter, tailorDailyLimiter, tailorResume);

export default resumeRouter;