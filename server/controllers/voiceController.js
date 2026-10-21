import { transcribeAudio } from "../services/transcribe.js";
import { computeDelivery } from "../utils/deliveryMetrics.js";
import { sendServerError } from "../utils/sendError.js";

export const transcribeAnswer = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Audio required." });
    if (req.file.size < 2000) {
      return res.status(400).json({ message: "That recording was too short." });
    }

    const { text, words } = await transcribeAudio(req.file.buffer, req.file.mimetype);

    if (!text) {
      return res.status(422).json({
        message:
          "We couldn't hear any speech. Check your microphone and try again, or type your answer.",
      });
    }

    return res.json({
      text: text.slice(0, 5000),
      delivery: computeDelivery(words),
    });
  } catch (error) {
    if (error.code === "NO_KEY") {
      return res
        .status(503)
        .json({ message: "Voice answers aren't set up on this server. Please type your answer." });
    }
    if (error.status === 429) {
      return res.status(429).json({
        message: "Voice transcription is busy. Try again in a moment, or type your answer.",
      });
    }
    if (error.name === "TimeoutError") {
      return res
        .status(504)
        .json({ message: "Transcription took too long. Try a shorter answer or type it." });
    }
    return sendServerError(
      res,
      error,
      "Couldn't transcribe your answer. You can type it instead.",
    );
  }
};