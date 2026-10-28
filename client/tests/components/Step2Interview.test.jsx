import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import Step2Interview from "../../src/components/Step2Interview.jsx";
import { transcribeBlob } from "../../src/utils/voiceApi.js";

vi.mock("axios", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock("../../src/utils/voiceApi.js", () => ({ transcribeBlob: vi.fn() }));

// A small stand-in for the microphone recorder. It has the same shape as the real hook,
// but the test decides when recording starts, stops and what was "recorded".
const mic = vi.hoisted(() => ({
  supported: true,
  error: "",
  onStop: null,
  setRecording: null,
  nextRecording: null,
  start: null,
  stop: null,
}));

vi.mock("../../src/utils/useVoiceRecorder.js", async () => {
  const { useRef, useState } = await import("react");
  return {
    useVoiceRecorder: ({ onStop }) => {
      const [recording, setRecordingState] = useState(false);
      const recordingRef = useRef(false);
      mic.onStop = onStop;
      mic.setRecording = (value) => {
        recordingRef.current = value;
        setRecordingState(value);
      };
      return {
        supported: mic.supported,
        recording,
        recordingRef,
        seconds: 0,
        level: 0,
        error: mic.error,
        start: (...args) => mic.start(...args),
        stop: (...args) => mic.stop(...args),
      };
    },
  };
});

const SUBMIT_URL = "http://localhost:1000/api/interview/submitAnswer";
const FINISH_URL = "http://localhost:1000/api/interview/finish";

const questions = () => [
  { question: "What is a closure?", timeLimit: 5, difficulty: "Easy" },
  { question: "Explain the event loop.", timeLimit: 5, difficulty: "Hard" },
];

const feedbackFor = (over = {}) => ({
  feedback: "Good answer.",
  score: 8,
  confidence: 7,
  communication: 8,
  correctness: 9,
  ...over,
});

const voiceStats = {
  wpm: 130,
  wordCount: 30,
  durationSec: 14,
  fillerCount: 2,
  fillers: [{ word: "um", count: 2 }],
  longPauseCount: 1,
};

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
};
const advance = async (ms) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flush();
};

let user;
let onFinish;

// There is no speech engine in the test browser, so the interview waits 2 seconds
// and then runs in text-only mode (this is the app's own fallback).
const begin = async (data = {}) => {
  onFinish = vi.fn();
  render(
    <Step2Interview
      interviewData={{ interviewId: "iv1", questions: questions(), userName: "Sachin Jha", ...data }}
      onFinish={onFinish}
    />,
  );
  await advance(2000);
};

const typeAnswer = async (text) => {
  await user.type(screen.getByLabelText("Your answer"), text);
};
const submitButton = () => screen.getByRole("button", { name: /submit answer|submitting/i });

