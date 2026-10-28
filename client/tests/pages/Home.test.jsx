import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import Home from "../../src/pages/Home.jsx";
import { demoUser, renderWithProviders, signedIn } from "../helpers/renderWithProviders.jsx";

vi.mock("../../src/components/Navbar.jsx", () => ({ default: () => null }));
vi.mock("../../src/components/Footer.jsx", () => ({ default: () => null }));
vi.mock("../../src/components/AuthModel.jsx", () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Sign in">
      <button onClick={onClose}>Close sign in</button>
    </div>
  ),
}));

const renderHome = (userState) =>
  renderWithProviders(
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/interview" element={<p>Interview page</p>} />
      <Route path="/history" element={<p>History page</p>} />
    </Routes>,
    { route: "/", userState },
  );

describe("Home page", () => {
  it("shows the headline, the intro text and the credit facts", () => {
    renderHome({ userData: null, authChecked: true });

    expect(screen.getByRole("heading", { level: 1, name: "Practice Interviews with AI Intelligence" })).toBeInTheDocument();
    expect(screen.getByText(/role-based mock interviews with ai-voiced questions/i)).toBeInTheDocument();
    expect(screen.getByText("Each interview uses 50 credits. New accounts start with 150.")).toBeInTheDocument();
    expect(screen.getByText("Illustrations on this page use sample data.")).toBeInTheDocument();
  });

  it("keeps every section heading", () => {
    renderHome({ userData: null, authChecked: true });

    expect(screen.getByRole("heading", { level: 2, name: "Advanced AI Capabilities" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Interview Modes and Features" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Timer Based Simulation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Downloadable PDF Report" })).toBeInTheDocument();
  });

  it("asks a signed-out visitor to sign in instead of starting an interview", async () => {
    const user = userEvent.setup();
    renderHome({ userData: null, authChecked: true });

    await user.click(screen.getAllByRole("button", { name: "Start Interview" })[0]);

    expect(screen.getByRole("dialog", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Interview page")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close sign in" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks a signed-out visitor to sign in before showing the history", async () => {
    const user = userEvent.setup();
    renderHome({ userData: null, authChecked: true });

    await user.click(screen.getByRole("button", { name: "View Interview History" }));

    expect(screen.getByRole("dialog", { name: "Sign in" })).toBeInTheDocument();
  });

  it("takes a signed-in user to the interview page from either Start Interview button", async () => {
    const user = userEvent.setup();
    const buttons = () => screen.getAllByRole("button", { name: "Start Interview" });
    expect(renderHome(signedIn(demoUser)).store).toBeDefined();
    expect(buttons()).toHaveLength(2); // the hero and the closing banner

    await user.click(buttons()[1]);

    expect(screen.getByText("Interview page")).toBeInTheDocument();
  });

  it("takes a signed-in user to the history page", async () => {
    const user = userEvent.setup();
    renderHome(signedIn(demoUser));

    await user.click(screen.getByRole("button", { name: "View Interview History" }));

    expect(screen.getByText("History page")).toBeInTheDocument();
  });
});