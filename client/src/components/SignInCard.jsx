import { useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import axios from "axios";
import { signInWithPopup } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";
import { auth, provider } from "../utils/firebase.js";
import { serverUrl, SIGNUP_CREDITS, DEMO_ENABLED } from "../config.js";
import { setUserData } from "../redux/userSlice.js";
import Logo from "./Logo";

const QUIET_CODES = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

function SignInCard() {
  const dispatch = useDispatch();
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    if (loading) return;
    setErrorMsg("");
    setLoading(true);
    try {
      const response = await signInWithPopup(auth, provider);
      const idToken = await response.user.getIdToken();
      const result = await axios.post(
        serverUrl + "/api/auth/google",
        { idToken },
        { withCredentials: true },
      );
      dispatch(setUserData(result.data));
    } catch (error) {
      if (!QUIET_CODES.includes(error?.code)) {
        setErrorMsg(error.response?.data?.message || "Sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    if (loading) return;
    setErrorMsg("");
    setLoading(true);
    try {
      const result = await axios.post(
        serverUrl + "/api/auth/demo",
        {},
        { withCredentials: true },
      );
      dispatch(setUserData(result.data));
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Couldn't start the demo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-line bg-surface p-8">
      <div className="mb-6 flex justify-center">
        <Logo link={false} />
      </div>

      <h1 id="signin-title" className="text-center text-2xl font-medium text-ink">
        Sign in to continue
      </h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-muted">
        Practice interviews with spoken questions, scored feedback and downloadable reports.
      </p>

      <p className="mx-auto mt-4 w-fit rounded-md bg-teal-soft px-3 py-1 text-xs font-medium text-teal-deep">
        New accounts start with {SIGNUP_CREDITS} free credits
      </p>

      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FcGoogle size={20} aria-hidden="true" />
        {loading ? "Waiting for Google…" : "Continue with Google"}
      </button>

      {DEMO_ENABLED && (
        <>
          <p className="mt-4 text-center text-xs text-muted">or</p>
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-indigo px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Try the demo account
          </button>
          <p className="mt-2 text-center text-xs text-muted">
            A shared account with credits. For payments use Razorpay test mode only.
          </p>
        </>
      )}

      {errorMsg && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-3 py-2 text-sm text-rose-deep">
          {errorMsg}
        </p>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        By continuing you agree to our{" "}
        <Link to="/terms" className="text-indigo-deep underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="text-indigo-deep underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

export default SignInCard;