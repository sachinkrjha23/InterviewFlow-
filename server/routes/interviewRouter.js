import express from "express"
import { userLimiter } from "../middleware/userLimiter.js";
import isAuth from "../middleware/isAuth.js";
import { upload } from "../middleware/multer.js";
import { analyzeResume, finishInterview, generateQuestion, submitAnswers, getMyInterviews, getInterviewReport, getModelAnswers, getInterviewStats, getProgress } from "../controllers/interviewController.js";

const interviewRouter = express.Router();

const resumeLimiter = userLimiter({
    windowMs: 60 * 1000,
    limit: 10,
    message: "Too many resume uploads, please slow down.",
});

const generateLimiter = userLimiter({
    windowMs: 60 * 1000,
    limit: 5,
    message: "Too many interview requests, please slow down.",
});

const answerLimiter = userLimiter({
    windowMs: 60 * 1000,
    limit: 20,
    message: "Too many requests, please slow down.",
});

const modelAnswerLimiter = userLimiter({
    windowMs: 60 * 1000,
    limit: 10,
    message: "Too many requests, please slow down.",
});

const uploadResume = (req, res, next) =>
    upload.single("resume")(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    });

interviewRouter.post("/resume", isAuth, resumeLimiter, uploadResume, analyzeResume)
interviewRouter.post("/generateQuestions", isAuth, generateLimiter, generateQuestion)
interviewRouter.post("/submitAnswer", isAuth, answerLimiter, submitAnswers)

interviewRouter.post("/finish", isAuth, finishInterview)
interviewRouter.get("/history", isAuth, getMyInterviews);
interviewRouter.get("/stats", isAuth, getInterviewStats);
interviewRouter.get("/report/:id", isAuth, getInterviewReport);
interviewRouter.get("/progress", isAuth, getProgress);
interviewRouter.post("/report/:id/model-answers", isAuth, modelAnswerLimiter, getModelAnswers);

export default interviewRouter;