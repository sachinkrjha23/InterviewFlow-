import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import axios from "axios";
import Pricing from "../../src/pages/Pricing.jsx";
import { demoUser, renderWithProviders, signedIn } from "../helpers/renderWithProviders.jsx";

vi.mock("axios", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock("../../src/components/Navbar.jsx", () => ({ default: () => null }));

const BASE = "http://localhost:1000";

const packs = [
  { id: "starter", name: "Starter", price: 99, credits: 100, popular: false },
  { id: "pro", name: "Pro", price: 249, credits: 300, popular: true },
];

const order = { keyId: "rzp_test_key", amount: 24900, currency: "INR", orderId: "order_1", credits: 300 };

// A stand-in for the Razorpay checkout window: the test decides what the "customer" does.
const checkout = { windows: [] };
class FakeRazorpay {
  constructor(options) {
    this.options = options;
    this.handlers = {};
    this.open = vi.fn();
    checkout.windows.push(this);
  }
  on(event, handler) {
    this.handlers[event] = handler;
  }
}
const lastWindow = () => checkout.windows[checkout.windows.length - 1];

const paidResponse = {
  razorpay_order_id: "order_1",
  razorpay_payment_id: "pay_1",
  razorpay_signature: "sig_1",
};

const setup = ({ credits = 150, user = { ...demoUser, credits } } = {}) => {
  const view = renderWithProviders(
    <Routes>
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/interview" element={<p>Interview page</p>} />
    </Routes>,
    { route: "/pricing", userState: signedIn(user) },
  );
  return { user: userEvent.setup(), ...view };
};

const buyButtons = () => screen.findAllByRole("button", { name: "Buy now" });

// click "Buy now" on the pack at this position and wait until the checkout window has opened
const startPurchase = async (user, position = 1) => {
  const buttons = await buyButtons();
  await user.click(buttons[position]);
  await waitFor(() => expect(lastWindow()?.open).toHaveBeenCalled());
};

beforeEach(() => {
  axios.get.mockReset();
  axios.post.mockReset();
  checkout.windows.length = 0;
  window.Razorpay = FakeRazorpay;
  axios.get.mockResolvedValue({ data: packs });
});

describe("Pricing: packs and balance", () => {
  it("shows a loading state first, then the packs with price, credits and interviews", async () => {
    setup();
    expect(screen.getByRole("status", { name: "Loading packs" })).toBeInTheDocument();

    expect(await screen.findByText("Starter")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/api/payment/packs`, { withCredentials: true });
    expect(screen.queryByRole("status", { name: "Loading packs" })).not.toBeInTheDocument();
    expect(screen.getByText("₹99")).toBeInTheDocument();
    expect(screen.getByText("100 credits")).toBeInTheDocument();
    expect(screen.getByText("2 interviews")).toBeInTheDocument();
    expect(screen.getByText("About ₹50 per interview")).toBeInTheDocument(); // 99 / 2 = 49.5, rounded
    expect(screen.getByText("6 interviews")).toBeInTheDocument();
    expect(screen.getByText("About ₹42 per interview")).toBeInTheDocument(); // 249 / 6 = 41.5, rounded
  });

  it("marks only the popular pack", async () => {
    setup();
    await screen.findByText("Pro");
    expect(screen.getAllByText("Most popular")).toHaveLength(1);
  });

  it("shows an error and no Buy buttons when the packs cannot be loaded", async () => {
    axios.get.mockRejectedValue(new Error("network"));
    setup();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load credit packs. Please refresh.");
    expect(screen.queryByRole("button", { name: "Buy now" })).not.toBeInTheDocument();
  });

  it("shows the balance and how many interviews it covers", async () => {
    setup({ credits: 150 });
    expect(screen.getByText("Enough for 3 interviews")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conduct interview/i })).toBeEnabled();
    await screen.findByText("Starter");
  });

  it("says '1 interview' in the singular", async () => {
    setup({ credits: 50 });
    expect(screen.getByText("Enough for 1 interview")).toBeInTheDocument();
    await screen.findByText("Starter");
  });

  it("disables 'Conduct interview' and explains why when credits are below the cost", async () => {
    setup({ credits: 49 });
    expect(screen.getByText("You need 50 credits to start an interview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conduct interview/i })).toBeDisabled();
    await screen.findByText("Starter");
  });

  it("takes the person to the interview page with 'Conduct interview'", async () => {
    const { user } = setup({ credits: 150 });
    await screen.findByText("Starter");

    await user.click(screen.getByRole("button", { name: /conduct interview/i }));

    expect(screen.getByText("Interview page")).toBeInTheDocument();
  });
});

describe("Pricing: buying credits", () => {
  it("creates an order for the chosen pack and opens the checkout with the right details", async () => {
    axios.post.mockResolvedValueOnce({ data: order });
    const { user } = setup();

    await startPurchase(user, 1);

    expect(axios.post).toHaveBeenCalledWith(`${BASE}/api/payment/order`, { packId: "pro" }, { withCredentials: true });
    expect(lastWindow().options).toMatchObject({
      key: "rzp_test_key",
      amount: 24900,
      currency: "INR",
      order_id: "order_1",
      description: "300 interview credits",
      prefill: { name: demoUser.name, email: demoUser.email },
    });
  });

  it("locks every Buy button while the payment is open and shows 'Processing...' on the chosen one", async () => {
    axios.post.mockResolvedValueOnce({ data: order });
    const { user } = setup();

    await startPurchase(user, 1);

    const buttons = screen.getAllByRole("button", { name: /buy now|processing/i });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: /processing/i })).toBeInTheDocument();
  });

  it("verifies the payment, updates the credits in Redux and shows a success message", async () => {
    axios.post.mockResolvedValueOnce({ data: order });
    const { user, store } = setup({ credits: 150 });
    await startPurchase(user, 1);

    axios.post.mockResolvedValueOnce({ data: { credits: 450, added: 300 } });
    await lastWindow().options.handler(paidResponse);

    expect(axios.post).toHaveBeenLastCalledWith(
      `${BASE}/api/payment/verify`,
      { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig_1" },
      { withCredentials: true },
    );
    expect(store.getState().user.userData.credits).toBe(450);
    expect(await screen.findByRole("status", { name: "" })).toHaveTextContent("Payment successful. 300 credits added.");
    expect(screen.getByText("Enough for 9 interviews")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Buy now" })).toHaveLength(2));
    for (const button of screen.getAllByRole("button", { name: "Buy now" })) expect(button).toBeEnabled();
  });

  it("says so when the payment was already recorded, without adding credits twice", async () => {
    axios.post.mockResolvedValueOnce({ data: order });
    const { user, store } = setup({ credits: 150 });
    await startPurchase(user, 1);

    axios.post.mockResolvedValueOnce({ data: { credits: 150, added: 0 } });
    await lastWindow().options.handler(paidResponse);

    expect(await screen.findByText("This payment was already recorded.")).toBeInTheDocument();
    expect(store.getState().user.userData.credits).toBe(150);
  });

  it("keeps the credits unchanged and shows the payment ID when verifying fails", async () => {
    axios.post.mockResolvedValueOnce({ data: order });
    const { user, store } = setup({ credits: 150 });
    await startPurchase(user, 1);

    axios.post.mockRejectedValueOnce({ response: { data: { message: "Signature mismatch" } } });
    await lastWindow().options.handler(paidResponse);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Signature mismatch");
    expect(alert).toHaveTextContent("If money was deducted, keep this payment ID: pay_1");
    expect(store.getState().user.userData.credits).toBe(150);
  });

  it("uses a general message plus the payment ID when verifying fails without a server message", async () => {
    axios.post.mockResolvedValueOnce({ data: order });
    const { user } = setup();
    await startPurchase(user, 1);

    axios.post.mockRejectedValueOnce(new Error("network"));
    await lastWindow().options.handler(paidResponse);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't confirm the payment. If money was deducted, keep this payment ID: pay_1");
  });

  it("re-enables the Buy buttons when the person closes the payment window", async () => {
    axios.post.mockResolvedValueOnce({ data: order });
    const { user } = setup();
    await startPurchase(user, 1);

    lastWindow().options.modal.ondismiss();

    await waitFor(() => {
      for (const button of screen.getAllByRole("button", { name: "Buy now" })) expect(button).toBeEnabled();
    });
  });

  it("shows the bank's reason when the payment fails inside the window", async () => {
    axios.post.mockResolvedValueOnce({ data: order });
    const { user } = setup();
    await startPurchase(user, 1);

    lastWindow().handlers["payment.failed"]({ error: { description: "Card declined by bank" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Card declined by bank");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Buy now" })).toHaveLength(2));
  });

  it("shows the server's message and does not open the checkout when the order cannot be created", async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { message: "Unknown pack" } } });
    const { user } = setup();

    await user.click((await buyButtons())[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown pack");
    expect(checkout.windows).toHaveLength(0);
    for (const button of screen.getAllByRole("button", { name: "Buy now" })) expect(button).toBeEnabled();
  });

  it("loads the Razorpay script when it is missing, and explains when it cannot load", async () => {
    delete window.Razorpay;
    const { user } = setup();

    await user.click((await buyButtons())[0]);

    const script = await waitFor(() => {
      const found = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      expect(found).not.toBeNull();
      return found;
    });
    script.dispatchEvent(new Event("error"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the payment window. Check your connection.",
    );
    expect(axios.post).not.toHaveBeenCalled(); // no order is created if the payment window cannot open
    for (const button of screen.getAllByRole("button", { name: "Buy now" })) expect(button).toBeEnabled();
    script.remove();
  });
});