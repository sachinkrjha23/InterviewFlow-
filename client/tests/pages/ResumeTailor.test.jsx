import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResumeTailor from "../../src/pages/ResumeTailor.jsx";
import { extractResume, tailorResume } from "../../src/utils/resumeApi.js";
import { generateResumePdf } from "../../src/utils/generateResumePdf.js";

vi.mock("../../src/utils/resumeApi.js", () => ({ extractResume: vi.fn(), tailorResume: vi.fn() }));
vi.mock("../../src/utils/generateResumePdf.js", () => ({ generateResumePdf: vi.fn() }));
vi.mock("../../src/components/Navbar.jsx", () => ({ default: () => null }));

const STORAGE_KEY = "interviewflow:resume-tailor";

const JD = "We need a frontend engineer who builds dashboards with React and ships services with Docker. GraphQL is a plus. ";
const RESUME = "Frontend developer. Built dashboards with React for internal teams and deployed them to production every week. ";

// React counts double (must), Docker and GraphQL count once: 4 points in total
const keywords = [
  { term: "React", variants: ["react", "reactjs"], importance: "must" },
  { term: "Docker", variants: ["docker"], importance: "nice" },
  { term: "GraphQL", variants: ["graphql"], importance: "nice" },
];

const serverResult = (over = {}) => ({
  tailoredText: "Built React dashboards for 40 teams.\nDeployed services with Docker.",
  keywords,
  before: { score: 50, matched: ["React"] },
  added: ["Docker"],
  newNumbers: ["40"],
  changes: ["Reworded the first bullet", "Moved Docker up"],
  ...over,
});

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillBoth = () => {
  fill("Job description", JD);
  fill("Your resume", RESUME);
};
const tailorButton = () => screen.getByRole("button", { name: /tailor my resume|tailoring/i });
const editor = () => screen.getByLabelText("Tailored resume, editable");
const fileInput = (container) => container.querySelector('input[type="file"]');
const pdfFile = (name = "resume.pdf", sizeBytes = 1024) => {
  const file = new File(["%PDF-1.4"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
};

const setup = () => {
  const user = userEvent.setup();
  const view = render(<ResumeTailor />);
  return { user, ...view };
};

// fill both boxes and run the tailoring, so the result area is on screen
const tailorNow = async (user, data = serverResult()) => {
  tailorResume.mockResolvedValueOnce(data);
  fillBoth();
  await user.click(tailorButton());
  await screen.findByRole("heading", { name: "Tailored resume" }, { timeout: 4000 });
};

beforeEach(() => {
  sessionStorage.clear();
  extractResume.mockReset();
  tailorResume.mockReset();
  generateResumePdf.mockReset();
  generateResumePdf.mockResolvedValue(undefined);
  Element.prototype.scrollIntoView = vi.fn(); // jsdom cannot scroll
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResumeTailor: input gating", () => {
  it("keeps the button disabled, with a hint, until both boxes have at least 100 characters", () => {
    setup();
    expect(tailorButton()).toBeDisabled();
    expect(screen.getByText("Add at least a few lines to both boxes to continue.")).toBeInTheDocument();

    fill("Job description", "x".repeat(100));
    expect(tailorButton()).toBeDisabled(); // the resume box is still empty

    fill("Your resume", "y".repeat(99));
    expect(tailorButton()).toBeDisabled(); // one character short

    fill("Your resume", "y".repeat(100));
    expect(tailorButton()).toBeEnabled();
    expect(screen.queryByText("Add at least a few lines to both boxes to continue.")).not.toBeInTheDocument();
  });

  it("does not count spaces as text", () => {
    setup();
    fill("Job description", "x".repeat(60) + " ".repeat(80));
    fill("Your resume", "y".repeat(100));
    expect(tailorButton()).toBeDisabled();
  });

  it("shows how many characters are used in each box", () => {
    setup();
    fill("Job description", "hello");
    fill("Your resume", "hello world");
    expect(screen.getByText("5/6000")).toBeInTheDocument();
    expect(screen.getByText("11/12000")).toBeInTheDocument();
  });

  it("says the tool is free", () => {
    setup();
    expect(screen.getByText("Free to use. No credits needed.")).toBeInTheDocument();
  });
});

describe("ResumeTailor: tailoring", () => {
  it("sends both texts and shows the result: scores, keyword groups, changes and the check warning", async () => {
    const { user } = setup();
    await tailorNow(user);

    expect(tailorResume).toHaveBeenCalledWith({ resumeText: RESUME, jobDescription: JD });
    expect(editor()).toHaveValue("Built React dashboards for 40 teams.\nDeployed services with Docker.");

    expect(screen.getByText("50%")).toBeInTheDocument(); // the original
    expect(screen.getByText("75%")).toBeInTheDocument(); // this version: React (2) + Docker (1) of 4
    expect(screen.getByText("Already in your resume (1)")).toBeInTheDocument();
    expect(screen.getByText("Added in this version (1)")).toBeInTheDocument();
    expect(screen.getByText("Still missing (1)")).toBeInTheDocument();
    expect(screen.queryByText(/Removed by your edits/)).not.toBeInTheDocument();
    expect(screen.getByText("must")).toBeInTheDocument(); // only React is a must-have

    expect(screen.getByText("Reworded the first bullet")).toBeInTheDocument();
    expect(screen.getByText("Moved Docker up")).toBeInTheDocument();

    expect(screen.getByText("Check these before you use the resume")).toBeInTheDocument();
    expect(screen.getByText(/mentions 1 keyword your original didn't: Docker\./)).toBeInTheDocument();
    expect(screen.getByText(/New numbers appeared that weren't in your original: 40\./)).toBeInTheDocument();
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });

  it("uses the plural when more than one keyword was added", async () => {
    const { user } = setup();
    await tailorNow(user, serverResult({ added: ["Docker", "GraphQL"], newNumbers: [] }));

    expect(screen.getByText(/mentions 2 keywords your original didn't: Docker, GraphQL\./)).toBeInTheDocument();
    expect(screen.queryByText(/New numbers appeared/)).not.toBeInTheDocument();
  });

  it("shows no warning when nothing was added and no new numbers appeared", async () => {
    const { user } = setup();
    await tailorNow(user, serverResult({ added: [], newNumbers: [] }));

    expect(screen.queryByText("Check these before you use the resume")).not.toBeInTheDocument();
  });

  it("locks the boxes and the upload while the AI works, and shows progress", async () => {
    const { user } = setup();
    let finish;
    tailorResume.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    fillBoth();

    await user.click(tailorButton());

    expect(screen.getByRole("button", { name: "Tailoring… this can take a minute" })).toBeDisabled();
    expect(screen.getByLabelText("Job description")).toBeDisabled();
    expect(screen.getByLabelText("Your resume")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload PDF" })).toBeDisabled();
    expect(tailorResume).toHaveBeenCalledTimes(1);

    finish(serverResult());
    expect(await screen.findByRole("heading", { name: "Tailored resume" })).toBeInTheDocument();
    expect(tailorResume).toHaveBeenCalledTimes(1);
  });

  it("shows the server's message when tailoring fails, and lets the person try again", async () => {
    const { user } = setup();
    tailorResume.mockRejectedValueOnce({ response: { data: { message: "The AI is busy right now" } } });
    fillBoth();

    await user.click(tailorButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("The AI is busy right now");
    expect(screen.queryByRole("heading", { name: "Tailored resume" })).not.toBeInTheDocument();
    expect(tailorButton()).toBeEnabled();
  });

  it("uses a general message when the server gives none", async () => {
    const { user } = setup();
    tailorResume.mockRejectedValueOnce(new Error("network"));
    fillBoth();

    await user.click(tailorButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't tailor your resume. Please try again.");
  });
});

describe("ResumeTailor: editing the result", () => {
  it("updates the score and the keyword groups live as the text is edited", async () => {
    const { user } = setup();
    await tailorNow(user);

    fireEvent.change(editor(), { target: { value: "Deployed services with Docker." } }); // React was removed
    expect(screen.getByText("25%")).toBeInTheDocument(); // Docker (1) of 4
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
    expect(screen.getByText("Removed by your edits (1)")).toBeInTheDocument();
    expect(screen.queryByText(/Already in your resume/)).not.toBeInTheDocument();

    fireEvent.change(editor(), { target: { value: "React, Docker and GraphQL." } });
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.queryByText(/Still missing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Removed by your edits/)).not.toBeInTheDocument();
  });

  it("'Reset to AI version' is off until the text is changed, then restores the AI text and score", async () => {
    const { user } = setup();
    await tailorNow(user);
    const reset = screen.getByRole("button", { name: /reset to ai version/i });
    expect(reset).toBeDisabled();

    fireEvent.change(editor(), { target: { value: "Something else entirely" } });
    expect(reset).toBeEnabled();
    expect(screen.getByText("0%")).toBeInTheDocument();

    await user.click(reset);

    expect(editor()).toHaveValue("Built React dashboards for 40 teams.\nDeployed services with Docker.");
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(reset).toBeDisabled();
  });

  it("'Show changes' swaps the editor for a comparison and back, keeping the edits", async () => {
    const { user } = setup();
    await tailorNow(user);
    fireEvent.change(editor(), { target: { value: "My own edited resume text" } });

    const toggle = screen.getByRole("button", { name: "Show changes" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(screen.queryByLabelText("Tailored resume, editable")).not.toBeInTheDocument();
    const comparison = screen.getByLabelText("Changes compared with your original resume");
    expect(comparison).toHaveTextContent("My own edited resume text"); // what was added
    expect(comparison).toHaveTextContent("internal teams"); // a word from the original resume, shown as removed
    expect(screen.getByText("Green was added, red was removed, compared with your original.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to editing" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Back to editing" }));

    expect(editor()).toHaveValue("My own edited resume text");
    expect(screen.queryByText(/Green was added/)).not.toBeInTheDocument();
  });
});

describe("ResumeTailor: copy, download and start over", () => {
  it("copies the edited text and shows 'Copied'", async () => {
    const { user } = setup();
    await tailorNow(user);
    fireEvent.change(editor(), { target: { value: "Text to copy" } });

    await user.click(screen.getByRole("button", { name: "Copy text" }));

    expect(await navigator.clipboard.readText()).toBe("Text to copy");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("shows a message when copying is not allowed", async () => {
    const { user } = setup();
    await tailorNow(user);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));

    await user.click(screen.getByRole("button", { name: "Copy text" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't copy. Select the text and copy it manually.");
  });

  it("builds the PDF from the edited text, and shows progress while it works", async () => {
    const { user } = setup();
    await tailorNow(user);
    fireEvent.change(editor(), { target: { value: "Final edited resume" } });
    let finish;
    generateResumePdf.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(generateResumePdf).toHaveBeenCalledWith("Final edited resume");
    expect(screen.getByRole("button", { name: "Preparing…" })).toBeDisabled();

    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled());
    expect(generateResumePdf).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the PDF cannot be created", async () => {
    const { user } = setup();
    await tailorNow(user);
    generateResumePdf.mockRejectedValue(new Error("font"));

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to create the PDF. Please try again.");
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });

  it("'Start over' asks first, and changes nothing if the person says no", async () => {
    const { user } = setup();
    await tailorNow(user);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(confirm).toHaveBeenCalledWith("Start over? Your tailored resume and edits will be cleared.");
    expect(screen.getByRole("heading", { name: "Tailored resume" })).toBeInTheDocument();
  });

  it("'Start over' clears the result but keeps the two input texts", async () => {
    const { user } = setup();
    await tailorNow(user);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.queryByRole("heading", { name: "Tailored resume" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Job description")).toHaveValue(JD);
    expect(screen.getByLabelText("Your resume")).toHaveValue(RESUME);
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)).result).toBeNull());
  });
});

describe("ResumeTailor: uploading a PDF", () => {
  it("reads the PDF and puts its text in the resume box", async () => {
    const { user, container } = setup();
    extractResume.mockResolvedValue("Text read from the PDF");
    const file = pdfFile("cv.pdf");

    await user.upload(fileInput(container), file);

    expect(extractResume).toHaveBeenCalledWith(file);
    expect(await screen.findByDisplayValue("Text read from the PDF")).toBe(screen.getByLabelText("Your resume"));
  });

  it("shows 'Reading…' and locks the upload button while the PDF is read", async () => {
    const { user, container } = setup();
    let finish;
    extractResume.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await user.upload(fileInput(container), pdfFile());

    expect(screen.getByRole("button", { name: "Reading…" })).toBeDisabled();

    finish("done");
    expect(await screen.findByRole("button", { name: "Upload PDF" })).toBeEnabled();
  });

  it("rejects a file that is not a PDF without calling the server", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<ResumeTailor />);

    await user.upload(fileInput(container), new File(["hello"], "notes.txt", { type: "text/plain" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please choose a PDF file.");
    expect(extractResume).not.toHaveBeenCalled();
  });

  it("rejects a PDF larger than 5 MB without calling the server", async () => {
    const { user, container } = setup();

    await user.upload(fileInput(container), pdfFile("huge.pdf", 5 * 1024 * 1024 + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("PDF must be under 5 MB.");
    expect(extractResume).not.toHaveBeenCalled();
  });

  it("shows the server's message, or a general one, when the PDF cannot be read", async () => {
    const { user, container } = setup();
    extractResume.mockRejectedValueOnce({ response: { data: { message: "This PDF has no text" } } });

    await user.upload(fileInput(container), pdfFile());
    expect(await screen.findByRole("alert")).toHaveTextContent("This PDF has no text");

    extractResume.mockRejectedValueOnce(new Error("boom"));
    await user.upload(fileInput(container), pdfFile());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read that PDF."));
  });
});

describe("ResumeTailor: keeping the work after a refresh", () => {
  it("brings back the texts and the result that were saved in the browser", () => {
    const result = { ...serverResult(), original: RESUME };
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ jobDescription: JD, resumeText: RESUME, result, edited: "My saved edit with React" }),
    );

    setup();

    expect(screen.getByLabelText("Job description")).toHaveValue(JD);
    expect(screen.getByLabelText("Your resume")).toHaveValue(RESUME);
    expect(screen.getByRole("heading", { name: "Tailored resume" })).toBeInTheDocument();
    expect(editor()).toHaveValue("My saved edit with React");
    expect(screen.getAllByText("50%")).toHaveLength(2); // the original, and the live score: React (2) of 4
  });

  it("saves what is typed in the browser", async () => {
    setup();

    fill("Job description", JD);

    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)).jobDescription).toBe(JD), {
      timeout: 2000,
    });
  });

  it("starts empty, without crashing, when the saved data is damaged", () => {
    sessionStorage.setItem(STORAGE_KEY, "{not valid json");

    setup();

    expect(screen.getByLabelText("Job description")).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "Tailored resume" })).not.toBeInTheDocument();
  });
});