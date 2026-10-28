import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(), // the PDF is read from memory and never written to disk
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

export const audioUpload = multer({
  storage: multer.memoryStorage(), // audio is never written to disk
  limits: { fileSize: 6 * 1024 * 1024, files: 1 }, // 6MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("audio/") && file.mimetype !== "video/webm") {
      return cb(new Error("Only audio recordings are allowed"));
    }
    cb(null, true);
  },
});
