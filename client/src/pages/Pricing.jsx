import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import { BsCoin } from "react-icons/bs";
import { FaPlay, FaCheck, FaSpinner, FaLock } from "react-icons/fa";
import Navbar from "../components/Navbar";
import { serverUrl } from "../App";
import { setUserData } from "../redux/userSlice";

const INTERVIEW_COST = 50;

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
      } catch (error) {
        console.log(error);
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
          "Couldn't load the payment window. Check your connection."
        );
      }

      const { data: order } = await axios.post(
        serverUrl + "/api/payment/order",
        { packId: pack.id },
        { withCredentials: true }
      );

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "InterviewFlow",
        description: `${order.credits} interview credits`,
        order_id: order.orderId,
        prefill: { name: userData?.name, email: userData?.email },
        theme: { color: "#059669" },
        handler: async (response) => {
          try {
            const result = await axios.post(
              serverUrl + "/api/payment/verify",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              { withCredentials: true }
            );
            dispatch(
              setUserData({ ...userData, credits: result.data.credits })
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
    <div className="min-h-screen bg-[#f3f3f3] pb-16">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 pt-12">
        <div className="text-center mb-10">
          <p className="text-sm text-gray-500 mb-2">
            Each interview uses {INTERVIEW_COST} credits.
          </p>
          <h1 className="text-4xl font-bold text-gray-900">Credits</h1>
          <p className="text-gray-500 mt-2">
            Top up anytime and keep practising.
          </p>
        </div>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 mb-8
                     flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <BsCoin size={26} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                Your balance
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {credits}{" "}
                <span className="text-base font-medium text-gray-400">
                  credits
                </span>
              </p>
              <p className="text-sm text-gray-500">
                {canInterview
                  ? `Enough for ${interviewsLeft} interview${interviewsLeft === 1 ? "" : "s"
                  }`
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
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500
                       text-white px-7 py-3 rounded-full font-semibold shadow-md
                       hover:from-emerald-500 hover:to-teal-400
                       hover:shadow-lg hover:shadow-emerald-500/30
                       transition-all disabled:opacity-50
                       disabled:cursor-not-allowed disabled:hover:shadow-md"
          >
            <FaPlay size={12} />
            Conduct interview
          </motion.button>
        </motion.div>

        {/* Message */}
        {message && (
          <p
            className={`mb-6 text-sm rounded-xl px-4 py-3 border ${message.type === "success"
              ? "text-emerald-700 bg-emerald-50 border-emerald-100"
              : "text-red-500 bg-red-50 border-red-100"
              }`}
          >
            {message.text}
          </p>
        )}

        <h2 className="text-lg font-bold text-gray-900 mb-4">Buy credits</h2>

        {loadingPacks ? (
          <p className="text-gray-500 text-sm">Loading packs...</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3 pt-4">
            {packs.map((pack, i) => {
              const interviews = Math.floor(pack.credits / INTERVIEW_COST);
              const perInterview = Math.round(pack.price / interviews);
              const buying = buyingId === pack.id;

              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="relative bg-white rounded-3xl p-6 flex flex-col
                             shadow-sm border border-gray-200
                             hover:shadow-lg hover:border-emerald-200
                             transition-all"
                >
                  {/* Ribbon — only on popular */}
                  {pack.popular && (
                    <>
                      {/* Diagonal ribbon */}
                      <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden rounded-tr-3xl pointer-events-none">
                        <div
                          className="absolute top-[18px] right-[-36px] w-[140px]
                   bg-emerald-600 text-white text-[10px] font-bold
                   uppercase tracking-wider text-center
                   py-1.5 rotate-45 shadow-md"
                        >
                          Popular
                        </div>
                      </div>
                    </>
                  )}

                  <p className="font-semibold text-gray-900">{pack.name}</p>
                  <p className="text-4xl font-bold text-gray-900 mt-3">
                    ₹{pack.price}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {pack.credits} credits
                  </p>

                  <ul className="mt-5 space-y-2 text-sm text-gray-600 flex-1">
                    <li className="flex items-center gap-2">
                      <FaCheck className="text-emerald-600" size={12} />
                      {interviews} interviews
                    </li>
                    <li className="flex items-center gap-2">
                      <FaCheck className="text-emerald-600" size={12} />
                      About ₹{perInterview} per interview
                    </li>
                    <li className="flex items-center gap-2">
                      <FaCheck className="text-emerald-600" size={12} />
                      Full reports and PDF downloads
                    </li>
                  </ul>

                  <motion.button
                    whileHover={{ scale: buying ? 1 : 1.03 }}
                    whileTap={{ scale: buying ? 1 : 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={() => handleBuy(pack)}
                    disabled={!!buyingId}
                    className="mt-6 w-full py-3 rounded-full font-semibold text-sm
                               bg-black text-white hover:bg-gray-800
                               transition-colors
                               disabled:opacity-60 disabled:cursor-not-allowed
                               inline-flex items-center justify-center gap-2"
                  >
                    {buying ? (
                      <>
                        <FaSpinner className="animate-spin" size={13} />{" "}
                        Processing...
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

        <p className="mt-8 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
          <FaLock size={10} /> Payments are processed by Razorpay.
        </p>
      </div>
    </div>
  );
}

export default Pricing;