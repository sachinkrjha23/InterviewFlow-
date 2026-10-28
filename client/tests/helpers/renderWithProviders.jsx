import { render } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import userSlice from "../../src/redux/userSlice.js";

export const demoUser = {
  _id: "u1",
  name: "Test User",
  email: "test@example.com",
  credits: 150,
};

// A real Redux store (same reducer as the app) for every test, never the app's shared one.
export const makeStore = (userState = { userData: null, authChecked: true }) =>
  configureStore({ reducer: { user: userSlice }, preloadedState: { user: userState } });

export const signedIn = (user = demoUser) => ({ userData: user, authChecked: true });

export function renderWithProviders(ui, { route = "/", userState, store } = {}) {
  const realStore = store || makeStore(userState);
  const view = render(
    <Provider store={realStore}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Provider>,
  );
  return { store: realStore, ...view };
}