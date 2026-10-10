import express from "express"
import rateLimit from "express-rate-limit";
import isAuth from "../middleware/isAuth.js";
import { upload } from "../middleware/multer.js";
import { analyzeResume, finishInterview, generateQuestion, submitAnswers, getMyInterviews, getInterviewReport } from "../controllers/interviewController.js";

const interviewRouter = express.Router();

const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    message: { message: "Too many requests, please slow down." },
});

const uploadResume = (req, res, next) =>
    upload.single("resume")(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    });

interviewRouter.post("/resume", isAuth, aiLimiter, uploadResume, analyzeResume)
interviewRouter.post("/generateQuestions", isAuth, generateQuestion)
interviewRouter.post("/submitAnswer", isAuth, aiLimiter, submitAnswers)
interviewRouter.post("/finish", isAuth, finishInterview)

interviewRouter.get("/history", isAuth, getMyInterviews);
interviewRouter.get("/report/:id", isAuth, getInterviewReport);

export default interviewRouter;