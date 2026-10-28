import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Step3Report from "../../src/components/Step3Report.jsx";
import { fetchModelAnswers } from "../../src/utils/reportApi.js";
import { generateReportPdf } from "../../src/utils/generateReportPdf.js";
import { renderWithProviders } from "../helpers/renderWithProviders.jsx";

vi.mock("../../src/utils/reportApi.js", () => ({ fetchModelAnswers: vi.fn() }));
vi.mock("../../src/utils/generateReportPdf.js", () => ({ generateReportPdf: vi.fn() }));
// the chart library is not under test: this stand-in just prints the data it was given
vi.mock("../../src/components/ScoreChart.jsx", () => ({
  default: ({ data }) => `chart: ${data.map((d) => `${d.name}=${d.score}`).join(", ")}`,
}));

const voice = (over = {}) => ({
  wpm: 120,
  wordCount: 60,
  durationSec: 30,
  fillerCount: 2,
  fillers: [{ word: "um", count: 2 }],
  longPauseCount: 1,
  ...over,
});

const makeReport = (over = {}) => ({
  interviewId: "iv1",
  role: "Frontend Developer",
  experience: "1-2 years",
  mode: "Technical",
  createdAt: "2026-03-05T12:00:00Z",
  status: "Completed",
  totalQuestions: 3,
  finalScore: 7.5,
  confidence: 7,
  communication: 8,
  correctness: 7,
  questionWiseScore: [
    { index: 0, question: "What is a closure?", answer: "A function with its scope", score: 8, feedback: "Clear.", confidence: 8, communication: 8, correctness: 8, difficulty: "Easy" },
    { index: 1, question: "Can you give an example?", isFollowUp: true, answer: "", score: 3, confidence: 3, communication: 3, correctness: 3 },
    { index: 2, question: "What is the event loop?", answer: "It runs tasks", score: 6, feedback: "Okay.", confidence: 6, communication: 6, correctness: 6 },
  ],
  ...over,
});

const withModelAnswers = (report) => ({
  ...report,
  questionWiseScore: report.questionWiseScore.map((q, i) => ({ ...q, modelAnswer: `Stored model answer ${i}` })),
});

const setup = (props = {}) => {
  const user = userEvent.setup();
  const view = renderWithProviders(<Step3Report report={makeReport()} {...props} />);
  return { user, ...view };
};

const showButtons = () => screen.getAllByRole("button", { name: "Show model answer" });

beforeEach(() => {
  fetchModelAnswers.mockReset();
  generateReportPdf.mockReset();
  generateReportPdf.mockResolvedValue(undefined);
});

describe("Step3Report: the overview", () => {
  it("shows nothing when there is no report", () => {
    const { container } = renderWithProviders(<Step3Report report={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the role, experience, mode, date and the overall scores", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Frontend Developer" })).toBeInTheDocument();
    expect(screen.getByText("1-2 years")).toBeInTheDocument();
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("5 Mar 2026")).toBeInTheDocument();
    expect(screen.getByText("7.5")).toBeInTheDocument();
    expect(screen.getAllByText("Communication")[0].closest("div")).toHaveTextContent("8.0"); // the overview tile comes first
  });

  it.each([
    [9.2, "Outstanding", "Strong performance."],
    [8, "Excellent", "Strong performance."],
    [7, "Good", "Solid base, room to improve."],
    [5, "Average", "Solid base, room to improve."],
    [4.9, "Needs work", "Needs more practice."],
  ])("a final score of %s is graded %s", (finalScore, grade, headline) => {
    setup({ report: makeReport({ finalScore }) });
    expect(screen.getByText(grade)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: headline })).toBeInTheDocument();
  });

  it("says clearly when the interview was not finished", () => {
    setup({ report: makeReport({ status: "Incomplete", totalQuestions: undefined, finalScore: 9 }) });
    expect(screen.getByText(/this interview wasn't finished/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Interview not finished" })).toBeInTheDocument();
    expect(screen.getByText(/you answered 3 of 6 questions/i)).toBeInTheDocument(); // 6 is the default total
    expect(screen.queryByText("Strong performance.")).not.toBeInTheDocument();
  });

  it("does not show the unfinished warning for a completed interview", () => {
    setup();
    expect(screen.queryByText(/this interview wasn't finished/i)).not.toBeInTheDocument();
  });
});

describe("Step3Report: question numbering", () => {
  it("numbers main questions in order and skips follow-ups, in the list and in the chart", () => {
    setup();
    expect(screen.getByText(/^Question 1/)).toBeInTheDocument();
    expect(screen.getByText("Follow-up")).toBeInTheDocument();
    expect(screen.getByText(/^Question 2/)).toBeInTheDocument();
    expect(screen.queryByText(/^Question 3/)).not.toBeInTheDocument();
    expect(screen.getByText("chart: Q1=8, Q1+=3, Q2=6")).toBeInTheDocument();
  });

  it("shows each answer, feedback and score, and 'No answer submitted.' for an empty answer", () => {
    setup();
    expect(screen.getByText("A function with its scope")).toBeInTheDocument();
    expect(screen.getByText("Clear.")).toBeInTheDocument();
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
    expect(screen.getByText("No answer submitted.")).toBeInTheDocument();
  });
});

describe("Step3Report: speaking delivery", () => {
  it("shows no delivery card when no answer was spoken", () => {
    setup();
    expect(screen.queryByText("Speaking delivery")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Delivery:/)).not.toBeInTheDocument();
  });

  it("shows the delivery card only with voice data, and a delivery line for the voice answers only", () => {
    const report = makeReport();
    report.questionWiseScore[0].delivery = voice();
    setup({ report });

    expect(screen.getByText("Speaking delivery")).toBeInTheDocument();
    expect(screen.getByText("good pace")).toBeInTheDocument();
    expect(screen.getByText("um ×2")).toBeInTheDocument();
    expect(screen.getByText(/based on 1 recorded answer\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Delivery:/)).toHaveLength(1);
    expect(screen.getByText("Delivery: 120 wpm (good pace) · 2 filler words · 1 long pause")).toBeInTheDocument();
  });

  it("ignores delivery data with no words", () => {
    const report = makeReport();
    report.questionWiseScore[0].delivery = voice({ wordCount: 0 });
    setup({ report });
    expect(screen.queryByText("Speaking delivery")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Delivery:/)).not.toBeInTheDocument();
  });
});

