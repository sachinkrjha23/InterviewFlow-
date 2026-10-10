import multer from "multer";
import fs from "fs";

fs.mkdirSync("public", { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/[^\w.-]/g, "_")),
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF resumes are allowed"));
    }
    cb(null, true);
  },
});

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG or WebP images are allowed"));
    }
    cb(null, true);
  },
});
