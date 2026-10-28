import express from "express";
import rateLimit from "express-rate-limit";
import { demoLogin, googleAuth, logout } from "../controllers/authController.js";

const authRouter = express.Router();

const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many demo sign-ins. Please try again later." },
});

const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please try again later." },
});

authRouter.post("/google", googleLimiter, googleAuth);
authRouter.post("/demo", demoLimiter, demoLogin);
authRouter.post("/logout", logout);

export default authRouter;