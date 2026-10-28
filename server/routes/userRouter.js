import express from "express";
import { userLimiter } from "../middleware/userLimiter.js";
import isAuth from "../middleware/isAuth.js";
import { blockDemo } from "../middleware/blockDemo.js";
import { avatarUpload } from "../middleware/multer.js";
import {
  getCurrentUser,
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
  changeSignInEmail,
} from "../controllers/userController.js";

const userRouter = express.Router();

const photoLimiter = userLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  message: "Too many photo changes, please slow down.",
});

const emailLimiter = userLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  message: "Too many email change attempts. Please try again later.",
});

const handleAvatarUpload = (req, res, next) =>
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "Image must be under 2MB."
            : err.message,
      });
    }
    next();
  });

userRouter.get("/currentUser", isAuth, getCurrentUser);
userRouter.patch("/profile", isAuth, blockDemo, updateProfile);
userRouter.post(
  "/avatar",
  isAuth,
  blockDemo,
  photoLimiter,
  handleAvatarUpload,
  uploadProfilePhoto,
);
userRouter.delete("/avatar", isAuth, blockDemo, removeProfilePhoto);
userRouter.post(
  "/email/change",
  isAuth,
  blockDemo,
  emailLimiter,
  changeSignInEmail,
);

export default userRouter;
