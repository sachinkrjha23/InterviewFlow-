import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { transcribeAudio } from "../services/transcribe.js";

const audio = Buffer.alloc(3000, 1);
const okResponse = (data) => ({ ok: true, status: 200, json: async () => data });

// the form that was sent to Groq in the first call
const sentForm = () => fetch.mock.calls[0][1].body;

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
  delete process.env.GROQ_STT_MODEL;
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_STT_MODEL;
});

describe("transcribeAudio: the request to Groq", () => {
  it("fails with code NO_KEY, without calling Groq, when there is no API key", async () => {
    delete process.env.GROQ_API_KEY;

    await expect(transcribeAudio(audio, "audio/webm")).rejects.toMatchObject({ code: "NO_KEY" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a POST with the key and the word-timing settings", async () => {
    fetch.mockResolvedValue(okResponse({ text: "hello", words: [] }));

    await transcribeAudio(audio, "audio/webm");

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-key");
    expect(options.signal).toBeDefined(); // the 45 second time limit

    const form = sentForm();
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("response_format")).toBe("verbose_json");
    expect(form.get("timestamp_granularities[]")).toBe("word");
    expect(form.get("language")).toBe("en");
    expect(form.get("temperature")).toBe("0");
  });

  it("uses the model from GROQ_STT_MODEL when it is set", async () => {
    process.env.GROQ_STT_MODEL = "whisper-large-v3";
    fetch.mockResolvedValue(okResponse({ text: "hello", words: [] }));

    await transcribeAudio(audio, "audio/webm");

    expect(sentForm().get("model")).toBe("whisper-large-v3");
  });

  it.each([
    ["audio/webm;codecs=opus", "answer.webm", "audio/webm"],
    ["audio/ogg", "answer.ogg", "audio/ogg"],
    ["audio/mp4", "answer.m4a", "audio/mp4"],
    ["audio/mpeg", "answer.mp3", "audio/mpeg"],
    ["audio/wav", "answer.wav", "audio/wav"],
    ["audio/x-something-else", "answer.webm", "audio/x-something-else"],
    [undefined, "answer.webm", "audio/webm"],
  ])("names the file for %s as %s", async (mime, fileName, fileType) => {
    fetch.mockResolvedValue(okResponse({ text: "hello", words: [] }));

    await transcribeAudio(audio, mime);

    const file = sentForm().get("file");
    expect(file.name).toBe(fileName);
    expect(file.type).toBe(fileType);
  });
});

describe("transcribeAudio: the answer from Groq", () => {
  it("throws an error that carries the status when Groq refuses", async () => {
    fetch.mockResolvedValue({ ok: false, status: 429 });

    await expect(transcribeAudio(audio, "audio/webm")).rejects.toMatchObject({
      message: "Transcription failed (429)",
      status: 429,
    });
  });

  it("returns the trimmed text and only the words that have a text and valid times", async () => {
    fetch.mockResolvedValue(
      okResponse({
        text: "  Hello there  ",
        words: [
          { word: "Hello", start: 0, end: 0.4 },
          { word: "there", start: 0.5, end: 0.9 },
          { word: 42, start: 1, end: 1.2 }, // not text
          { word: "oops", start: "1", end: 1.4 }, // time is not a number
          { word: "bad", start: 1, end: NaN },
          { word: "nope", end: 2 }, // no start
        ],
      }),
    );

    const result = await transcribeAudio(audio, "audio/webm");

    expect(result.text).toBe("Hello there");
    expect(result.words).toEqual([
      { word: "Hello", start: 0, end: 0.4 },
      { word: "there", start: 0.5, end: 0.9 },
    ]);
  });

  it("treats the echoed style prompt (silent audio) as no speech", async () => {
    fetch.mockResolvedValue(
      okResponse({
        text: "Um, so, uh, I built, like, a REST API, you know, with Node.",
        words: [{ word: "Um", start: 0, end: 0.2 }],
      }),
    );

    expect(await transcribeAudio(audio, "audio/webm")).toEqual({ text: "", words: [] });
  });

  it("returns no words when there is no text, and copes with missing fields", async () => {
    fetch.mockResolvedValueOnce(okResponse({ text: "", words: [{ word: "x", start: 0, end: 1 }] }));
    expect(await transcribeAudio(audio, "audio/webm")).toEqual({ text: "", words: [] });

    fetch.mockResolvedValueOnce(okResponse({}));
    expect(await transcribeAudio(audio, "audio/webm")).toEqual({ text: "", words: [] });

    fetch.mockResolvedValueOnce(okResponse({ text: "just text" }));
    expect(await transcribeAudio(audio, "audio/webm")).toEqual({ text: "just text", words: [] });
  });
});