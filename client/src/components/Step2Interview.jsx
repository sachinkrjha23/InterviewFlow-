import { useState, useEffect, useRef } from "react";
import maleVoice from "../assets/videos/male-ai.mp4";
import femaleVoice from "../assets/videos/female-ai.mp4";
import Timer from "./Timer";
import { BsArrowRight, BsMicFill, BsRobot, BsStopFill } from "react-icons/bs";
import { useVoiceRecorder } from "../utils/useVoiceRecorder";
import { transcribeBlob } from "../utils/voiceApi";
import { deliverySummary } from "../utils/delivery";
import axios from "axios";
import { serverUrl } from "../config";

function Step2Interview({ interviewData, onFinish }) {
  const { interviewId, questions = [], userName } = interviewData || {};

  const [localQuestions, setLocalQuestions] = useState(questions);

  const [isIntroPhase, setIsIntroPhase] = useState(true);
  const [isAIPlaying, setIsAIPlaying] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(questions[0]?.timeLimit || 60);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceGender, setVoiceGender] = useState("male");
  const [subtitle, setSubtitle] = useState("");
  const [voicesChecked, setVoicesChecked] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [transcribing, setTranscribing] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [voiceMsg, setVoiceMsg] = useState("");

  const videoRef = useRef(null);
  const currentQuestion = localQuestions[currentIndex];

  const spokenRef = useRef({ intro: false, questionIndex: -1 });
  const feedbackRef = useRef("");
  const submitRef = useRef(null);
  const timeLeftRef = useRef(timeLeft);

  const answerRef = useRef("");
  const deliveryRef = useRef(null);
  const transcribePromiseRef = useRef(null);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const handleRecorded = (result) => {
    if (!result || result.blob.size < 2000 || result.peak < 0.01) {
      setVoiceMsg("We barely heard anything. Check your microphone, or type your answer.");
      return;
    }
    setTranscribing(true);
    setVoiceMsg("");
    transcribePromiseRef.current = transcribeBlob(result.blob)
      .then(({ text, delivery: stats }) => {
        answerRef.current = text;
        setAnswer(text);
        deliveryRef.current = stats;
        setDelivery(stats);
      })
      .catch((err) => {
        setVoiceMsg(
          err.response?.data?.message ||
          "Couldn't transcribe your answer. You can type it instead.",
        );
      })
      .finally(() => {
        setTranscribing(false);
        transcribePromiseRef.current = null;
      });
  };

  const voice = useVoiceRecorder({ maxSeconds: 150, onStop: handleRecorded });

  const startRecording = async () => {
    setVoiceMsg("");
    await voice.start();
  };

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    if (!window.speechSynthesis) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      const FEMALE_HINTS = [
        "female", "zira", "hazel", "samantha", "karen", "susan",
        "heera", "neerja", "saanvi", "aaru", "jenny", "aria",
        "michelle", "tessa", "moira", "fiona", "veena",
      ];

      const MALE_HINTS = [
        "male", "david", "mark", "alex", "daniel", "george", "james",
        "ryan", "guy", "ravi", "prabhat", "sachin", "piyush",
        "fred", "tom", "oliver", "rishi",
      ];

      const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
      const pool = englishVoices.length ? englishVoices : voices;

      const picked = pool.find((v) => {
        const name = v.name.toLowerCase();

        if (voiceGender === "female") {
          return FEMALE_HINTS.some((h) => name.includes(h));
        }

        if (name.includes("female")) return false;
        return MALE_HINTS.some((h) => name.includes(h));
      });

      setSelectedVoice(picked || pool[0]);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [voiceGender]);

  // If the browser never provides any TTS voice, stop waiting after 2s
  // and run the interview silently (text only) instead of hanging forever.
  useEffect(() => {
    const t = setTimeout(() => setVoicesChecked(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Refreshing mid-interview loses the session (and the credits), so warn first.
  useEffect(() => {
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const videoSource = voiceGender === "male" ? maleVoice : femaleVoice;

  const speakTest = (text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !selectedVoice || !text) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const humanText = text.replace(/,/g, ", ... ").replace(/\./g, ". ... ");
      const utterance = new SpeechSynthesisUtterance(humanText);

      utterance.voice = selectedVoice;
      utterance.rate = 0.93;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsAIPlaying(true);
        videoRef.current?.play()?.catch(() => { });
      };

      utterance.onend = () => {
        if (videoRef.current) {
          videoRef.current.pause();
          if (videoRef.current.readyState >= 1) {
            videoRef.current.currentTime = 0;
          }
        }
        setIsAIPlaying(false);
        setTimeout(() => {
          setSubtitle("");
          resolve();
        }, 300);
      };

      utterance.onerror = () => {
        setIsAIPlaying(false);
        setSubtitle("");
        resolve();
      };

      setSubtitle(text);
      window.speechSynthesis.speak(utterance);
    });
  };

  useEffect(() => {
    if (!selectedVoice && !voicesChecked) return;

    const runIntro = async () => {
      if (isIntroPhase) {
        if (spokenRef.current.intro) return;
        spokenRef.current.intro = true;

        await speakTest(
          `Hi ${userName?.split(" ")[0] || "there"}, it's great to meet you today. I hope you're feeling confident and ready.`
        );
        await speakTest(
          `I'll ask you a few questions. Just answer naturally, and take your time. Let's begin.`
        );
        setIsIntroPhase(false);
        return;
      }

      if (!currentQuestion) return;
      if (spokenRef.current.questionIndex === currentIndex) return;
      if (feedbackRef.current) return;

      spokenRef.current.questionIndex = currentIndex;

      await new Promise((r) => setTimeout(r, 800));

      const lastMainIndex = localQuestions
        .map((q) => !q.isFollowUp)
        .lastIndexOf(true);
      if (currentQuestion.isFollowUp) {
        await speakTest("Let me follow up on that.");
      } else if (currentIndex === lastMainIndex) {
        await speakTest("Alright, this one might be a bit more challenging.");
      }

      await speakTest(currentQuestion.question);
    };

    runIntro();
  }, [selectedVoice, voicesChecked, isIntroPhase, currentIndex]);

  useEffect(() => {
    if (isIntroPhase) return;
    if (isAIPlaying) return;
    if (isSubmitting) return;
    if (!currentQuestion) return;
    if (feedback) return;

    const timer = setInterval(() => {
      const prev = timeLeftRef.current;
      if (prev <= 0) {
        clearInterval(timer);
        return;
      }

      const next = prev - 1;
      timeLeftRef.current = next;
      setTimeLeft(next);

      if (next === 0) {
        clearInterval(timer);
        submitRef.current?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isIntroPhase, isAIPlaying, isSubmitting, feedback, currentIndex]);

  const submitAnswer = async () => {
    if (isSubmitting || feedback) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // if time ran out mid-recording, finish and transcribe it first
      if (voice.recordingRef.current) await voice.stop();
      if (transcribePromiseRef.current) await transcribePromiseRef.current;
      const finalAnswer = answerRef.current;

      const result = await axios.post(
        serverUrl + "/api/interview/submitAnswer",
        {
          interviewId,
          questionIndex: currentIndex,
          answer: finalAnswer,
          timeTaken: (currentQuestion.timeLimit || 60) - timeLeftRef.current,
          delivery: deliveryRef.current || undefined,
        },
        { withCredentials: true }
      );

      const data = result.data || {};

      setLocalQuestions((prev) => {
        const updated = prev.map((q, i) =>
          i === currentIndex
            ? {
              ...q,
              answer: finalAnswer,
              feedback: data.feedback || "",
              score: data.score ?? 0,
              confidence: data.confidence ?? 0,
              communication: data.communication ?? 0,
              correctness: data.correctness ?? 0,
            }
            : q
        );
        if (data.followUp && data.followUp.index === currentIndex + 1) {
          updated.splice(data.followUp.index, 0, data.followUp);
        }
        return updated;
      });

      setFeedback(data.feedback || "Answer submitted.");
      speakTest(data.feedback || "");
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    submitRef.current = submitAnswer;
  });

  const handleNext = async () => {
    if (currentIndex + 1 >= localQuestions.length) {
      await finishInterview();
      return;
    }

    setAnswer("");
    setFeedback("");
    setErrorMsg("");
    setVoiceMsg("");
    setDelivery(null);
    deliveryRef.current = null;
    setCurrentIndex(currentIndex + 1);
    setTimeLeft(localQuestions[currentIndex + 1]?.timeLimit || 60);
  };

  const finishInterview = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setErrorMsg("");

    try {
      window.speechSynthesis?.cancel();
      const result = await axios.post(
        serverUrl + "/api/interview/finish",
        { interviewId },
        { withCredentials: true }
      );
      onFinish(result.data);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Failed to finish interview");
    } finally {
      setIsFinishing(false);
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleVoiceToggle = (g) => {
    if (isAIPlaying || isSubmitting) return;
    if (g === voiceGender) return;
    if (window.speechSynthesis?.speaking) return;
    setVoiceGender(g);
  };

  const voiceLocked = isAIPlaying || isSubmitting;
  const total = localQuestions.length;
  const mainTotal = localQuestions.filter((q) => !q.isFollowUp).length;
  const mainNumber = localQuestions
    .slice(0, currentIndex + 1)
    .filter((q) => !q.isFollowUp).length;
  const isFollowUp = !!currentQuestion?.isFollowUp;
  const difficulty = String(currentQuestion?.difficulty || "").toLowerCase();
  const difficultyTone = {
    easy: "bg-teal-soft text-teal-deep",
    medium: "bg-amber-soft text-amber-deep",
    hard: "bg-rose-soft text-rose-deep",
  }[difficulty];

  const statusLabel = isAIPlaying
    ? "AI speaking"
    : isSubmitting
      ? "Evaluating"
      : feedback
        ? "Feedback ready"
        : "Your turn";
  const statusTone = isAIPlaying
    ? "bg-indigo-soft text-indigo-deep"
    : isSubmitting
      ? "bg-amber-soft text-amber-deep"
      : "bg-teal-soft text-teal-deep";

  const scoreTiles = [
    { label: "Score", value: currentQuestion?.score, tone: "bg-indigo-soft text-indigo-deep" },
    { label: "Confidence", value: currentQuestion?.confidence, tone: "bg-sky-soft text-sky-deep" },
    { label: "Communication", value: currentQuestion?.communication, tone: "bg-violet-soft text-violet-deep" },
    { label: "Correctness", value: currentQuestion?.correctness, tone: "bg-teal-soft text-teal-deep" },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo text-white">
              <BsRobot size={18} aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-ink">Mock interview</span>
          </div>
          <p className="text-sm text-muted">
            {isIntroPhase
              ? "Getting started"
              : isFollowUp
                ? `Follow-up on question ${mainNumber}`
                : `Question ${mainNumber} of ${mainTotal}`}
          </p>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1.5 px-4 pb-3 sm:px-6" aria-hidden="true">
          {localQuestions.map((q, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < currentIndex || (i === currentIndex && feedback)
                ? "bg-teal"
                : i === currentIndex && !isIntroPhase
                  ? "bg-indigo"
                  : "bg-line"
                }`}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="overflow-hidden rounded-xl bg-canvas">
              <video
                src={videoSource}
                key={videoSource}
                ref={videoRef}
                muted
                playsInline
                preload="auto"
                className="h-auto w-full object-cover"
              />
            </div>

            <div className="mt-4 flex rounded-lg bg-canvas p-1" role="group" aria-label="Interviewer voice">
              {["male", "female"].map((g) => {
                const active = voiceGender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleVoiceToggle(g)}
                    disabled={voiceLocked}
                    aria-pressed={active}
                    title={
                      voiceLocked
                        ? "Please wait for the AI to finish speaking"
                        : `Switch to ${g} voice`
                    }
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? "bg-indigo text-white" : "text-muted hover:text-ink"
                      }`}
                  >
                    {g === "male" ? "Male voice" : "Female voice"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Status</span>
              <span role="status" className={`rounded-md px-2.5 py-1 text-xs font-medium ${statusTone}`}>
                {statusLabel}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted">Time left</span>
              <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit || 60} />
            </div>
          </div>

          {subtitle && (
            <p aria-live="polite" className="rounded-xl bg-sky-soft px-4 py-3 text-sm leading-relaxed text-sky-deep">
              {subtitle}
            </p>
          )}
        </aside>

        <section className="space-y-4">
          {isIntroPhase ? (
            <div className="rounded-2xl border border-line bg-surface p-6">
              <p className="text-sm font-medium text-indigo-deep">Getting ready</p>
              <h1 className="mt-1 text-xl font-medium text-ink">Your interviewer is about to begin</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Listen to the introduction. The first question will appear here, and the timer starts
                once the question has been read out.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">
                    {isFollowUp ? "Follow-up" : `Question ${mainNumber}`}
                  </span>
                  {difficultyTone && (
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${difficultyTone}`}>
                      {difficulty}
                    </span>
                  )}
                </div>
                <h1 className="mt-2 text-lg font-medium leading-relaxed text-ink">
                  {currentQuestion?.question}
                </h1>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4">
                <label htmlFor="interview-answer" className="sr-only">
                  Your answer
                </label>
                <textarea
                  id="interview-answer"
                  placeholder="Type your answer here..."
                  onChange={(e) => setAnswer(e.target.value)}
                  value={answer}
                  maxLength={5000}
                  disabled={!!feedback || isSubmitting || voice.recording || transcribing}
                  className="min-h-[220px] w-full resize-none rounded-lg border border-line-strong bg-surface p-4 text-sm leading-relaxed text-ink focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20 disabled:bg-canvas disabled:opacity-70"
                />
                <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted">
                  <span>When time runs out, your answer is submitted automatically.</span>
                  <span>{answer.length} / 5000</span>
                </div>

                {!feedback && (
                  <div className="mt-3 border-t border-line pt-3">
                    {voice.supported ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {voice.recording ? (
                          <button
                            type="button"
                            onClick={() => voice.stop()}
                            className="inline-flex items-center gap-2 rounded-lg bg-rose px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                          >
                            <BsStopFill size={16} aria-hidden="true" />
                            Stop · {Math.floor(voice.seconds / 60)}:
                            {String(voice.seconds % 60).padStart(2, "0")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={startRecording}
                            disabled={isAIPlaying || isSubmitting || transcribing}
                            className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <BsMicFill size={14} aria-hidden="true" />
                            {answer.trim() ? "Record again" : "Answer by voice"}
                          </button>
                        )}
                        {voice.recording && (
                          <div className="h-2 w-28 rounded-full bg-line" aria-hidden="true">
                            <div
                              className="h-2 rounded-full bg-teal transition-[width] duration-75"
                              style={{ width: `${Math.round(voice.level * 100)}%` }}
                            />
                          </div>
                        )}
                        {transcribing && (
                          <span role="status" className="text-xs text-muted">
                            Transcribing…
                          </span>
                        )}
                        {!voice.recording && !transcribing && (
                          <span className="text-xs text-muted">
                            Recording replaces the text above. You can edit it before submitting.
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">
                        Voice answers aren't available in this browser. Please type your answer.
                      </p>
                    )}
                    {(voice.error || voiceMsg) && (
                      <p role="alert" className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber-deep">
                        {voice.error || voiceMsg}
                      </p>
                    )}
                    {delivery && (
                      <p className="mt-2 text-xs text-sky-deep">
                        Delivery: {deliverySummary(delivery)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {errorMsg && (
                <p role="alert" className="rounded-lg bg-rose-soft px-4 py-3 text-sm text-rose-deep">
                  {errorMsg}
                </p>
              )}

              {!feedback ? (
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={isSubmitting || voice.recording || transcribing || (!answer.trim() && timeLeft > 0)}
                  className="w-full rounded-lg bg-indigo px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting…" : "Submit answer"}
                </button>
              ) : (
                <div role="status" className="rounded-2xl border border-line bg-surface p-5">
                  <h2 className="text-sm font-medium text-ink">Feedback</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{feedback}</p>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {scoreTiles.map((tile) => (
                      <div key={tile.label} className={`rounded-xl p-3 ${tile.tone}`}>
                        <p className="text-xs">{tile.label}</p>
                        <p className="mt-0.5 text-xl font-medium">
                          {tile.value ?? 0}
                          <span className="text-xs font-normal"> /10</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isFinishing}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isFinishing
                      ? "Finishing…"
                      : currentIndex + 1 < total
                        ? "Next question"
                        : "Finish interview"}
                    <BsArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default Step2Interview;