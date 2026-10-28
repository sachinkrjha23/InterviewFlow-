import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../services/transcribe.js", () => ({ transcribeAudio: vi.fn() }));

import { transcribeAudio } from "../services/transcribe.js";
import app from "../app.js";
import genToken from "../config/token.js";

// the voice route only needs a valid login cookie, not a database
const cookie = async () => `token=${await genToken("507f1f77bcf86cd799439011")}`;

const recording = (size = 3000) => Buffer.alloc(size, 1);

const send = async (buffer, { filename = "answer.webm", contentType = "audio/webm" } = {}) =>
  request(app)
    .post("/api/voice/transcribe")
    .set("Cookie", await cookie())
    .attach("audio", buffer, { filename, contentType });

// 12 words, half a second each: exactly 6 seconds, so 120 words per minute
const evenWords = ["so", "um", "I", "built", "a", "REST", "API", "um", "with", "Node", "and", "Express"].map(
  (word, i) => ({ word, start: i * 0.5, end: i * 0.5 + 0.5 }),
);

beforeEach(() => {
  transcribeAudio.mockReset();
});

describe("POST /api/voice/transcribe: request checks", () => {
  it("needs a login", async () => {
    const res = await request(app)
      .post("/api/voice/transcribe")
      .attach("audio", recording(), { filename: "a.webm", contentType: "audio/webm" });
    expect(res.status).toBe(401);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("returns 400 when no audio is sent", async () => {
    const res = await request(app)
      .post("/api/voice/transcribe")
      .set("Cookie", await cookie())
      .field("note", "no audio here");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/audio required/i);
  });

  it("rejects a file that is not an audio recording", async () => {
    const res = await send(recording(), { filename: "photo.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only audio recordings/i);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("returns 400 for a recording that is too short (under 2000 bytes)", async () => {
    const res = await send(recording(1999));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too short/i);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("accepts a recording of exactly 2000 bytes, and browsers' video/webm audio", async () => {
    transcribeAudio.mockResolvedValue({ text: "Hello there", words: [] });

    const res = await send(recording(2000), { contentType: "video/webm" });

    expect(res.status).toBe(200);
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/voice/transcribe: results", () => {
  it("returns the text plus speaking stats worked out from the word timings", async () => {
    transcribeAudio.mockResolvedValue({ text: "So um I built a REST API um with Node and Express", words: evenWords });

    const res = await send(recording());

    expect(res.status).toBe(200);
    expect(res.body.text).toBe("So um I built a REST API um with Node and Express");
    expect(res.body.delivery).toEqual({
      durationSec: 6,
      wordCount: 12,
      wpm: 120,
      fillerCount: 2,
      fillers: [{ word: "um", count: 2 }],
      longPauseCount: 0,
      longestPauseSec: 0,
    });
    const [buffer, mimetype] = transcribeAudio.mock.calls[0];
    expect(buffer).toHaveLength(3000);
    expect(mimetype).toBe("audio/webm");
  });

  it("notices a long pause between words", async () => {
    const words = [
      { word: "hello", start: 0, end: 0.5 },
      { word: "there", start: 2.5, end: 3 },
    ];
    transcribeAudio.mockResolvedValue({ text: "hello there", words });

    const res = await send(recording());

    expect(res.body.delivery).toMatchObject({ longPauseCount: 1, longestPauseSec: 2, wordCount: 2 });
  });

  it("gives no speaking stats when there are no usable word timings", async () => {
    transcribeAudio.mockResolvedValue({ text: "Some text", words: [] });

    const res = await send(recording());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: "Some text", delivery: null });
  });

  it("cuts the text to 5000 characters", async () => {
    transcribeAudio.mockResolvedValue({ text: "a".repeat(6000), words: [] });

    const res = await send(recording());

    expect(res.body.text).toHaveLength(5000);
  });
});

describe("POST /api/voice/transcribe: problems", () => {
  it("answers 422 when no speech was heard", async () => {
    transcribeAudio.mockResolvedValue({ text: "", words: [] });

    const res = await send(recording());

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/couldn't hear any speech/i);
  });

  it("answers 503 when voice is not set up on the server (no Groq key)", async () => {
    transcribeAudio.mockRejectedValue(Object.assign(new Error("GROQ_API_KEY is not set"), { code: "NO_KEY" }));

    const res = await send(recording());

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/aren't set up/i);
    expect(JSON.stringify(res.body)).not.toContain("GROQ_API_KEY");
  });

  it("answers 429 when Groq is busy", async () => {
    transcribeAudio.mockRejectedValue(Object.assign(new Error("Transcription failed (429)"), { status: 429 }));

    const res = await send(recording());

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/busy/i);
  });

  it("answers 504 when transcription takes too long", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    transcribeAudio.mockRejectedValue(timeout);

    const res = await send(recording());

    expect(res.status).toBe(504);
    expect(res.body.message).toMatch(/took too long/i);
  });

  it("answers any other failure with a clean 500 that leaks nothing", async () => {
    transcribeAudio.mockRejectedValue(new Error("secret provider detail: key gsk_123"));

    const res = await send(recording());

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/couldn't transcribe your answer/i);
    expect(JSON.stringify(res.body)).not.toContain("gsk_123");
  });
});