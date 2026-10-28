import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { sendServerError } from "../utils/sendError.js";
import { logger } from "../utils/logger.js";

const fakeRes = (id = "req-123") => {
  const res = { req: { id } };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe("sendServerError", () => {
  it("sends a generic 500 with the request id and leaks no internal detail", () => {
    const res = fakeRes();
    sendServerError(res, new Error("mongo://user:pass@host exploded"), "Failed to submit answer.");

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({ message: "Failed to submit answer.", requestId: "req-123" });
    expect(JSON.stringify(body)).not.toContain("mongo://");
  });

  it("logs the real error server-side with the request id", () => {
    const res = fakeRes("req-9");
    const error = new Error("boom");
    sendServerError(res, error);

    expect(logger.error).toHaveBeenCalledWith({ err: error, requestId: "req-9" }, expect.any(String));
  });

  it("uses a default message when none is given", () => {
    const res = fakeRes();
    sendServerError(res, new Error("x"));
    expect(res.json.mock.calls[0][0].message).toMatch(/something went wrong/i);
  });

  it("answers 503 with a plain message when the daily AI budget is used up", () => {
    const res = fakeRes();
    const error = Object.assign(new Error("AI daily request limit reached."), { code: "AI_BUDGET" });
    sendServerError(res, error, "Couldn't create your interview.");

    expect(res.status).toHaveBeenCalledWith(503);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/daily limit/i);
    expect(body.message).toMatch(/haven't been charged/i);
    expect(body.requestId).toBe("req-123");
  });
});