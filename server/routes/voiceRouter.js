import express from "express";
import isAuth from "../middleware/isAuth.js";
import { userLimiter } from "../middleware/userLimiter.js";
import { audioUpload } from "../middleware/multer.js";
import { transcribeAnswer } from "../controllers/voiceController.js";

const voiceRouter = express.Router();

const voiceLimiter = userLimiter({
  windowMs: 60 * 1000,
  limit: 20,
  message: "Too many recordings, please slow down.",
});

const uploadAudio = (req, res, next) =>
  audioUpload.single("audio")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });

voiceRouter.post("/transcribe", isAuth, voiceLimiter, uploadAudio, transcribeAnswer);

export default voiceRouter;