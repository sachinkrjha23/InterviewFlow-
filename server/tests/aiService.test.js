import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

// fresh module (and fresh budget counter) for every test
let askAi;
let axios;

const reply = (content) => ({ data: { choices: [{ message: { content } }] } });
const httpError = (status, headers = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, headers, data: {} } });
const networkError = (code) => Object.assign(new Error(code), { code });

// runs the call while the fake clock moves, and reports how it ended
const run = async (promise) => {
  const settled = promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );
  await vi.runAllTimersAsync();
  return settled;
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-24T10:00:00Z"));
  vi.resetModules();
  delete process.env.AI_DAILY_LIMIT;
  delete process.env.AI_DEADLINE_MS;
  delete process.env.OPENROUTER_FALLBACK_MODELS;
  process.env.OPENROUTER_MODEL = "primary/model";
  axios = (await import("axios")).default;
  axios.post.mockReset();
  ({ askAi } = await import("../services/AiService.js"));
});

afterEach(() => {
  vi.useRealTimers();
});

const MSGS = [{ role: "user", content: "hi" }];

describe("AiService: retries", () => {
  it("returns the reply on the first try", async () => {
    axios.post.mockResolvedValue(reply("hello"));
    const r = await run(askAi(MSGS));
    expect(r).toEqual({ ok: true, value: "hello" });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 and then succeeds", async () => {
    axios.post.mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce(reply("ok"));
    const r = await run(askAi(MSGS));
    expect(r.value).toBe("ok");
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("retries a 503 and an empty reply", async () => {
    axios.post
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(reply("   "))
      .mockResolvedValueOnce(reply("finally"));
    const r = await run(askAi(MSGS));
    expect(r.value).toBe("finally");
    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  it("gives up after 3 attempts on the primary model", async () => {
    axios.post.mockRejectedValue(httpError(500));
    const r = await run(askAi(MSGS));
    expect(r.ok).toBe(false);
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(r.error.message).toBe("HTTP 500");
  });

  it.each([400, 401])("never retries a %i", async (status) => {
    axios.post.mockRejectedValue(httpError(status));
    const r = await run(askAi(MSGS));
    expect(r.ok).toBe(false);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("gives a timeout only one retry", async () => {
    axios.post.mockRejectedValue(networkError("ECONNABORTED"));
    const r = await run(askAi(MSGS));
    expect(r.ok).toBe(false);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("uses the final error message from the provider when there is one", async () => {
    const error = httpError(400);
    error.response.data = { error: { message: "bad prompt" } };
    axios.post.mockRejectedValue(error);
    const r = await run(askAi(MSGS));
    expect(r.error.message).toBe("bad prompt");
  });

  it("rejects an empty messages array without calling the API", async () => {
    const r = await run(askAi([]));
    expect(r.ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe("AiService: fallback models", () => {
  it("uses the fallback model when the primary keeps failing, and reports it in meta", async () => {
    process.env.OPENROUTER_FALLBACK_MODELS = "backup/model";
    axios.post.mockImplementation(async (url, body) => {
      if (body.model === "primary/model") throw httpError(503);
      return reply("from backup");
    });
    const meta = {};
    const r = await run(askAi(MSGS, meta));
    expect(r.value).toBe("from backup");
    expect(meta.model).toBe("backup/model");
    expect(axios.post).toHaveBeenCalledTimes(4); // 3 primary + 1 fallback
  });

  it("does not try the fallback after a 401 (a bad key won't help)", async () => {
    process.env.OPENROUTER_FALLBACK_MODELS = "backup/model";
    axios.post.mockRejectedValue(httpError(401));
    const r = await run(askAi(MSGS));
    expect(r.ok).toBe(false);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

describe("AiService: overall deadline", () => {
  it("stops retrying once the deadline is used up", async () => {
    process.env.AI_DEADLINE_MS = "2500";
    axios.post.mockRejectedValue(httpError(500));
    const r = await run(askAi(MSGS));
    expect(r.ok).toBe(false);
    // attempt 1, wait ~1s, attempt 2, next wait (~2s) would pass 2.5s: stop
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("caps each request's timeout to the time that is left", async () => {
    process.env.AI_DEADLINE_MS = "20000";
    axios.post.mockResolvedValue(reply("ok"));
    await run(askAi(MSGS));
    expect(axios.post.mock.calls[0][2].timeout).toBeLessThanOrEqual(20000);
  });
});

describe("AiService: daily budget", () => {
  it("is off by default", async () => {
    axios.post.mockResolvedValue(reply("ok"));
    for (let i = 0; i < 5; i++) await run(askAi(MSGS));
    expect(axios.post).toHaveBeenCalledTimes(5);
  });

  it("blocks with code AI_BUDGET once the limit is reached, without calling the API", async () => {
    process.env.AI_DAILY_LIMIT = "2";
    axios.post.mockResolvedValue(reply("ok"));
    await run(askAi(MSGS));
    await run(askAi(MSGS));
    const r = await run(askAi(MSGS));
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("AI_BUDGET");
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("counts retries, not just calls", async () => {
    process.env.AI_DAILY_LIMIT = "2";
    axios.post.mockRejectedValue(httpError(500));
    const r = await run(askAi(MSGS));
    expect(r.error.code).toBe("AI_BUDGET");
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("resets on a new day", async () => {
    process.env.AI_DAILY_LIMIT = "1";
    axios.post.mockResolvedValue(reply("ok"));
    await run(askAi(MSGS));
    expect((await run(askAi(MSGS))).ok).toBe(false);
    vi.setSystemTime(new Date("2026-10-25T00:30:00Z"));
    expect((await run(askAi(MSGS))).ok).toBe(true);
  });
});