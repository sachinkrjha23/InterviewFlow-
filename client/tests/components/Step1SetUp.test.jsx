import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import Step1SetUp from "../../src/components/Step1SetUp.jsx";
import { demoUser, renderWithProviders, signedIn } from "../helpers/renderWithProviders.jsx";

vi.mock("axios", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
// the mic check has its own recorder and is not part of these tests
vi.mock("../../src/components/MicCheck.jsx", () => ({ default: () => null }));

const START_URL = "http://localhost:1000/api/interview/generateQuestions";
const RESUME_URL = "http://localhost:1000/api/interview/resume";

const setup = ({ credits = 150 } = {}) => {
  const onStart = vi.fn();
  const user = userEvent.setup();
  const view = renderWithProviders(<Step1SetUp onStart={onStart} />, {
    userState: signedIn({ ...demoUser, credits }),
  });
  return { user, onStart, ...view };
};

const fillForm = async (user, { role = "Frontend Developer", experience = "1-2 years" } = {}) => {
  await user.type(screen.getByLabelText("Role"), role);
  await user.selectOptions(screen.getByLabelText("Experience"), experience);
};

const startButton = () => screen.getByRole("button", { name: /start interview/i });
const confirmStart = (user) => user.click(screen.getByRole("button", { name: /i understand, start/i }));

const pdfFile = (name = "resume.pdf", sizeBytes = 1024) => {
  const file = new File(["%PDF-1.4"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
};

beforeEach(() => {
  axios.post.mockReset();
});

describe("Step1SetUp: the form", () => {
  it("keeps Start disabled until both a role and an experience are chosen", async () => {
    const { user } = setup();
    expect(startButton()).toBeDisabled();

    await user.type(screen.getByLabelText("Role"), "Frontend Developer");
    expect(startButton()).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Experience"), "1-2 years");
    expect(startButton()).toBeEnabled();
  });

  it("does not count a role made only of spaces", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Role"), "   ");
    await user.selectOptions(screen.getByLabelText("Experience"), "1-2 years");
    expect(startButton()).toBeDisabled();
  });

  it("shows the cost and the user's credits, with no warning when there are enough", () => {
    setup({ credits: 150 });
    expect(screen.getByText("This interview uses 50 credits. You have 150.")).toBeInTheDocument();
    expect(screen.queryByText(/not enough credits/i)).not.toBeInTheDocument();
  });

  it("treats exactly 50 credits as enough (the cost itself is allowed)", async () => {
    const { user } = setup({ credits: 50 });
    await fillForm(user);
    expect(screen.queryByText(/not enough credits/i)).not.toBeInTheDocument();

    await user.click(startButton());
    expect(screen.getByRole("button", { name: /i understand, start/i })).toBeInTheDocument();
  });

  it("warns with a link to Pricing when credits are below the cost", () => {
    setup({ credits: 49 });
    expect(screen.getByText(/not enough credits/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /buy credits/i })).toHaveAttribute("href", "/pricing");
  });
});

describe("Step1SetUp: the confirm box", () => {
  it("opens a confirm box first and sends nothing until the user agrees", async () => {
    const { user } = setup();
    await fillForm(user);

    await user.click(startButton());

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Before you start")).toBeInTheDocument();
    expect(within(dialog).getByText(/credits are not\s+refunded/i)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("closes with Cancel or Escape, still without sending anything", async () => {
    const { user } = setup();
    await fillForm(user);

    await user.click(startButton());
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(startButton());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("offers Buy credits instead of Start when the user cannot afford it", async () => {
    const { user } = setup({ credits: 10 });
    await fillForm(user);

    await user.click(startButton());

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /i understand, start/i })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /buy credits/i })).toHaveAttribute("href", "/pricing");
  });
});

describe("Step1SetUp: starting the interview", () => {
  it("sends the choices, updates the credits in Redux and hands the questions to the parent", async () => {
    const { user, onStart, store } = setup();
    const response = { interviewId: "i1", questions: [{ question: "Q1" }], creditsLeft: 100 };
    axios.post.mockResolvedValue({ data: response });

    await fillForm(user, { role: "Backend Developer", experience: "2-4 years" });
    await user.click(screen.getByRole("radio", { name: /^HR/ }));
    await user.type(screen.getByLabelText(/job description/i), "Node.js and MongoDB");
    await user.click(startButton());
    await confirmStart(user);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      START_URL,
      {
        role: "Backend Developer",
        experience: "2-4 years",
        mode: "HR",
        resumeText: "",
        projects: [],
        skills: [],
        jobDescription: "Node.js and MongoDB",
      },
      { withCredentials: true },
    );
    await waitFor(() => expect(onStart).toHaveBeenCalledWith(response));
    expect(store.getState().user.userData.credits).toBe(100);
  });

  it("defaults to Technical mode", async () => {
    const { user } = setup();
    axios.post.mockResolvedValue({ data: { creditsLeft: 100 } });

    await fillForm(user);
    await user.click(startButton());
    await confirmStart(user);

    expect(axios.post.mock.calls[0][1].mode).toBe("Technical");
  });

  it("locks the whole form and shows progress while the questions are being made", async () => {
    const { user } = setup();
    let finish;
    axios.post.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await fillForm(user);
    await user.click(startButton());
    await confirmStart(user);

    const busyButton = await screen.findByRole("button", { name: /preparing your questions/i });
    expect(busyButton).toBeDisabled();
    expect(screen.getByLabelText("Role")).toBeDisabled();
    expect(screen.getByLabelText("Experience")).toBeDisabled();
    expect(screen.getByLabelText(/job description/i)).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^HR/ })).toBeDisabled();

    finish({ data: { creditsLeft: 100 } });
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  });

  it("shows the server's message, unlocks the form and lets the user try again", async () => {
    const { user, onStart, store } = setup();
    axios.post.mockRejectedValueOnce({ response: { data: { message: "Not enough credits" } } });

    await fillForm(user);
    await user.click(startButton());
    await confirmStart(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Not enough credits");
    expect(onStart).not.toHaveBeenCalled();
    expect(store.getState().user.userData.credits).toBe(150);
    await waitFor(() => expect(startButton()).toBeEnabled());
    expect(screen.getByLabelText("Role")).toBeEnabled();

    axios.post.mockResolvedValueOnce({ data: { creditsLeft: 100 } });
    await user.click(startButton());
    await confirmStart(user);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("uses a general message when the server gives none", async () => {
    const { user } = setup();
    axios.post.mockRejectedValue(new Error("network"));

    await fillForm(user);
    await user.click(startButton());
    await confirmStart(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to start interview");
  });
});

describe("Step1SetUp: resume upload", () => {
  const chooseFile = (user, file) => user.upload(screen.getByLabelText(/choose a pdf/i), file);

  it("accepts a PDF, shows its name and size, and offers to analyze it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Step1SetUp onStart={vi.fn()} />, { userState: signedIn() });

    await chooseFile(user, pdfFile("my-resume.pdf", 2 * 1024 * 1024));

    expect(screen.getByText("my-resume.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze resume/i })).toBeEnabled();
  });

  it("rejects a file that is not a PDF", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<Step1SetUp onStart={vi.fn()} />, { userState: signedIn() });

    await user.upload(
      screen.getByLabelText(/choose a pdf/i),
      new File(["hello"], "notes.txt", { type: "text/plain" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Please choose a PDF file.");
    expect(screen.queryByRole("button", { name: /analyze resume/i })).not.toBeInTheDocument();
  });

  it("rejects a PDF larger than 5 MB", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Step1SetUp onStart={vi.fn()} />, { userState: signedIn() });

    await chooseFile(user, pdfFile("huge.pdf", 5 * 1024 * 1024 + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("larger than 5 MB");
    expect(screen.queryByRole("button", { name: /analyze resume/i })).not.toBeInTheDocument();
  });

  it("fills role, experience and skills from the analysis and sends them when the interview starts", async () => {
    const { user } = setup();
    const skills = Array.from({ length: 14 }, (_, i) => `Skill${i + 1}`);
    axios.post.mockResolvedValueOnce({
      data: {
        role: "Data Analyst",
        experience: "3 years",
        projects: ["Sales dashboard"],
        skills,
        resumeText: "RESUME TEXT",
      },
    });

    await chooseFile(user, pdfFile());
    await user.click(screen.getByRole("button", { name: /analyze resume/i }));

    expect(axios.post.mock.calls[0][0]).toBe(RESUME_URL);
    expect(axios.post.mock.calls[0][1]).toBeInstanceOf(FormData);
    expect(axios.post.mock.calls[0][1].get("resume").name).toBe("resume.pdf");

    expect(await screen.findByText(/resume analyzed/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toHaveValue("Data Analyst");
    expect(screen.getByLabelText("Experience")).toHaveValue("3 years");
    expect(screen.getByRole("option", { name: "3 years (from resume)" })).toBeInTheDocument();
    expect(screen.getByText("Skill12")).toBeInTheDocument();
    expect(screen.queryByText("Skill13")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    expect(screen.getByText("Sales dashboard")).toBeInTheDocument();

    axios.post.mockResolvedValueOnce({ data: { creditsLeft: 100 } });
    await user.click(startButton());
    await confirmStart(user);

    expect(axios.post.mock.calls[1][1]).toMatchObject({
      role: "Data Analyst",
      experience: "3 years",
      resumeText: "RESUME TEXT",
      projects: ["Sales dashboard"],
      skills,
    });
  });

  it("shows an error and keeps the file when the analysis fails", async () => {
    const { user } = setup();
    axios.post.mockRejectedValueOnce({ response: { data: { message: "Couldn't read this PDF." } } });

    await chooseFile(user, pdfFile("broken.pdf"));
    await user.click(screen.getByRole("button", { name: /analyze resume/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read this PDF.");
    expect(screen.getByText("broken.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze resume/i })).toBeEnabled();
  });

  it("Remove resume clears the analysis, so its text is not sent with the interview", async () => {
    const { user } = setup();
    axios.post.mockResolvedValueOnce({
      data: { role: "Data Analyst", experience: "1-2 years", projects: ["P1"], skills: ["SQL"], resumeText: "RESUME TEXT" },
    });

    await chooseFile(user, pdfFile());
    await user.click(screen.getByRole("button", { name: /analyze resume/i }));
    await user.click(await screen.findByRole("button", { name: /remove resume/i }));

    expect(screen.getByText("Choose a PDF")).toBeInTheDocument();
    expect(screen.queryByText("SQL")).not.toBeInTheDocument();

    axios.post.mockResolvedValueOnce({ data: { creditsLeft: 100 } });
    await user.click(startButton());
    await confirmStart(user);

    expect(axios.post.mock.calls[1][1]).toMatchObject({ resumeText: "", projects: [], skills: [] });
  });
});