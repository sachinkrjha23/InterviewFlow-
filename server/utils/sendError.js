import { logger } from "./logger.js";

export const sendServerError = (
  res,
  error,
  message = "Something went wrong. Please try again.",
) => {
  const requestId = res.req?.id;

  // the daily AI budget ran out: say so plainly (nothing is charged when the AI call fails)
  if (error?.code === "AI_BUDGET") {
    logger.warn({ requestId }, "ai.daily_budget_reached");
    return res.status(503).json({
      message:
        "The AI has reached its daily limit. Please try again tomorrow. You haven't been charged.",
      requestId,
    });
  }

  logger.error({ err: error, requestId }, message);
  return res.status(500).json({ message, requestId });
};