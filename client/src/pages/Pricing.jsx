import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import { BsCoin } from "react-icons/bs";
import { FaPlay, FaCheck, FaSpinner, FaLock } from "react-icons/fa";
import Navbar from "../components/Navbar";
import { serverUrl, INTERVIEW_COST } from "../config";
import { setUserData } from "../redux/userSlice";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

function Pricing() {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [packs, setPacks] = useState([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [buyingId, setBuyingId] = useState(null);
  const [message, setMessage] = useState(null);

  const credits = userData?.credits ?? 0;
  const interviewsLeft = Math.floor(credits / INTERVIEW_COST);
  const canInterview = credits >= INTERVIEW_COST;

  useEffect(() => {
    const loadPacks = async () => {
      try {
        const result = await axios.get(serverUrl + "/api/payment/packs", {
          withCredentials: true,
        });
        setPacks(result.data || []);
      } catch {
        setMessage({
          type: "error",
          text: "Couldn't load credit packs. Please refresh.",
        });
      } finally {
        setLoadingPacks(false);
      }
    };
    loadPacks();
  }, []);

  const handleBuy = async (pack) => {
    if (buyingId) return;
    setBuyingId(pack.id);
    setMessage(null);

    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        throw new Error(
          "Couldn't load the payment window. Check your connection.",
        );
      }

      const { data: order } = await axios.post(
        serverUrl + "/api/payment/order",
        { packId: pack.id },
        { withCredentials: true },
      );

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "InterviewFlow",
        description: `${order.credits} interview credits`,
        order_id: order.orderId,
        prefill: { name: userData?.name, email: userData?.email },
        theme: { color: "#4F57C9" },
        handler: async (response) => {
          try {
            const result = await axios.post(
              serverUrl + "/api/payment/verify",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              { withCredentials: true },
            );
            dispatch(
              setUserData({ ...userData, credits: result.data.credits }),
            );
            setMessage({
              type: "success",
              text: result.data.added
                ? `Payment successful. ${result.data.added} credits added.`
                : "This payment was already recorded.",
            });
          } catch (error) {
            setMessage({
              type: "error",
              text:
                (error.response?.data?.message ||
                  "Couldn't confirm the payment.") +
                ` If money was deducted, keep this payment ID: ${response.razorpay_payment_id}`,
            });
          } finally {
            setBuyingId(null);
          }
        },
        modal: { ondismiss: () => setBuyingId(null) },
      });

      rzp.on("payment.failed", (resp) => {
        setMessage({
          type: "error",
          text: resp?.error?.description || "Payment failed. Please try again.",
        });
        setBuyingId(null);
      });

      rzp.open();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          error.message ||
          "Something went wrong. Please try again.",
      });
      setBuyingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
        <div className="mb-10 text-center">
          <p className="mb-2 text-sm text-muted">
            Each interview uses {INTERVIEW_COST} credits.
          </p>
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">Credits</h1>
          <p className="mt-2 text-muted">Top up anytime and keep practising.</p>
          <p className="mt-1 text-sm text-muted">
            The Resume tailor and model answers are free and don't use credits.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8 flex flex-col items-center justify-between gap-6 rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:p-8"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-soft">
              <BsCoin size={26} className="text-amber" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Your balance
              </p>
              <p className="text-3xl font-bold text-ink">
                {credits}{" "}
                <span className="text-base font-medium text-muted">credits</span>
              </p>
              <p className="text-sm text-muted">
                {canInterview
                  ? `Enough for ${interviewsLeft} interview${interviewsLeft === 1 ? "" : "s"}`
                  : `You need ${INTERVIEW_COST} credits to start an interview`}
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: canInterview ? 1.04 : 1 }}
            whileTap={{ scale: canInterview ? 0.96 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            onClick={() => navigate("/interview")}
            disabled={!canInterview}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo px-7 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaPlay size={11} />
            Conduct interview
          </motion.button>
        </motion.div>

        {message && (
          <p
            role={message.type === "success" ? "status" : "alert"}
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${message.type === "success"
              ? "border-teal/30 bg-teal-soft text-teal-deep"
              : "border-rose/30 bg-rose-soft text-rose-deep"
              }`}
          >
            {message.text}
          </p>
        )}

        <h2 className="mb-4 text-lg font-bold text-ink">Buy credits</h2>

        {loadingPacks ? (
          <div className="grid gap-5 sm:grid-cols-3" role="status" aria-label="Loading packs">
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-64 animate-pulse rounded-3xl bg-line" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3">
            {packs.map((pack, i) => {
              const interviews = Math.floor(pack.credits / INTERVIEW_COST);
              const perInterview = interviews
                ? Math.round(pack.price / interviews)
                : pack.price;
              const buying = buyingId === pack.id;

              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  whileHover={{ y: -4 }}
                  className={`relative flex flex-col rounded-3xl border bg-surface p-6 transition-colors ${pack.popular
                    ? "border-indigo"
                    : "border-line hover:border-line-strong"
                    }`}
                >
                  {pack.popular && (
                    <span className="absolute -top-3 left-6 rounded-full bg-indigo px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Most popular
                    </span>
                  )}

                  <p className="font-semibold text-ink">{pack.name}</p>
                  <p className="mt-3 text-4xl font-bold text-ink">₹{pack.price}</p>
                  <p className="mt-1 text-sm text-muted">{pack.credits} credits</p>

                  <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
                    <li className="flex items-center gap-2">
                      <FaCheck className="text-teal" size={12} />
                      {interviews} interviews
                    </li>
                    <li className="flex items-center gap-2">
                      <FaCheck className="text-teal" size={12} />
                      About ₹{perInterview} per interview
                    </li>
                    <li className="flex items-center gap-2">
                      <FaCheck className="text-teal" size={12} />
                      Full reports and PDF downloads
                    </li>
                  </ul>

                  <motion.button
                    whileHover={{ scale: buying ? 1 : 1.03 }}
                    whileTap={{ scale: buying ? 1 : 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={() => handleBuy(pack)}
                    disabled={!!buyingId}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${pack.popular
                      ? "bg-indigo text-white hover:opacity-90"
                      : "border border-line-strong bg-surface text-ink hover:bg-canvas"
                      }`}
                  >
                    {buying ? (
                      <>
                        <FaSpinner className="animate-spin" size={13} /> Processing...
                      </>
                    ) : (
                      "Buy now"
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <FaLock size={10} /> Payments are processed by Razorpay.{" "}
          <Link to="/terms" className="underline hover:text-ink">
            Refund info is in the Terms.
          </Link>
        </p>
      </main>
    </div>
  );
}

export default Pricing;