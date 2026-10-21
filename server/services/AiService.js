import axios from "axios";

const MAX_ATTEMPTS = 3;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_CODES = new Set(["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTimeout = (error) =>
  !error.response && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT");

// only temporary problems are retried; a wrong key (401) or bad request (400) never is
const isRetryable = (error) =>
  RETRY_STATUS.has(error.response?.status) ||
  (!error.response && RETRY_CODES.has(error.code));

const retryDelayMs = (error, attempt) => {
  const retryAfter = Number(error.response?.headers?.["retry-after"]);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 8000);
  }
  return 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300); // ~1s, ~2s
};

export const askAi = async (messages) => {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages array is empty.");
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openrouter/free",
          messages,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
            "X-Title": "InterviewFlow",
          },
          timeout: 60000, // 60s
        },
      );

      const content = response?.data?.choices?.[0]?.message?.content;

      if (content && content.trim()) return content;

      // free models sometimes return an empty reply, so that is worth retrying too
      lastError = new Error("AI returned empty response");
      console.error(`OpenRouter returned an empty reply (attempt ${attempt}/${MAX_ATTEMPTS})`);
      if (attempt < MAX_ATTEMPTS) await sleep(retryDelayMs({}, attempt));
    } catch (error) {
      lastError = error;
      console.error(
        `OpenRouter Error (attempt ${attempt}/${MAX_ATTEMPTS}):`,
        error.response?.data || error.message,
      );

      // timeouts are slow, so they only get one retry
      const attemptsAllowed = isTimeout(error) ? 2 : MAX_ATTEMPTS;
      if (!isRetryable(error) || attempt >= attemptsAllowed) break;

      await sleep(retryDelayMs(error, attempt));
    }
  }

  throw new Error(
    lastError?.response?.data?.error?.message ||
      lastError?.message ||
      "OpenRouter API Error",
  );
};