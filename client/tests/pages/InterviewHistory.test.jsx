import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import InterviewHistory from "../../src/pages/InterviewHistory.jsx";
import { renderWithProviders } from "../helpers/renderWithProviders.jsx";

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("../../src/components/Navbar.jsx", () => ({ default: () => null }));

const HISTORY_URL = "http://localhost:1000/api/interview/history";

const interview = (over = {}) => ({
  _id: "i1",
  role: "Frontend Developer",
  experience: "1-2 years",
  mode: "Technical",
  status: "Completed",
  createdAt: "2026-03-05T12:00:00Z",
  finalScore: 7.5,
  answeredCount: 6,
  totalQuestions: 6,
  ...over,
});

// a full first page (the page size is 20), so the app offers "Load more"
const fullPage = (prefix = "a") =>
  Array.from({ length: 20 }, (_, i) => interview({ _id: `${prefix}${i}`, role: `${prefix.toUpperCase()}-Role ${i}` }));

const setup = async (rows, { wait = true } = {}) => {
  axios.get.mockResolvedValueOnce({ data: rows });
  const user = userEvent.setup();
  const view = renderWithProviders(<InterviewHistory />);
  if (wait) await waitFor(() => expect(screen.queryByRole("status", { name: "Loading interviews" })).not.toBeInTheDocument());
  return { user, ...view };
};

const group = (name) => screen.getByRole("group", { name });
const filterButton = (groupName, label) => within(group(groupName)).getByRole("button", { name: label });
const search = () => screen.getByRole("searchbox", { name: "Search by role or experience" });
const rowTitles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  axios.get.mockReset();
});

