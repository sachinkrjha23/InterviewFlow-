const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

// Casual speech in the prompt nudges Whisper to keep "um" and "uh".
// Whisper sometimes echoes the prompt when the audio is silent, so that is guarded below.
const STYLE_PROMPT = "Um, so, uh, I built, like, a REST API, you know, with Node.";

const extensionFor = (mime) => {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
};

export const transcribeAudio = async (buffer, mimeType) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    const err = new Error("GROQ_API_KEY is not set");
    err.code = "NO_KEY";
    throw err;
  }

  const mime = String(mimeType || "audio/webm").split(";")[0];
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), `answer.${extensionFor(mime)}`);
  form.append("model", process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "en");
  form.append("temperature", "0");
  form.append("prompt", STYLE_PROMPT);

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const err = new Error(`Transcription failed (${response.status})`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  let text = String(data.text || "").trim();

  // the prompt echoed back means there was no real speech
  if (text.toLowerCase().replace(/[^a-z ]/g, "").includes("rest api you know with node")) {
    text = "";
  }

  const words = Array.isArray(data.words)
    ? data.words.filter(
        (w) =>
          typeof w.word === "string" &&
          Number.isFinite(w.start) &&
          Number.isFinite(w.end),
      )
    : [];

  return { text, words: text ? words : [] };
};