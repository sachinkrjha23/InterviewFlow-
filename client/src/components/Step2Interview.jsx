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

  const videoRef = useRef(null);
  const currentQuestion = questions[currentIndex];

  /* ───────── Load TTS voices ───────── */
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      const MALE_HINTS = [
        "male", "david", "mark", "alex", "daniel", "george",
        "james", "ryan", "guy", "ravi", "prabhat", "sachin", "piyush",
      ];
      const FEMALE_HINTS = [
        "female", "zira", "hazel", "samantha", "karen", "susan",
        "heera", "neerja", "saanvi", "aaru", "jenny", "aria", "michelle",
      ];

      const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
      const pool = englishVoices.length ? englishVoices : voices;
      const hints = voiceGender === "male" ? MALE_HINTS : FEMALE_HINTS;

      const picked = pool.find((v) =>
        hints.some((h) => v.name.toLowerCase().includes(h))
      );

      setSelectedVoice(picked || pool[0]);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [voiceGender]);

  const videoSource = voiceGender === "male" ? maleVoice : femaleVoice;

  /* ───────── Speak helper ───────── */
  const speakTest = (text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !selectedVoice) {
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
        videoRef.current?.play();
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

      setSubtitle(text);
      window.speechSynthesis.speak(utterance);
    });
  };

  /* ───────── Intro + question flow ───────── */
  useEffect(() => {
    if (!selectedVoice) return;

    const runIntro = async () => {
      if (isIntroPhase) {
        await speakTest(
          `Hi ${userName}, it's great to meet you today. I hope you're feeling confident and ready.`
        );
        await speakTest(
          `I'll ask you a few questions. Just answer naturally, and take your time. Let's begin.`
        );
        setIsIntroPhase(false);
      } else if (currentQuestion) {
        await new Promise((r) => setTimeout(r, 800));

        if (currentIndex === questions.length - 1) {
          await speakTest("Alright, this one might be a bit more challenging.");
        }

        await speakTest(currentQuestion.question);
      }
    };

    runIntro();
  }, [selectedVoice, isIntroPhase, currentIndex]);

  /* ───────── Timer ───────── */
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

  /* ───────── Submit answer ───────── */
  const submitAnswer = async () => {
    if (isSubmitting || feedback) return;

    setIsSubmitting(true);

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

      setFeedback(result.data.feedback || "Answer submitted.");
      speakTest(result.data.feedback || "");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ───────── Next / Finish ───────── */
  const handleNext = async () => {
    setAnswer("");
    setFeedback("");

    if (currentIndex + 1 >= questions.length) {
      await finishInterview();
      return;
    }

    setCurrentIndex(currentIndex + 1);
    setTimeLeft(questions[currentIndex + 1]?.timeLimit || 60);
  };

  const finishInterview = async () => {
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
      alert(error.response?.data?.message || "Failed to finish interview");
    }
  };

  /* ───────── Auto-submit when timer hits 0 ───────── */
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white
                    to-teal-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[1400px] min-h-[80vh] bg-white rounded-3xl
                      shadow-2xl border border-gray-200 flex flex-col lg:flex-row overflow-hidden">

        {/* ───────── Video Section ───────── */}
        <div className="w-full lg:w-[35%] bg-white flex flex-col items-center
                        p-6 space-y-6 border-r border-gray-200">

          {/* Video */}
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

          {/* Voice toggle */}
          <div className="flex items-center justify-center gap-2 w-full max-w-md">
            <button
              onClick={() => setVoiceGender("male")}
              className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition ${voiceGender === "male"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              Male Voice
            </button>
            <button
              onClick={() => setVoiceGender("female")}
              className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition ${voiceGender === "female"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              Female Voice
            </button>
          </div>

          {/* Subtitles */}
          {subtitle && (
            <div className="w-full max-w-md bg-gray-50 border border-gray-200
                            rounded-xl p-4 shadow-sm">
              <p className="text-gray-700 text-sm sm:text-base font-medium
                            text-center leading-relaxed">
                {subtitle}
              </p>
            </div>
          )}

          {/* Timer card */}
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
                  {questions.length}
                </span>
                <span className="text-xs text-gray-400">Total Questions</span>
              </div>
            </div>
          </div>
        </div>

        {/* ───────── Text Section ───────── */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 relative">
          <h2 className="text-xl sm:text-2xl font-bold text-emerald-600 mb-6">
            AI Smart Interview
          </h2>

          {!isIntroPhase && (
            <div className="relative mb-6 bg-gray-50 p-4 sm:p-6 rounded-2xl
                            border border-gray-200 shadow-sm">
              <p className="text-xs sm:text-sm text-gray-400 mb-2">
                Question {currentIndex + 1} of {questions.length}
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

              <motion.button
                onClick={handleNext}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-500
                           text-white py-3 rounded-xl shadow-md hover:opacity-90
                           transition flex items-center justify-center gap-2 font-semibold"
              >
                {currentIndex + 1 < questions.length
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