describe("InterviewHistory: loading", () => {
  it("shows a loading placeholder first and asks the server for page 1", async () => {
    let finish;
    axios.get.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderWithProviders(<InterviewHistory />);

    expect(screen.getByRole("status", { name: "Loading interviews" })).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(HISTORY_URL, { params: { page: 1, limit: 20 }, withCredentials: true });

    finish({ data: [interview()] });
    expect(await screen.findByText("Frontend Developer")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading interviews" })).not.toBeInTheDocument();
  });

  it("shows an invitation to start when there are no interviews yet", async () => {
    await setup([]);

    expect(screen.getByText("No interviews yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start your first interview" })).toHaveAttribute("href", "/interview");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("treats an unexpected response as an empty list", async () => {
    await setup({ message: "not a list" });
    expect(screen.getByText("No interviews yet.")).toBeInTheDocument();
  });

  it("shows the server's message when loading fails, and Try again loads the list", async () => {
    axios.get.mockRejectedValueOnce({ response: { data: { message: "Server is down" } } });
    const user = userEvent.setup();
    renderWithProviders(<InterviewHistory />);

    expect(await screen.findByText("Server is down")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    axios.get.mockResolvedValueOnce({ data: [interview()] });
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Frontend Developer")).toBeInTheDocument();
    expect(screen.queryByText("Server is down")).not.toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenLastCalledWith(HISTORY_URL, { params: { page: 1, limit: 20 }, withCredentials: true });
  });

  it("uses a general message when the server gives none", async () => {
    axios.get.mockRejectedValueOnce(new Error("network"));
    renderWithProviders(<InterviewHistory />);

    expect(await screen.findByText("Failed to load interviews.")).toBeInTheDocument();
  });
});

describe("InterviewHistory: the list", () => {
  it("shows role, mode, experience, date, score and a link to the report", async () => {
    await setup([interview({ _id: "abc123", finalScore: 7.46 })]);

    const link = screen.getByRole("link", { name: /frontend developer/i });
    expect(link).toHaveAttribute("href", "/report/abc123");
    expect(within(link).getByText("Technical")).toBeInTheDocument();
    expect(within(link).getByText(/1-2 years/)).toBeInTheDocument();
    expect(within(link).getByText(/5 Mar 2026/)).toBeInTheDocument();
    expect(within(link).getByText("7.5")).toBeInTheDocument(); // one decimal
    expect(within(link).getByText("Completed")).toBeInTheDocument();
  });

  it("shows a dash and the progress for an interview that was not finished", async () => {
    await setup([
      interview({ _id: "u1", role: "Unfinished A", status: "Incomplete", finalScore: 9, answeredCount: 2, totalQuestions: 5 }),
      interview({ _id: "u2", role: "Unfinished B", status: "Incomplete", answeredCount: undefined, totalQuestions: undefined }),
    ]);

    const first = screen.getByRole("link", { name: /unfinished a/i });
    expect(within(first).getByText("—")).toBeInTheDocument(); // no score, even though one was stored
    expect(within(first).getByText("Incomplete · 2/5")).toBeInTheDocument();
    expect(within(first).queryByText("9.0")).not.toBeInTheDocument();

    const second = screen.getByRole("link", { name: /unfinished b/i });
    expect(within(second).getByText("Incomplete · 0/6")).toBeInTheDocument(); // the defaults
  });
});

describe("InterviewHistory: search and filters", () => {
  const rows = () => [
    interview({ _id: "1", role: "Frontend Developer", experience: "1-2 years", mode: "Technical", status: "Completed" }),
    interview({ _id: "2", role: "Product Analyst", experience: "Fresher", mode: "HR", status: "Completed" }),
    interview({ _id: "3", role: "Backend Developer", experience: "2-4 years", mode: "Technical", status: "Incomplete" }),
    interview({ _id: "4", role: "Support Lead", experience: "4+ years", mode: "HR", status: "Incomplete" }),
  ];

  it("starts with every filter on 'All' and every interview shown", async () => {
    await setup(rows());

    expect(filterButton("Status", "All")).toHaveAttribute("aria-pressed", "true");
    expect(filterButton("Mode", "All")).toHaveAttribute("aria-pressed", "true");
    expect(rowTitles()).toEqual(["Frontend Developer", "Product Analyst", "Backend Developer", "Support Lead"]);
  });

  it("searches the role and the experience, ignoring case and extra spaces", async () => {
    const { user } = await setup(rows());

    await user.type(search(), "  DEVELOPER ");
    expect(rowTitles()).toEqual(["Frontend Developer", "Backend Developer"]);

    await user.clear(search());
    await user.type(search(), "fresher");
    expect(rowTitles()).toEqual(["Product Analyst"]); // matched on experience
  });

  it("filters by status and marks the chosen button", async () => {
    const { user } = await setup(rows());

    await user.click(filterButton("Status", "Incomplete"));

    expect(rowTitles()).toEqual(["Backend Developer", "Support Lead"]);
    expect(filterButton("Status", "Incomplete")).toHaveAttribute("aria-pressed", "true");
    expect(filterButton("Status", "All")).toHaveAttribute("aria-pressed", "false");

    await user.click(filterButton("Status", "Completed"));
    expect(rowTitles()).toEqual(["Frontend Developer", "Product Analyst"]);
  });

  it("filters by mode", async () => {
    const { user } = await setup(rows());

    await user.click(filterButton("Mode", "HR"));

    expect(rowTitles()).toEqual(["Product Analyst", "Support Lead"]);
  });

  it("combines search, status and mode", async () => {
    const { user } = await setup(rows());

    await user.click(filterButton("Status", "Incomplete"));
    await user.click(filterButton("Mode", "Technical"));
    expect(rowTitles()).toEqual(["Backend Developer"]);

    await user.type(search(), "support");
    expect(screen.getByText("No interviews match your filters.")).toBeInTheDocument();
  });

  it("explains when nothing matches, and 'Clear filters' brings everything back", async () => {
    const { user } = await setup(rows());
    await user.type(search(), "zzz");
    await user.click(filterButton("Mode", "HR"));

    expect(screen.getByText("No interviews match your filters.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(search()).toHaveValue("");
    expect(filterButton("Mode", "All")).toHaveAttribute("aria-pressed", "true");
    expect(rowTitles()).toHaveLength(4);
  });
});

describe("InterviewHistory: Load more", () => {
  it("offers Load more only when the first page was full", async () => {
    await setup([interview(), interview({ _id: "i2", role: "Second" })]);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("loads the next page, adds the rows after the first ones, and shows 'Loading...' meanwhile", async () => {
    const { user } = await setup(fullPage("a"));
    expect(rowTitles()).toHaveLength(20);
    let finish;
    axios.get.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(axios.get).toHaveBeenLastCalledWith(HISTORY_URL, { params: { page: 2, limit: 20 }, withCredentials: true });
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();

    finish({ data: [interview({ _id: "b0", role: "B-Role 0" }), interview({ _id: "b1", role: "B-Role 1" })] });
    await waitFor(() => expect(rowTitles()).toHaveLength(22));
    expect(rowTitles().slice(-2)).toEqual(["B-Role 0", "B-Role 1"]);
    expect(rowTitles()[0]).toBe("A-Role 0");
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument(); // the second page was short
  });

  it("never shows the same interview twice when pages overlap", async () => {
    const { user } = await setup(fullPage("a"));
    axios.get.mockResolvedValueOnce({
      data: [interview({ _id: "a19", role: "A-Role 19" }), interview({ _id: "new1", role: "Brand new" })],
    });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(rowTitles()).toHaveLength(21));
    expect(rowTitles().filter((title) => title === "A-Role 19")).toHaveLength(1);
    expect(rowTitles()).toContain("Brand new");
  });

  it("keeps offering Load more while pages stay full, and asks for the next page each time", async () => {
    const { user } = await setup(fullPage("a"));
    axios.get.mockResolvedValueOnce({ data: fullPage("b") });

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rowTitles()).toHaveLength(40));

    axios.get.mockResolvedValueOnce({ data: [] });
    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(HISTORY_URL, { params: { page: 3, limit: 20 }, withCredentials: true }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument());
    expect(rowTitles()).toHaveLength(40);
  });

  it("shows a message, keeps the rows and keeps the button when loading more fails", async () => {
    const { user } = await setup(fullPage("a"));
    axios.get.mockRejectedValueOnce({ response: { data: { message: "Too many requests" } } });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
    expect(rowTitles()).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();

    axios.get.mockRejectedValueOnce(new Error("network"));
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Couldn't load more. Please try again.")).toBeInTheDocument();
  });

  it("applies the current filters to the rows that were loaded afterwards", async () => {
    const { user } = await setup(fullPage("a"));
    await user.type(search(), "b-role");
    expect(screen.getByText("No interviews match your filters.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeInTheDocument(); // more pages may still hold matches

    axios.get.mockResolvedValueOnce({ data: [interview({ _id: "b0", role: "B-Role 0" })] });
    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(rowTitles()).toEqual(["B-Role 0"]));
  });
});