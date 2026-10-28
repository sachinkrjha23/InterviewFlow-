import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import axios from "axios";
import { signInWithPopup, signOut } from "firebase/auth";
import Profile from "../../src/pages/Profile.jsx";
import { renderWithProviders, signedIn } from "../helpers/renderWithProviders.jsx";

const google = vi.hoisted(() => ({ providerParams: [] }));

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("firebase/auth", () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: class {
    setCustomParameters(params) {
      google.providerParams.push(params);
    }
  },
}));
vi.mock("../../src/utils/firebase.js", () => ({ auth: { name: "fake-auth" } }));
vi.mock("../../src/components/Navbar.jsx", () => ({ default: () => null }));

const BASE = "http://localhost:1000";
const DEMO_EMAIL = "demo@interviewflow.demo";

const me = { _id: "u1", name: "Asha Verma", email: "asha@example.com", credits: 150 };

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

const payment = (over = {}) => ({
  _id: "p1",
  packName: "Starter",
  credits: 100,
  amount: 9900,
  paidAt: "2026-02-01T12:00:00Z",
  paymentId: "pay_ABC123",
  ...over,
});

const stats = (over = {}) => ({
  completed: 3,
  avgScore: 7.43,
  bestScore: 9,
  recentScores: [
    { finalScore: 9, createdAt: "2026-03-05T12:00:00Z" },
    { finalScore: 6.5, createdAt: "2026-03-01T12:00:00Z" },
    { finalScore: 7, createdAt: "2026-02-20T12:00:00Z" },
  ],
  ...over,
});

// what the three pages of data the Profile loads will answer; a value of "fail" makes that request fail
const mockLoad = ({ history = [], payments = [], stats: statsData = stats() } = {}) => {
  axios.get.mockImplementation((url) => {
    const answer = url.endsWith("/api/interview/history") ? history : url.endsWith("/api/payment/history") ? payments : statsData;
    return answer === "fail" ? Promise.reject(new Error("failed")) : Promise.resolve({ data: answer });
  });
};

const setup = async (user = me, loadOptions = {}) => {
  mockLoad(loadOptions);
  const actor = userEvent.setup();
  const view = renderWithProviders(
    <Routes>
      <Route path="/profile" element={<Profile />} />
      <Route path="/" element={<p>Home page</p>} />
      <Route path="/pricing" element={<p>Pricing page</p>} />
      <Route path="/interview" element={<p>Interview page</p>} />
      <Route path="/history" element={<p>History page</p>} />
      <Route path="/report/:id" element={<p>Report page</p>} />
    </Routes>,
    { route: "/profile", userState: signedIn(user) },
  );
  await waitFor(() => expect(screen.queryByText("Loading interviews...")).not.toBeInTheDocument());
  return { user: actor, ...view };
};

const fileInput = (container) => container.querySelector('input[type="file"]');
const nameInput = () => screen.getByLabelText("Display name");
const statValue = (label) => screen.getByText(label).previousElementSibling;
const imageFile = (name = "me.png", size = 2048, type = "image/png") => {
  const file = new File(["img"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

// the browser features the photo resizing needs, as quiet stand-ins
let imageFails = false;
beforeEach(() => {
  axios.get.mockReset();
  axios.post.mockReset();
  axios.patch.mockReset();
  axios.delete.mockReset();
  signInWithPopup.mockReset();
  signOut.mockReset();
  google.providerParams.length = 0;
  imageFails = false;

  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        this.width = 1600;
        this.height = 800;
      }
      set src(_value) {
        queueMicrotask(() => (imageFails ? this.onerror?.() : this.onload?.()));
      }
    },
  );
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
  HTMLCanvasElement.prototype.toBlob = function (callback) {
    callback(new Blob(["jpeg"], { type: "image/jpeg" }));
  };
});