describe("Step3Report: model answers", () => {
  it("fetches a model answer once, then only shows and hides it", async () => {
    fetchModelAnswers.mockResolvedValue({ 0: "A closure keeps its outer scope alive." });
    const { user } = setup();

    await user.click(showButtons()[0]);

    expect(fetchModelAnswers).toHaveBeenCalledTimes(1);
    expect(fetchModelAnswers).toHaveBeenCalledWith("iv1", 0);
    expect(await screen.findByText("A closure keeps its outer scope alive.")).toBeInTheDocument();
    const hide = screen.getByRole("button", { name: "Hide model answer" });
    expect(hide).toHaveAttribute("aria-expanded", "true");

    await user.click(hide);
    await waitFor(() => expect(screen.queryByText("A closure keeps its outer scope alive.")).not.toBeInTheDocument());

    await user.click(screen.getAllByRole("button", { name: "Show model answer" })[0]);
    expect(await screen.findByText("A closure keeps its outer scope alive.")).toBeInTheDocument();
    expect(fetchModelAnswers).toHaveBeenCalledTimes(1);
  });

  it("uses a model answer that is already saved in the report without fetching", async () => {
    const { user } = setup({ report: withModelAnswers(makeReport()) });

    await user.click(showButtons()[2]);

    expect(await screen.findByText("Stored model answer 2")).toBeInTheDocument();
    expect(fetchModelAnswers).not.toHaveBeenCalled();
  });

  it("shows progress and locks the other model answer buttons while one is being prepared", async () => {
    let finish;
    fetchModelAnswers.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user } = setup();

    await user.click(showButtons()[0]);

    expect(screen.getByRole("button", { name: "Preparing model answer…" })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "Show model answer" })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Show all model answers" })).toBeDisabled();

    finish({ 0: "Done." });
    expect(await screen.findByText("Done.")).toBeInTheDocument();
  });

  it("shows the server's message when preparing fails, and lets the person try again", async () => {
    fetchModelAnswers.mockRejectedValueOnce({ response: { data: { message: "AI is busy right now" } } });
    const { user } = setup();

    await user.click(showButtons()[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("AI is busy right now");

    fetchModelAnswers.mockResolvedValueOnce({ 0: "Second try worked." });
    await user.click(showButtons()[0]);
    expect(await screen.findByText("Second try worked.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a general message when the server returns no answer for that question", async () => {
    fetchModelAnswers.mockResolvedValue({});
    const { user } = setup();

    await user.click(showButtons()[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't prepare the model answer. Please try again.");
  });

  it("'Show all' fetches everything in one request, opens all, then hides and shows without fetching again", async () => {
    fetchModelAnswers.mockResolvedValue({ 0: "MA zero", 1: "MA one", 2: "MA two" });
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Show all model answers" }));

    expect(fetchModelAnswers).toHaveBeenCalledTimes(1);
    expect(fetchModelAnswers).toHaveBeenCalledWith("iv1");
    expect(await screen.findByText("MA two")).toBeInTheDocument();
    expect(screen.getByText("MA zero")).toBeInTheDocument();
    expect(screen.getByText("MA one")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide all model answers" }));
    await waitFor(() => expect(screen.queryByText("MA zero")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Show all model answers" }));
    expect(await screen.findByText("MA zero")).toBeInTheDocument();
    expect(fetchModelAnswers).toHaveBeenCalledTimes(1);
  });

  it("shows an error when 'Show all' fails", async () => {
    fetchModelAnswers.mockRejectedValue(new Error("network"));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Show all model answers" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't prepare the model answer. Please try again.");
    expect(screen.getByRole("button", { name: "Show all model answers" })).toBeEnabled();
  });

  it("uses the interviewId prop when it is given, otherwise the one inside the report", async () => {
    fetchModelAnswers.mockResolvedValue({ 0: "x" });
    const { user, unmount } = setup({ interviewId: "from-prop" });
    await user.click(showButtons()[0]);
    expect(fetchModelAnswers).toHaveBeenCalledWith("from-prop", 0);
    unmount();

    fetchModelAnswers.mockClear();
    const second = setup();
    await second.user.click(showButtons()[0]);
    expect(fetchModelAnswers).toHaveBeenCalledWith("iv1", 0);
  });
});

describe("Step3Report: PDF download", () => {
  it("prepares the missing model answers first, then builds the PDF with them", async () => {
    fetchModelAnswers.mockResolvedValue({ 0: "MA zero", 1: "MA one", 2: "MA two" });
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => expect(generateReportPdf).toHaveBeenCalledTimes(1));
    expect(fetchModelAnswers).toHaveBeenCalledWith("iv1");
    const pdfReport = generateReportPdf.mock.calls[0][0];
    expect(pdfReport.role).toBe("Frontend Developer");
    expect(pdfReport.questionWiseScore.map((q) => q.modelAnswer)).toEqual(["MA zero", "MA one", "MA two"]);
    expect(pdfReport.questionWiseScore[1].isFollowUp).toBe(true);
  });

  it("does not fetch again when every model answer is already there", async () => {
    const { user } = setup({ report: withModelAnswers(makeReport()) });

    await user.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => expect(generateReportPdf).toHaveBeenCalledTimes(1));
    expect(fetchModelAnswers).not.toHaveBeenCalled();
    expect(generateReportPdf.mock.calls[0][0].questionWiseScore[0].modelAnswer).toBe("Stored model answer 0");
  });

  it("shows 'Preparing PDF…' and blocks a second click while it works", async () => {
    let finish;
    fetchModelAnswers.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /download pdf/i }));

    expect(screen.getByRole("button", { name: /preparing pdf/i })).toBeDisabled();

    finish({ 0: "a", 1: "b", 2: "c" });
    await waitFor(() => expect(screen.getByRole("button", { name: /download pdf/i })).toBeEnabled());
    expect(generateReportPdf).toHaveBeenCalledTimes(1);
  });

  it("still builds the PDF, and says answers are missing, when the model answers cannot be prepared", async () => {
    fetchModelAnswers.mockRejectedValue(new Error("network"));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /download pdf/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Some model answers couldn't be prepared, so the PDF is missing them.",
    );
    expect(generateReportPdf).toHaveBeenCalledTimes(1);
    expect(generateReportPdf.mock.calls[0][0].questionWiseScore.map((q) => q.modelAnswer)).toEqual(["", "", ""]);
  });

  it("shows an error and re-enables the button when building the PDF fails", async () => {
    generateReportPdf.mockRejectedValue(new Error("font problem"));
    const { user } = setup({ report: withModelAnswers(makeReport()) });

    await user.click(screen.getByRole("button", { name: /download pdf/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to generate the PDF. Please try again.");
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeEnabled();
  });
});

describe("Step3Report: leaving the report", () => {
  it("calls onRestart from the 'New interview' button when the parent gives one", async () => {
    const onRestart = vi.fn();
    const { user } = setup({ onRestart });

    await user.click(screen.getByRole("button", { name: "New interview" }));

    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("links to /interview when there is no onRestart, and back to the history", () => {
    setup();
    expect(screen.getByRole("link", { name: "New interview" })).toHaveAttribute("href", "/interview");
    expect(screen.getByRole("link", { name: /back to history/i })).toHaveAttribute("href", "/history");
  });
});