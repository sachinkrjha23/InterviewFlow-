import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  question: { type: String, maxlength: 2000 },
  difficulty: String,
  timeLimit: Number,
  answer: { type: String, maxlength: 5000 },
  submitted: { type: Boolean, default: false },
  feedback: { type: String, maxlength: 2000 },
  modelAnswer: { type: String, maxlength: 3000 },
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
  communication: { type: Number, default: 0 },
  correctness: { type: Number, default: 0 },
  isFollowUp: { type: Boolean, default: false },
  delivery: {
    durationSec: Number,
    wordCount: Number,
    wpm: Number,
    fillerCount: Number,
    fillers: [{ _id: false, word: String, count: Number }],
    longPauseCount: Number,
    longestPauseSec: Number,
  },
});

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      required: true,
      maxlength: 100,
    },
    experience: {
      type: String,
      required: true,
      maxlength: 50,
    },
    mode: {
      type: String,
      enum: ["HR", "Technical"],
      required: true,
    },
    resumeText: {
      type: String,
      maxlength: 8000,
    },
    jobDescription: {
      type: String,
      maxlength: 4000,
    },
    questions: {
      type: [questionSchema],
      validate: [(v) => v.length <= 10, "Too many questions"],
    },
    finalScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Incomplete", "Completed"],
      default: "Incomplete",
    },
  },
  { timestamps: true },
);

// speeds up the history list (find by user, newest first)
interviewSchema.index({ userId: 1, createdAt: -1 });

interviewSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 14 * 24 * 60 * 60,
    partialFilterExpression: { status: "Incomplete" },
  },
);

const Interview = mongoose.model("Interview", interviewSchema);
export default Interview;
