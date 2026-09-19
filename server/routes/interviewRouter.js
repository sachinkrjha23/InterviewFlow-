import express from "express"
import isAuth from "../middleware/isAuth.js";
import { upload } from "../middleware/multer.js";
import { analyzeResume, finishInterview, generateQuestion, submitAnswers } from "../controllers/interviewController.js";


const interviewRouter = express.Router();

interviewRouter.post("/resume", isAuth, upload.single("resume"), analyzeResume)
interviewRouter.post("/generateQuestions", isAuth, generateQuestion)
interviewRouter.post("/submitAnswer", isAuth, submitAnswers)
interviewRouter.post("/finish", isAuth, finishInterview)


export default interviewRouter;