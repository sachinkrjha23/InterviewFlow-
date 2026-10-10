import React, { useState, useEffect, useRef } from "react";
import maleVoice from "../assets/videos/male-ai.mp4";
import femaleVoice from "../assets/videos/female-ai.mp4";
import Timer from "./Timer";
import { motion } from "motion/react";
import { BsArrowRight } from "react-icons/bs";
import axios from "axios";
import { serverUrl } from "../App";

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

  const videoRef = useRef(null);
  const currentQuestion = localQuestions[currentIndex];

  const spokenRef = useRef({ intro: false, questionIndex: -1 });
  const feedbackRef = useRef("");

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  useEffect(() => {
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

      if (currentIndex === localQuestions.length - 1) {
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

    setTimeLeft(currentQuestion.timeLimit || 60);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isIntroPhase, isAIPlaying, isSubmitting, feedback, currentIndex]);

  const submitAnswer = async () => {
    if (isSubmitting || feedback) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const result = await axios.post(
        serverUrl + "/api/interview/submitAnswer",
        {
          interviewId,
          questionIndex: currentIndex,
          answer,
          timeTaken: (currentQuestion.timeLimit || 60) - timeLeft,
        },
        { withCredentials: true }
      );

      const data = result.data || {};

      setLocalQuestions((prev) =>
        prev.map((q, i) =>
          i === currentIndex
            ? {
              ...q,
              answer,
              feedback: data.feedback || "",
              score: data.score ?? 0,
              confidence: data.confidence ?? 0,
              communication: data.communication ?? 0,
              correctness: data.correctness ?? 0,
            }
            : q
        )
      );

      setFeedback(data.feedback || "Answer submitted.");
      speakTest(data.feedback || "");
    } catch (error) {
      console.error(error);
      setErrorMsg(error.response?.data?.message || "Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    // On the last question, don't clear the UI first: if finishing fails,
    // the feedback panel (and the Finish button) must stay so it can be retried.
    if (currentIndex + 1 >= localQuestions.length) {
      await finishInterview();
      return;
    }

    setAnswer("");
    setFeedback("");
    setErrorMsg("");
    setCurrentIndex(currentIndex + 1);
    setTimeLeft(localQuestions[currentIndex + 1]?.timeLimit || 60);
  };

  const finishInterview = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setErrorMsg("");

    try {
      window.speechSynthesis.cancel();
      const result = await axios.post(
        serverUrl + "/api/interview/finish",
        { interviewId },
        { withCredentials: true }
      );
      onFinish(result.data);
    } catch (error) {
      console.error(error);
      setErrorMsg(error.response?.data?.message || "Failed to finish interview");
    } finally {
      setIsFinishing(false);
    }
  };

  useEffect(() => {
    if (isIntroPhase || !currentQuestion) return;
    if (timeLeft === 0 && !isSubmitting && !feedback) {
      submitAnswer();
    }
  }, [timeLeft]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleVoiceToggle = (g) => {
    if (isAIPlaying || isSubmitting) return;
    if (g === voiceGender) return;
    if (window.speechSynthesis?.speaking) return;
    setVoiceGender(g);
  };

  const voiceLocked = isAIPlaying || isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white
                    to-teal-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[1400px] min-h-[80vh] bg-white rounded-3xl
                      shadow-2xl border border-gray-200 flex flex-col lg:flex-row overflow-hidden">

        <div className="w-full lg:w-[35%] bg-white flex flex-col items-center
                        p-6 space-y-6 border-r border-gray-200">

          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl">
            <video
              src={videoSource}
              key={videoSource}
              ref={videoRef}
              muted
              playsInline
              preload="auto"
              className="w-full h-auto object-cover"
            />
          </div>

          <div className="flex items-center justify-center gap-2 w-full max-w-md">
            {["male", "female"].map((g) => {
              const active = voiceGender === g;
              return (
                <button
                  key={g}
                  onClick={() => handleVoiceToggle(g)}
                  disabled={voiceLocked}
                  title={
                    voiceLocked
                      ? "Please wait for the AI to finish speaking"
                      : `Switch to ${g} voice`
                  }
                  className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition
                    ${active
                      ? "bg-emerald-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"}
                    ${voiceLocked
                      ? "opacity-50 cursor-not-allowed hover:bg-inherit"
                      : "cursor-pointer"}`}
                >
                  {g === "male" ? "Male Voice" : "Female Voice"}
                </button>
              );
            })}
          </div>

          {subtitle && (
            <div className="w-full max-w-md bg-gray-50 border border-gray-200
                            rounded-xl p-4 shadow-sm">
              <p className="text-gray-700 text-sm sm:text-base font-medium
                            text-center leading-relaxed">
                {subtitle}
              </p>
            </div>
          )}

          <div className="w-full max-w-md bg-white border border-gray-200
                          rounded-2xl shadow-md p-6 space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-500">
                Interview Status
              </span>
              <span className="text-sm font-semibold text-emerald-600">
                {isAIPlaying
                  ? "AI Speaking..."
                  : isSubmitting
                    ? "Evaluating..."
                    : "Your turn"}
              </span>
            </div>

            <div className="h-px bg-gray-200" />

            <div className="flex justify-center">
              <Timer
                timeLeft={timeLeft}
                totalTime={currentQuestion?.timeLimit || 60}
              />
            </div>

            <div className="h-px bg-gray-200" />

            <div className="grid grid-cols-2 gap-6 text-center">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-emerald-600">
                  {currentIndex + 1}
                </span>
                <span className="text-xs text-gray-400">Current Question</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-emerald-600">
                  {localQuestions.length}
                </span>
                <span className="text-xs text-gray-400">Total Questions</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 relative">
          <h2 className="text-xl sm:text-2xl font-bold text-emerald-600 mb-6">
            AI Mock Interview
          </h2>

          {!isIntroPhase && (
            <div className="relative mb-6 bg-gray-50 p-4 sm:p-6 rounded-2xl
                            border border-gray-200 shadow-sm">
              <p className="text-xs sm:text-sm text-gray-400 mb-2">
                Question {currentIndex + 1} of {localQuestions.length}
              </p>
              <div className="text-base sm:text-lg font-semibold text-gray-800
                              leading-relaxed">
                {currentQuestion?.question}
              </div>
            </div>
          )}

          <textarea
            placeholder="Type your answer here..."
            onChange={(e) => setAnswer(e.target.value)}
            value={answer}
            disabled={!!feedback || isSubmitting}
            className="flex-1 min-h-[180px] bg-gray-100 p-4 sm:p-6 rounded-2xl resize-none
                       outline-none border border-gray-200 focus:ring-2
                       focus:ring-emerald-500 transition text-gray-800
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />

          {errorMsg && (
            <p className="mt-4 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {errorMsg}
            </p>
          )}

          {!feedback ? (
            <div className="flex items-center gap-4 mt-6">
              <motion.button
                onClick={submitAnswer}
                disabled={isSubmitting || !answer.trim()}
                whileTap={{ scale: 0.97 }}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500
                           text-white py-3 sm:py-4 rounded-2xl shadow-lg
                           hover:opacity-90 transition font-semibold
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting..." : "Submit Answer"}
              </motion.button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm"
            >
              <p className="text-emerald-700 font-medium mb-4">{feedback}</p>

              {currentQuestion && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "Score", value: currentQuestion.score },
                    { label: "Confidence", value: currentQuestion.confidence },
                    { label: "Communication", value: currentQuestion.communication },
                    { label: "Correctness", value: currentQuestion.correctness },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col items-center bg-white rounded-xl
                                 py-3 border border-emerald-100"
                    >
                      <span className="text-lg font-bold text-emerald-600">
                        {s.value ?? 0}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide text-center">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <motion.button
                onClick={handleNext}
                disabled={isFinishing}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-500
                           text-white py-3 rounded-xl shadow-md hover:opacity-90
                           transition flex items-center justify-center gap-2 font-semibold
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isFinishing
                  ? "Finishing..."
                  : currentIndex + 1 < localQuestions.length
                    ? "Next Question"
                    : "Finish Interview"}
                <BsArrowRight size={18} />
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Step2Interview;