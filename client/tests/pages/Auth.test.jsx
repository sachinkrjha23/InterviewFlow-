import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import axios from "axios";
import { signInWithPopup } from "firebase/auth";
import Auth from "../../src/pages/Auth.jsx";
import { demoUser, renderWithProviders } from "../helpers/renderWithProviders.jsx";

vi.mock("axios", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock("firebase/auth", () => ({ signInWithPopup: vi.fn() }));
vi.mock("../../src/utils/firebase.js", () => ({ auth: {}, provider: {} }));

const renderAuth = (route = "/auth", userState) =>
  renderWithProviders(
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<p>Home page</p>} />
      <Route path="/history" element={<p>History page</p>} />
    </Routes>,
    { route, userState },
  );

const googleResult = (token = "firebase-id-token") => ({
  user: { getIdToken: vi.fn().mockResolvedValue(token) },
});

beforeEach(() => {
  axios.post.mockReset();
  signInWithPopup.mockReset();
});

describe("Auth page: redirects", () => {
  it("shows the loader until the sign-in check has finished", () => {
    renderAuth("/auth", { userData: null, authChecked: false });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
  });

  it("sends an already signed-in user back to the page they came from", () => {
    renderAuth({ pathname: "/auth", state: { from: "/history" } }, { userData: demoUser, authChecked: true });
    expect(screen.getByText("History page")).toBeInTheDocument();
  });

  it("goes to the home page when there is no page to go back to", () => {
    renderAuth("/auth", { userData: demoUser, authChecked: true });
    expect(screen.getByText("Home page")).toBeInTheDocument();
  });

  it.each(["//evil.example.com", "https://evil.example.com", "history", 42])(
    "ignores an unsafe return address (%s) and goes home",
    (from) => {
      renderAuth({ pathname: "/auth", state: { from } }, { userData: demoUser, authChecked: true });
      expect(screen.getByText("Home page")).toBeInTheDocument();
    },
  );
});

describe("Auth page: Google sign-in", () => {
  it("sends the Firebase token to our server, stores the user and leaves the page", async () => {
    const user = userEvent.setup();
    signInWithPopup.mockResolvedValue(googleResult("abc123"));
    axios.post.mockResolvedValue({ data: demoUser });
    const { store } = renderAuth({ pathname: "/auth", state: { from: "/history" } }, { userData: null, authChecked: true });

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:1000/api/auth/google",
      { idToken: "abc123" },
      { withCredentials: true },
    );
    expect(store.getState().user.userData).toEqual(demoUser);
    expect(await screen.findByText("History page")).toBeInTheDocument();
  });

  it("stays quiet when the person simply closes the Google window", async () => {
    const user = userEvent.setup();
    signInWithPopup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    renderAuth();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("shows the server's message when our server refuses the sign-in", async () => {
    const user = userEvent.setup();
    signInWithPopup.mockResolvedValue(googleResult());
    axios.post.mockRejectedValue({ response: { data: { message: "Token expired" } } });
    const { store } = renderAuth();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Token expired");
    expect(store.getState().user.userData).toBeNull();
  });

  it("shows a general message for any other failure", async () => {
    const user = userEvent.setup();
    signInWithPopup.mockRejectedValue(new Error("network down"));
    renderAuth();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed. Please try again.");
  });

  it("disables both buttons while waiting, so a double click cannot sign in twice", async () => {
    const user = userEvent.setup();
    let finishPopup;
    signInWithPopup.mockReturnValue(new Promise((resolve) => (finishPopup = resolve)));
    axios.post.mockResolvedValue({ data: demoUser });
    renderAuth();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(screen.getByRole("button", { name: /waiting for google/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /try the demo account/i })).toBeDisabled();
    expect(signInWithPopup).toHaveBeenCalledTimes(1);

    finishPopup(googleResult());
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

describe("Auth page: demo account", () => {
  it("starts the demo account through our server", async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue({ data: { ...demoUser, email: "demo@interviewflow.demo" } });
    const { store } = renderAuth();

    await user.click(screen.getByRole("button", { name: /try the demo account/i }));

    expect(axios.post).toHaveBeenCalledWith("http://localhost:1000/api/auth/demo", {}, { withCredentials: true });
    expect(store.getState().user.userData.email).toBe("demo@interviewflow.demo");
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("shows the server's message, or a general one, when the demo cannot start", async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({ response: { data: { message: "Demo is off" } } });
    renderAuth();

    await user.click(screen.getByRole("button", { name: /try the demo account/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Demo is off");

    axios.post.mockRejectedValueOnce(new Error("boom"));
    await user.click(screen.getByRole("button", { name: /try the demo account/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't start the demo. Please try again."),
    );
  });
});