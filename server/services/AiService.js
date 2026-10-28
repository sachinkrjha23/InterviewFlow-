import axios from "axios";
import { logger } from "../utils/logger.js";

const PRIMARY_ATTEMPTS = 3;
const FALLBACK_ATTEMPTS = 2;
const ATTEMPT_TIMEOUT_MS = 60000; // one request to the model
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_CODES = new Set(["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"]);
// a bad key or no credit: another model won't help
const STOP_STATUS = new Set([401, 402, 403]);

// Whole-call limit: retries and fallback models together never run longer than this
// (hosting platforms cut slow requests, and the user shouldn't wait for minutes).
const deadlineMs = () => Number(process.env.AI_DEADLINE_MS) || 75000;

// Daily request budget, because the free OpenRouter plan has a small daily cap.
// AI_DAILY_LIMIT=0 (or unset) turns it off. Counted in memory, so per server process.
let budgetDay = "";
let budgetUsed = 0;
const dailyLimit = () => Number(process.env.AI_DAILY_LIMIT) || 0;
const today = () => new Date().toISOString().slice(0, 10);

const ensureBudget = () => {
  const limit = dailyLimit();
  if (!limit) return;
  const day = today();
  if (day !== budgetDay) {
    budgetDay = day;
    budgetUsed = 0;
  }
  if (budgetUsed >= limit) {
    const error = new Error("AI daily request limit reached.");
    error.code = "AI_BUDGET";
    throw error;
  }
  budgetUsed += 1;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTimeout = (error) =>
  !error.response && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT");

// only temporary problems are retried; a wrong key (401) or bad request (400) never is
const isRetryable = (error) =>
  RETRY_STATUS.has(error.response?.status) ||
  (!error.response && RETRY_CODES.has(error.code));

// ~1s, ~2s plus up to 0.3s of random jitter; a Retry-After header wins (max 8s)
const retryDelayMs = (error, attempt) => {
  const retryAfter = Number(error.response?.headers?.["retry-after"]);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 8000);
  }
  return 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
};

const deadlineError = () => {
  const error = new Error("AI request took too long.");
  error.code = "ETIMEDOUT";
  return error;
};

// the primary model first, then any backups listed in OPENROUTER_FALLBACK_MODELS
const getModels = () => {
  const primary = process.env.OPENROUTER_MODEL || "openrouter/free";
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
};

const callModel = async (model, messages, maxAttempts, deadline) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) throw lastError || deadlineError();

    ensureBudget();

    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        { model, messages },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
            "X-Title": "InterviewFlow",
          },
          timeout: Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        },
      );

      const content = response?.data?.choices?.[0]?.message?.content;
      if (content && content.trim()) return content;

      // free models sometimes return an empty reply, so that is worth retrying too
      lastError = new Error("AI returned empty response");
      logger.warn({ model, attempt, maxAttempts }, "ai.empty_reply");
      if (attempt < maxAttempts) {
        const wait = retryDelayMs({}, attempt);
        if (Date.now() + wait >= deadline) break;
        await sleep(wait);
      }
    } catch (error) {
      lastError = error;
      logger.warn(
        {
          model,
          attempt,
          maxAttempts,
          status: error.response?.status,
          detail: error.response?.data?.error?.message || error.message,
        },
        "ai.request_failed",
      );

      // timeouts are slow, so they only get one retry
      const attemptsAllowed = isTimeout(error) ? Math.min(2, maxAttempts) : maxAttempts;
      if (!isRetryable(error) || attempt >= attemptsAllowed) break;

      const wait = retryDelayMs(error, attempt);
      if (Date.now() + wait >= deadline) break;
      await sleep(wait);
    }
  }

  throw lastError;
};

// meta is optional: pass {} to find out which model answered (meta.model)
export const askAi = async (messages, meta) => {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages array is empty.");
  }

  const models = getModels();
  const deadline = Date.now() + deadlineMs();
  let lastError;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const content = await callModel(
        model,
        messages,
        i === 0 ? PRIMARY_ATTEMPTS : FALLBACK_ATTEMPTS,
        deadline,
      );
      if (meta && typeof meta === "object") meta.model = model;
      if (i > 0) logger.warn({ model }, "ai.fallback_model_used");
      return content;
    } catch (error) {
      lastError = error;
      if (error.code === "AI_BUDGET") break; // out of budget: other models won't help
      if (STOP_STATUS.has(error.response?.status)) break;
      if (Date.now() >= deadline) break;
    }
  }

  // keep the code so the route can answer "daily limit reached" instead of a generic error
  if (lastError?.code === "AI_BUDGET") throw lastError;

  throw new Error(
    lastError?.response?.data?.error?.message ||
      lastError?.message ||
      "OpenRouter API Error",
  );
};