import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "../../src/components/ProtectedRoute.jsx";
import { demoUser, renderWithProviders } from "../helpers/renderWithProviders.jsx";

function AuthPageStub() {
  const location = useLocation();
  return <p>Auth page, came from {location.state?.from}</p>;
}

const renderAt = (route, userState) =>
  renderWithProviders(
    <Routes>
      <Route path="/auth" element={<AuthPageStub />} />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <p>Private history</p>
          </ProtectedRoute>
        }
      />
    </Routes>,
    { route, userState },
  );

describe("ProtectedRoute", () => {
  it("shows the loader and nothing private while the sign-in check is running", () => {
    renderAt("/history", { userData: null, authChecked: false });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Private history")).not.toBeInTheDocument();
    expect(screen.queryByText(/Auth page/)).not.toBeInTheDocument();
  });

  it("sends a signed-out visitor to /auth and remembers the page they wanted", () => {
    renderAt("/history", { userData: null, authChecked: true });
    expect(screen.getByText("Auth page, came from /history")).toBeInTheDocument();
    expect(screen.queryByText("Private history")).not.toBeInTheDocument();
  });

  it("shows the page to a signed-in user", () => {
    renderAt("/history", { userData: demoUser, authChecked: true });
    expect(screen.getByText("Private history")).toBeInTheDocument();
  });
});