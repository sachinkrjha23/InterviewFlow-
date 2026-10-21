import { useState } from "react";
import { BsMicFill } from "react-icons/bs";
import { useVoiceRecorder } from "../utils/useVoiceRecorder";
import { transcribeBlob } from "../utils/voiceApi";

function MicCheck() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null); 

  const handleRecorded = async ({ blob, peak }) => {
    if (blob.size < 2000 || peak < 0.01) {
      setResult({
        type: "warn",
        text: "We barely heard anything. Check that the right microphone is selected and not muted.",
      });
      return;
    }
    setChecking(true);
    try {
      const { text } = await transcribeBlob(blob);
      setResult({
        type: "ok",
        text: `We heard: “${text.slice(0, 120)}”. Your microphone works for voice answers.`,
      });
    } catch (err) {
      setResult({
        type: "warn",
        text:
          err.response?.data?.message ||
          "Couldn't check your microphone right now. You can still type your answers.",
      });
    } finally {
      setChecking(false);
    }
  };

  const voice = useVoiceRecorder({ maxSeconds: 4, onStop: handleRecorded });

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-medium text-ink">
        Voice answers <span className="font-normal text-muted">(optional)</span>
      </h2>
      <p className="mt-1 text-xs text-muted">
        You can speak your answers instead of typing them. Test your microphone first: press the
        button and say “testing, one, two, three”. If your laptop microphone sounds noisy, a headset
        usually works better.
      </p>

      {voice.supported ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              voice.start();
            }}
            disabled={voice.recording || checking}
            className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BsMicFill size={14} aria-hidden="true" />
            {voice.recording ? "Listening…" : checking ? "Checking…" : "Test microphone"}
          </button>

          {voice.recording && (
            <div className="h-2 w-28 rounded-full bg-line" aria-hidden="true">
              <div
                className="h-2 rounded-full bg-teal transition-[width] duration-75"
                style={{ width: `${Math.round(voice.level * 100)}%` }}
              />
            </div>
          )}

          {voice.devices.length > 1 && (
            <select
              aria-label="Microphone"
              value={voice.deviceId}
              onChange={(e) => voice.setDeviceId(e.target.value)}
              disabled={voice.recording || checking}
              className="max-w-[14rem] rounded-lg border border-line bg-canvas px-2 py-2 text-xs text-ink"
            >
              <option value="">Default microphone</option>
              {voice.devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microphone"}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">
          Your browser can't record audio, so you'll type your answers.
        </p>
      )}

      {voice.error && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs text-rose-deep">
          {voice.error}
        </p>
      )}
      {result && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            result.type === "ok" ? "bg-teal-soft text-teal-deep" : "bg-amber-soft text-amber-deep"
          }`}
        >
          {result.text}
        </p>
      )}
    </section>
  );
}

export default MicCheck;