beforeEach(() => {
  vi.useFakeTimers();
  // Testing Library only notices fake timers when a global "jest" exists. Without this line
  // every user.click() waits on a real timer that never fires and the test hangs.
  globalThis.jest = { advanceTimersByTime: (ms) => vi.advanceTimersByTime(ms) };
  user = userEvent.setup({ delay: null });
  axios.post.mockReset();
  transcribeBlob.mockReset();
  mic.supported = true;
  mic.error = "";
  mic.nextRecording = { blob: { size: 5000 }, peak: 0.5 };
  mic.start = vi.fn(async () => {
    mic.setRecording(true);
    return true;
  });
  mic.stop = vi.fn(async () => {
    mic.setRecording(false);
    await mic.onStop(mic.nextRecording);
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.jest;
});

describe("Step2Interview: start", () => {
  it("shows the intro first, then the first question once the intro is over", async () => {
    onFinish = vi.fn();
    render(<Step2Interview interviewData={{ interviewId: "iv1", questions: questions() }} onFinish={onFinish} />);

    expect(screen.getByText("Your interviewer is about to begin")).toBeInTheDocument();
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.queryByText("What is a closure?")).not.toBeInTheDocument();

    await advance(2000);

    expect(screen.getByText("What is a closure?")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveAccessibleName("5 seconds left");
  });

  it("warns before the page is refreshed or closed", async () => {
    await begin();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("Step2Interview: submitting an answer", () => {
  it("keeps Submit disabled until something is typed", async () => {
    await begin();
    expect(submitButton()).toBeDisabled();

    await typeAnswer("A function that remembers its scope");
    expect(submitButton()).toBeEnabled();
  });

  it("sends the answer and the time taken, then shows the feedback and scores", async () => {
    await begin();
    axios.post.mockResolvedValue({ data: feedbackFor() });

    await typeAnswer("A function that remembers its scope");
    await advance(2000); // the person thought for 2 seconds
    await user.click(submitButton());
    await flush();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      SUBMIT_URL,
      {
        interviewId: "iv1",
        questionIndex: 0,
        answer: "A function that remembers its scope",
        timeTaken: 2,
        delivery: undefined,
      },
      { withCredentials: true },
    );
    expect(screen.getByText("Good answer.")).toBeInTheDocument();
    expect(screen.getByText("Score").parentElement).toHaveTextContent("8");
    expect(screen.getByText("Correctness").parentElement).toHaveTextContent("9");
    expect(screen.getByRole("button", { name: /next question/i })).toBeInTheDocument();
  });

  it("shows 'Submitting…' and blocks a second click while the answer is being checked", async () => {
    await begin();
    let finish;
    axios.post.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await typeAnswer("My answer");
    await user.click(submitButton());
    await flush();

    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
    expect(screen.getByLabelText("Your answer")).toBeDisabled();
    expect(axios.post).toHaveBeenCalledTimes(1);

    finish({ data: feedbackFor() });
    await flush();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("shows the server's message when submitting fails, then lets the person try again", async () => {
    await begin();
    axios.post.mockRejectedValueOnce({ response: { data: { message: "AI is busy, try again" } } });

    await typeAnswer("My answer");
    await user.click(submitButton());
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("AI is busy, try again");
    expect(screen.queryByText("Good answer.")).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
    expect(screen.getByLabelText("Your answer")).toHaveValue("My answer");

    axios.post.mockResolvedValueOnce({ data: feedbackFor() });
    await user.click(submitButton());
    await flush();
    expect(screen.getByText("Good answer.")).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});

describe("Step2Interview: follow-up questions and numbering", () => {
  const followUp = { index: 1, question: "Can you give an example?", isFollowUp: true, timeLimit: 5, difficulty: "Medium" };

  const answerCurrent = async (text, response) => {
    axios.post.mockResolvedValueOnce({ data: response });
    await typeAnswer(text);
    await user.click(submitButton());
    await flush();
  };

  it("inserts the follow-up right after its question and does not count it as a main question", async () => {
    await begin();

    await answerCurrent("First answer", feedbackFor({ followUp }));
    await user.click(screen.getByRole("button", { name: /next question/i }));

    expect(screen.getByText("Can you give an example?")).toBeInTheDocument();
    expect(screen.getByText("Follow-up on question 1")).toBeInTheDocument();
    expect(screen.getByText("Follow-up")).toBeInTheDocument();

    await answerCurrent("Follow-up answer", feedbackFor());
    expect(axios.post.mock.calls[1][1].questionIndex).toBe(1); // the follow-up has its own place in the list

    await user.click(screen.getByRole("button", { name: /next question/i }));

    expect(screen.getByText("Explain the event loop.")).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument(); // still 2 main questions
    expect(axios.post.mock.calls[1][0]).toBe(SUBMIT_URL);
  });

  it("goes straight to the next question when there is no follow-up", async () => {
    await begin();
    await answerCurrent("First answer", feedbackFor());
    await user.click(screen.getByRole("button", { name: /next question/i }));

    expect(screen.getByText("Explain the event loop.")).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
  });

  it("ignores a follow-up that does not belong right after the current question", async () => {
    await begin();
    await answerCurrent("First answer", feedbackFor({ followUp: { ...followUp, index: 5 } }));
    await user.click(screen.getByRole("button", { name: /next question/i }));

    expect(screen.queryByText("Can you give an example?")).not.toBeInTheDocument();
    expect(screen.getByText("Explain the event loop.")).toBeInTheDocument();

    // no hidden extra step was added: the second question is the last one
    await answerCurrent("Second answer", feedbackFor());
    expect(screen.getByRole("button", { name: /finish interview/i })).toBeInTheDocument();
  });

  it("offers 'Finish interview' only on the very last question, and a follow-up counts as one more step", async () => {
    await begin();
    await answerCurrent("First answer", feedbackFor({ followUp }));
    expect(screen.getByRole("button", { name: /next question/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next question/i }));

    await answerCurrent("Follow-up answer", feedbackFor());
    expect(screen.getByRole("button", { name: /next question/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next question/i }));

    await answerCurrent("Last answer", feedbackFor());
    expect(screen.queryByRole("button", { name: /next question/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finish interview/i })).toBeInTheDocument();
  });
});

describe("Step2Interview: finishing", () => {
  const reachLastQuestion = async () => {
    axios.post.mockResolvedValueOnce({ data: feedbackFor() });
    await typeAnswer("First answer");
    await user.click(submitButton());
    await flush();
    await user.click(screen.getByRole("button", { name: /next question/i }));
    axios.post.mockResolvedValueOnce({ data: feedbackFor() });
    await typeAnswer("Second answer");
    await user.click(submitButton());
    await flush();
  };

  it("finishes the interview on the server and passes the result to the parent", async () => {
    await begin();
    await reachLastQuestion();

    const report = { _id: "iv1", finalScore: 8.2 };
    axios.post.mockResolvedValueOnce({ data: report });
    await user.click(screen.getByRole("button", { name: /finish interview/i }));
    await flush();

    expect(axios.post).toHaveBeenLastCalledWith(FINISH_URL, { interviewId: "iv1" }, { withCredentials: true });
    expect(onFinish).toHaveBeenCalledWith(report);
  });

  it("shows an error and stays on the page when finishing fails", async () => {
    await begin();
    await reachLastQuestion();

    axios.post.mockRejectedValueOnce(new Error("network"));
    await user.click(screen.getByRole("button", { name: /finish interview/i }));
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to finish interview");
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /finish interview/i })).toBeEnabled();
  });
});

describe("Step2Interview: voice answers", () => {
  it("disables Submit and the text box while the microphone is recording", async () => {
    await begin();
    await typeAnswer("typed first");
    expect(submitButton()).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /record again/i }));
    await flush();

    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(screen.getByLabelText("Your answer")).toBeDisabled();
  });

  it("disables Submit while the recording is being transcribed, then fills in the text and delivery", async () => {
    await begin();
    let finish;
    transcribeBlob.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await typeAnswer("typed first"); // so only the transcribing state can be what disables Submit
    await user.click(screen.getByRole("button", { name: /record again/i }));
    await flush();
    await user.click(screen.getByRole("button", { name: /stop/i }));
    await flush();

    expect(screen.getByText("Transcribing…")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(screen.getByLabelText("Your answer")).toBeDisabled();

    finish({ text: "I built a REST API", delivery: voiceStats });
    await flush();

    expect(screen.queryByText("Transcribing…")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your answer")).toHaveValue("I built a REST API");
    expect(screen.getByText("Delivery: 130 wpm (good pace) · 2 filler words · 1 long pause")).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("sends the delivery stats with the answer, and clears them for the next question", async () => {
    await begin();
    transcribeBlob.mockResolvedValue({ text: "I built a REST API", delivery: voiceStats });

    await user.click(screen.getByRole("button", { name: /answer by voice/i }));
    await flush();
    await user.click(screen.getByRole("button", { name: /stop/i }));
    await flush();

    axios.post.mockResolvedValueOnce({ data: feedbackFor() });
    await user.click(submitButton());
    await flush();
    expect(axios.post.mock.calls[0][1]).toMatchObject({ answer: "I built a REST API", delivery: voiceStats });

    await user.click(screen.getByRole("button", { name: /next question/i }));
    axios.post.mockResolvedValueOnce({ data: feedbackFor() });
    await typeAnswer("Typed answer");
    await user.click(submitButton());
    await flush();

    expect(axios.post.mock.calls[1][1].answer).toBe("Typed answer");
    expect(axios.post.mock.calls[1][1].delivery).toBeUndefined();
  });

  it.each([
    ["a tiny recording", { blob: { size: 100 }, peak: 0.5 }],
    ["a silent recording", { blob: { size: 9000 }, peak: 0.001 }],
  ])("does not call the server for %s and tells the person", async (_name, recording) => {
    await begin();
    mic.nextRecording = recording;

    await user.click(screen.getByRole("button", { name: /answer by voice/i }));
    await flush();
    await user.click(screen.getByRole("button", { name: /stop/i }));
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("We barely heard anything");
    expect(transcribeBlob).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Your answer")).toBeEnabled();
  });

  it("shows the server's message when transcribing fails, and typing still works", async () => {
    await begin();
    transcribeBlob.mockRejectedValue({ response: { data: { message: "Voice service is busy" } } });

    await user.click(screen.getByRole("button", { name: /answer by voice/i }));
    await flush();
    await user.click(screen.getByRole("button", { name: /stop/i }));
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("Voice service is busy");
    await typeAnswer("I will type instead");
    expect(submitButton()).toBeEnabled();
  });

  it("tells the person to type when voice answers are not available", async () => {
    mic.supported = false;
    await begin();

    expect(screen.getByText(/voice answers aren't available in this browser/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /answer by voice/i })).not.toBeInTheDocument();
    await typeAnswer("Typing works");
    expect(submitButton()).toBeEnabled();
  });

  it("shows a microphone problem reported by the recorder", async () => {
    mic.error = "Microphone access is blocked.";
    await begin();
    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access is blocked.");
  });
});

describe("Step2Interview: the timer", () => {
  it("counts down every second", async () => {
    await begin();
    expect(screen.getByRole("timer")).toHaveAccessibleName("5 seconds left");

    await advance(3000);
    expect(screen.getByRole("timer")).toHaveAccessibleName("2 seconds left");
  });

  it("submits by itself when time runs out, with whatever was typed, and not before", async () => {
    await begin();
    axios.post.mockResolvedValue({ data: feedbackFor() });
    await typeAnswer("Half finished answer");

    await advance(4000);
    expect(axios.post).not.toHaveBeenCalled();

    await advance(1000);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toBe(SUBMIT_URL);
    expect(axios.post.mock.calls[0][1]).toMatchObject({
      questionIndex: 0,
      answer: "Half finished answer",
      timeTaken: 5, // the whole 5 second limit was used
    });
    expect(screen.getByText("Good answer.")).toBeInTheDocument();

    await advance(10000); // no second submit after the feedback is shown
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("submits an empty answer when time runs out with nothing typed, so the interview can go on", async () => {
    await begin();
    axios.post.mockResolvedValue({ data: feedbackFor({ score: 0 }) });

    await advance(5000);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1].answer).toBe("");
    expect(screen.getByRole("button", { name: /next question/i })).toBeInTheDocument();
  });

  it("finishes a recording that is still running when time runs out, and submits what it heard", async () => {
    await begin();
    // the transcript arrives half a second after the recording stops
    transcribeBlob.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ text: "Spoken at the last second", delivery: voiceStats }), 500)),
    );
    axios.post.mockResolvedValue({ data: feedbackFor() });

    await user.click(screen.getByRole("button", { name: /answer by voice/i }));
    await flush();
    await advance(5000);

    expect(mic.stop).toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled(); // it waits for the transcript, it does not send an empty answer

    await advance(500);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1]).toMatchObject({
      answer: "Spoken at the last second",
      delivery: voiceStats,
    });
  });

  it("starts the next question with a fresh timer and an empty answer", async () => {
    await begin();
    axios.post.mockResolvedValue({ data: feedbackFor() });
    await typeAnswer("First answer");
    await advance(2000);
    await user.click(submitButton());
    await flush();

    await user.click(screen.getByRole("button", { name: /next question/i }));

    expect(screen.getByLabelText("Your answer")).toHaveValue("");
    expect(screen.getByRole("timer")).toHaveAccessibleName("5 seconds left");
  });
});