describe("Profile: loading the page", () => {
  it("asks the server for the last 5 interviews, the payments and the stats", async () => {
    await setup();

    expect(axios.get).toHaveBeenCalledWith(`${BASE}/api/interview/history`, { params: { limit: 5 }, withCredentials: true });
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/api/payment/history`, { withCredentials: true });
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/api/interview/stats`, { withCredentials: true });
  });

  it("shows the person's name, email and credits", async () => {
    await setup();

    expect(screen.getByText("Asha Verma", { selector: "p" })).toBeInTheDocument();
    expect(screen.getAllByText("asha@example.com").length).toBeGreaterThan(0);
    expect(statValue("Credits")).toHaveTextContent("150");
    expect(screen.getByText("150 credits available")).toBeInTheDocument();
  });

  it("shows loading text until the data arrives", async () => {
    let finish;
    axios.get.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderWithProviders(<Profile />, { userState: signedIn() });

    expect(screen.getByText("Loading payments...")).toBeInTheDocument();
    expect(screen.getByText("Loading interviews...")).toBeInTheDocument();
    expect(statValue("Completed")).toHaveTextContent("—");

    finish({ data: [] });
    expect(await screen.findByText("No payments yet.")).toBeInTheDocument();
  });

  it("shows the stats, and a bar for each recent score", async () => {
    await setup(me, { stats: stats() });

    expect(statValue("Completed")).toHaveTextContent("3");
    expect(statValue("Avg score")).toHaveTextContent("7.4");
    expect(statValue("Best score")).toHaveTextContent("9.0");
    expect(screen.getByText("Last 3 scores")).toBeInTheDocument();
    expect(screen.getByTitle("9.0 · 5 Mar 2026")).toBeInTheDocument();
    expect(screen.getByTitle("6.5 · 1 Mar 2026")).toBeInTheDocument();
  });

  it("shows dashes for the scores, and no chart, before any interview is completed", async () => {
    await setup(me, { stats: stats({ completed: 0, avgScore: 0, bestScore: 0, recentScores: [] }) });

    expect(statValue("Completed")).toHaveTextContent("0");
    expect(statValue("Avg score")).toHaveTextContent("—");
    expect(statValue("Best score")).toHaveTextContent("—");
    expect(screen.queryByText(/^Last \d+ scores$/)).not.toBeInTheDocument();
  });

  it("shows no chart for a single score", async () => {
    await setup(me, { stats: stats({ recentScores: [{ finalScore: 8, createdAt: "2026-03-05T12:00:00Z" }] }) });
    expect(screen.queryByText(/^Last \d+ scores$/)).not.toBeInTheDocument();
  });

  it("lists the payments with pack, credits, date, payment ID and the amount in rupees", async () => {
    await setup(me, { payments: [payment(), payment({ _id: "p2", packName: "Pro", credits: 300, amount: 249900, paymentId: undefined })] });

    expect(screen.getByText("Starter pack · +100 credits")).toBeInTheDocument();
    expect(screen.getByText("1 Feb 2026 · pay_ABC123")).toBeInTheDocument();
    expect(screen.getByText("₹99")).toBeInTheDocument();
    expect(screen.getByText("Pro pack · +300 credits")).toBeInTheDocument();
    expect(screen.getByText("₹2,499")).toBeInTheDocument();
  });

  it("says so when there are no payments or no interviews", async () => {
    await setup(me, { payments: [], history: [] });

    expect(screen.getByText("No payments yet.")).toBeInTheDocument();
    expect(screen.getByText("No interviews yet. Start your first one!")).toBeInTheDocument();
  });

  it("shows the recent interviews, finished ones with a score and unfinished ones with their progress", async () => {
    await setup(me, {
      history: [
        interview({ _id: "i1", role: "Frontend Developer" }),
        interview({ _id: "i2", role: "Unfinished Role", mode: "HR", experience: "Fresher", status: "Incomplete", answeredCount: 2, totalQuestions: 5 }),
        interview({ _id: "i3", role: "No Counts", mode: "HR", experience: "4+ years", status: "Incomplete", answeredCount: undefined, totalQuestions: undefined }),
      ],
    });

    expect(screen.getByText("Technical · 1-2 years · 5 Mar 2026")).toBeInTheDocument();
    expect(screen.getByText("7.5")).toBeInTheDocument();
    expect(screen.getByText("Incomplete · 2/5")).toBeInTheDocument();
    expect(screen.getByText("Incomplete · 0/6")).toBeInTheDocument();
  });

  it("shows at most 5 interviews", async () => {
    const history = Array.from({ length: 7 }, (_, i) => interview({ _id: `h${i}`, role: `Role ${i}` }));
    await setup(me, { history });

    expect(screen.getByText("Role 4")).toBeInTheDocument();
    expect(screen.queryByText("Role 5")).not.toBeInTheDocument();
  });

  it("still shows what loaded, and a notice, when one request fails", async () => {
    await setup(me, { payments: "fail", history: [interview({ role: "Still Visible" })] });

    expect(screen.getByText("Still Visible")).toBeInTheDocument();
    expect(screen.getByText("No payments yet.")).toBeInTheDocument();
    expect(screen.getByText("Some activity couldn't be loaded. Refresh to try again.")).toBeInTheDocument();
  });

  it("shows no notice when everything loads", async () => {
    await setup();
    expect(screen.queryByText(/couldn't be loaded/)).not.toBeInTheDocument();
  });
});

describe("Profile: moving around", () => {
  it("opens a report from the recent interviews", async () => {
    const { user } = await setup(me, { history: [interview({ _id: "abc", role: "Open Me" })] });

    await user.click(screen.getByRole("button", { name: /open me/i }));

    expect(screen.getByText("Report page")).toBeInTheDocument();
  });

  it.each([
    ["Buy credits", "Pricing page"],
    ["New", "Interview page"],
    ["View all", "History page"],
  ])("'%s' goes to the right page", async (label, page) => {
    const { user } = await setup();

    await user.click(screen.getByRole("button", { name: new RegExp(label, "i") }));

    expect(screen.getByText(page)).toBeInTheDocument();
  });
});

describe("Profile: changing the display name", () => {
  it("keeps Save off until the name is changed", async () => {
    const { user } = await setup();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await user.type(nameInput(), "a");
    expect(save).toBeEnabled();

    await user.clear(nameInput());
    await user.type(nameInput(), "Asha Verma");
    expect(save).toBeDisabled();
  });

  it.each([
    ["A", "one letter"],
    ["x".repeat(61), "61 letters"],
  ])("rejects a name with %#: %s without calling the server", async (value) => {
    await setup();

    fireEvent.change(nameInput(), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Name must be 2-60 characters.");
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it("saves the trimmed name, updates the app's user and confirms", async () => {
    const { user, store } = await setup();
    axios.patch.mockResolvedValueOnce({ data: { ...me, name: "Asha V" } });

    await user.clear(nameInput());
    await user.type(nameInput(), "  Asha V  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(axios.patch).toHaveBeenCalledWith(`${BASE}/api/user/profile`, { name: "Asha V" }, { withCredentials: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Name updated.");
    expect(store.getState().user.userData.name).toBe("Asha V");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows 'Saving...' and blocks a second click while it saves", async () => {
    const { user } = await setup();
    let finish;
    axios.patch.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));

    await user.type(nameInput(), "z");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(axios.patch).toHaveBeenCalledTimes(1);

    finish({ data: { ...me, name: "Asha Vermaz" } });
    expect(await screen.findByText("Name updated.")).toBeInTheDocument();
  });

  it("shows the server's message, or a general one, when saving fails", async () => {
    const { user, store } = await setup();
    axios.patch.mockRejectedValueOnce({ response: { data: { message: "That name is not allowed" } } });

    await user.type(nameInput(), "z");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That name is not allowed");
    expect(store.getState().user.userData.name).toBe("Asha Verma");

    axios.patch.mockRejectedValueOnce(new Error("network"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Failed to update name."));
  });
});

describe("Profile: changing the sign-in email", () => {
  const openConfirm = async (user) => user.click(screen.getByRole("button", { name: "Change" }));

  it("explains what will happen first, and Cancel closes it", async () => {
    const { user } = await setup();

    await openConfirm(user);

    expect(screen.getByText("Switch to a different Google account")).toBeInTheDocument();
    expect(screen.getByText(/Your credits, interviews and payments stay with this profile\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Switch to a different Google account")).not.toBeInTheDocument();
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it("signs in with Google, sends the token, updates the user and confirms", async () => {
    const { user, store } = await setup();
    signInWithPopup.mockResolvedValueOnce({ user: { getIdToken: vi.fn().mockResolvedValue("token-1") } });
    axios.post.mockResolvedValueOnce({ data: { ...me, email: "new@example.com" } });

    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(google.providerParams).toEqual([{ prompt: "select_account" }]);
    expect(signInWithPopup).toHaveBeenCalledWith({ name: "fake-auth" }, expect.anything());
    expect(axios.post).toHaveBeenCalledWith(`${BASE}/api/user/email/change`, { idToken: "token-1" }, { withCredentials: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Sign-in email changed to new@example.com.");
    expect(store.getState().user.userData.email).toBe("new@example.com");
    expect(screen.queryByText("Switch to a different Google account")).not.toBeInTheDocument();
  });

  it("shows 'Waiting for Google...' and locks both buttons while the Google window is open", async () => {
    const { user } = await setup();
    let finish;
    signInWithPopup.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));

    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(screen.getByRole("button", { name: /waiting for google/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    finish({ user: { getIdToken: vi.fn().mockResolvedValue("t") } });
    axios.post.mockResolvedValueOnce({ data: { ...me, email: "n@example.com" } });
    await screen.findByText("Sign-in email changed to n@example.com.");
  });

  it.each(["auth/popup-closed-by-user", "auth/cancelled-popup-request"])(
    "says the email was not changed when the Google window is closed (%s)",
    async (code) => {
      const { user } = await setup();
      signInWithPopup.mockRejectedValueOnce({ code });

      await openConfirm(user);
      await user.click(screen.getByRole("button", { name: /continue with google/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in was closed. Your email wasn't changed.");
      expect(axios.post).not.toHaveBeenCalled();
    },
  );

  it("shows the server's message, or a general one, for any other failure", async () => {
    const { user, store } = await setup();
    signInWithPopup.mockResolvedValue({ user: { getIdToken: vi.fn().mockResolvedValue("t") } });
    axios.post.mockRejectedValueOnce({ response: { data: { message: "That Google account is already in use" } } });

    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That Google account is already in use");
    expect(store.getState().user.userData.email).toBe("asha@example.com");

    axios.post.mockRejectedValueOnce(new Error("network"));
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't change your email. Please try again."));
  });
});

describe("Profile: profile photo", () => {
  it("rejects a file that is not an image, without calling the server", async () => {
    const actor = userEvent.setup({ applyAccept: false });
    const { container } = await setup();

    await actor.upload(fileInput(container), new File(["x"], "notes.txt", { type: "text/plain" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please choose an image file.");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("rejects an image larger than 15 MB", async () => {
    const { user, container } = await setup();

    await user.upload(fileInput(container), imageFile("big.png", 15 * 1024 * 1024 + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("Image must be under 15MB.");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("shrinks the image to a JPEG, uploads it, updates the user and confirms", async () => {
    const { user, container, store } = await setup();
    axios.post.mockResolvedValueOnce({ data: { ...me, avatar: "https://img.example.com/a.jpg" } });

    await user.upload(fileInput(container), imageFile());

    expect(await screen.findByRole("status")).toHaveTextContent("Profile photo updated.");
    const [url, form, options] = axios.post.mock.calls[0];
    expect(url).toBe(`${BASE}/api/user/avatar`);
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("avatar").name).toBe("avatar.jpg");
    expect(form.get("avatar").type).toBe("image/jpeg");
    expect(options.withCredentials).toBe(true);
    expect(store.getState().user.userData.avatar).toBe("https://img.example.com/a.jpg");
  });

  it("locks the photo buttons while uploading", async () => {
    const { user, container } = await setup({ ...me, avatar: "https://img.example.com/a.jpg" });
    let finish;
    axios.post.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));

    await user.upload(fileInput(container), imageFile());

    await waitFor(() => expect(screen.getByRole("button", { name: /change photo/i })).toBeDisabled());
    expect(screen.getByRole("button", { name: /remove/i })).toBeDisabled();

    finish({ data: { ...me, avatar: "https://img.example.com/b.jpg" } });
    await screen.findByText("Profile photo updated.");
  });

  it("shows the server's message when the upload fails, and a message when the image cannot be read", async () => {
    const { user, container } = await setup();
    axios.post.mockRejectedValueOnce({ response: { data: { message: "Storage is full" } } });

    await user.upload(fileInput(container), imageFile());
    expect(await screen.findByRole("alert")).toHaveTextContent("Storage is full");

    imageFails = true;
    await user.upload(fileInput(container), imageFile("broken.png"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read that image."));
    expect(axios.post).toHaveBeenCalledTimes(1); // nothing was uploaded for the unreadable image
  });

  it("shows Remove only when there is a custom photo", async () => {
    await setup();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("removes the photo and says which photo is used now", async () => {
    const withBoth = { ...me, avatar: "https://img.example.com/a.jpg", photo: "https://google.example.com/p.jpg" };
    const { user, store } = await setup(withBoth);
    axios.delete.mockResolvedValueOnce({ data: { ...withBoth, avatar: "" } });

    await user.click(screen.getByRole("button", { name: /remove/i }));

    expect(axios.delete).toHaveBeenCalledWith(`${BASE}/api/user/avatar`, { withCredentials: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Custom photo removed. Using your Google photo.");
    expect(store.getState().user.userData.avatar).toBe("");
  });

  it("says 'Photo removed.' when there is no Google photo to fall back to", async () => {
    const withCustom = { ...me, avatar: "https://img.example.com/a.jpg" };
    const { user } = await setup(withCustom);
    axios.delete.mockResolvedValueOnce({ data: { ...withCustom, avatar: "" } });

    await user.click(screen.getByRole("button", { name: /remove/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Photo removed.");
  });

  it("shows a message when removing fails", async () => {
    const { user } = await setup({ ...me, avatar: "https://img.example.com/a.jpg" });
    axios.delete.mockRejectedValueOnce(new Error("network"));

    await user.click(screen.getByRole("button", { name: /remove/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to remove photo.");
  });
});

describe("Profile: the shared demo account", () => {
  const demo = { ...me, email: DEMO_EMAIL, name: "Demo User", avatar: "https://img.example.com/a.jpg" };

  it("explains the limits and disables everything that would change the account", async () => {
    await setup(demo);

    expect(screen.getByText(/this is the shared demo account/i)).toBeInTheDocument();
    expect(nameInput()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Change" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /change photo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /remove/i })).toBeDisabled();
  });

  it("keeps everything else working: billing and navigation", async () => {
    const { user } = await setup(demo);
    expect(screen.getByRole("button", { name: /buy credits/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /view all/i }));
    expect(screen.getByText("History page")).toBeInTheDocument();
  });

  it("does not disable anything for a normal account", async () => {
    await setup({ ...me, avatar: "https://img.example.com/a.jpg" });

    expect(screen.queryByText(/shared demo account/i)).not.toBeInTheDocument();
    expect(nameInput()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Change" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /change photo/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /remove/i })).toBeEnabled();
  });
});

describe("Profile: logging out", () => {
  it("logs out on the server and in Firebase, clears the user and goes home", async () => {
    const { user, store } = await setup();
    axios.post.mockResolvedValueOnce({ data: {} });
    signOut.mockResolvedValueOnce();

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(axios.post).toHaveBeenCalledWith(`${BASE}/api/auth/logout`, {}, { withCredentials: true });
    expect(signOut).toHaveBeenCalledWith({ name: "fake-auth" });
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(store.getState().user.userData).toBeNull();
  });

  it("stays on the page, still signed in, when logging out fails", async () => {
    const { user, store } = await setup();
    axios.post.mockRejectedValueOnce(new Error("network"));

    await user.click(screen.getByRole("button", { name: /logout/i }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
    expect(store.getState().user.userData).not.toBeNull();
  });
});