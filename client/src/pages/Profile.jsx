import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import {
  FaCamera,
  FaTrash,
  FaPlusCircle,
  FaHistory,
  FaCoins,
  FaGoogle,
  FaCheckCircle,
  FaSpinner,
  FaTrophy,
  FaReceipt,
  FaChevronRight,
} from "react-icons/fa";
import { HiOutlineLogout } from "react-icons/hi";
import { signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { serverUrl } from "../App";
import { setUserData } from "../redux/userSlice";
import { auth } from "../utils/firebase.js";
import Avatar from "../components/Avatar";
import Navbar from "../components/Navbar";

const card = "bg-white rounded-3xl border border-gray-200 shadow-sm p-6";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const scoreClass = (s) =>
  s >= 8
    ? "bg-emerald-50 text-emerald-700"
    : s >= 6
      ? "bg-blue-50 text-blue-700"
      : s >= 4
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";

function Msg({ m }) {
  if (!m) return null;
  return (
    <p
      className={`mt-3 text-sm rounded-xl px-4 py-3 border ${m.type === "success"
          ? "text-emerald-700 bg-emerald-50 border-emerald-100"
          : "text-red-500 bg-red-50 border-red-100"
        }`}
    >
      {m.text}
    </p>
  );
}

const resizeImage = (file, maxSide = 800) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Couldn't process that image.")),
        "image/jpeg",
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };

    img.src = url;
  });

function Profile() {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [name, setName] = useState(userData?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState(null);

  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);

  const [savingPhoto, setSavingPhoto] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [photoMsg, setPhotoMsg] = useState(null);

  const [interviews, setInterviews] = useState(null);
  const [payments, setPayments] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [h, p] = await Promise.allSettled([
        axios.get(serverUrl + "/api/interview/history", { withCredentials: true }),
        axios.get(serverUrl + "/api/payment/history", { withCredentials: true }),
      ]);
      if (h.status === "rejected" || p.status === "rejected") setLoadFailed(true);
      setInterviews(h.status === "fulfilled" ? h.value.data || [] : []);
      setPayments(p.status === "fulfilled" ? p.value.data || [] : []);
    };
    load();
  }, []);

  const completed = (interviews || []).filter((i) => i.status === "Completed");
  const avgScore = completed.length
    ? completed.reduce((s, i) => s + (i.finalScore || 0), 0) / completed.length
    : null;

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      setNameMsg({ type: "error", text: "Name must be 2-60 characters." });
      return;
    }
    setSavingName(true);
    setNameMsg(null);
    try {
      const result = await axios.patch(
        serverUrl + "/api/user/profile",
        { name: trimmed },
        { withCredentials: true }
      );
      dispatch(setUserData(result.data));
      setNameMsg({ type: "success", text: "Name updated." });
    } catch (error) {
      setNameMsg({
        type: "error",
        text: error.response?.data?.message || "Failed to update name.",
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangeEmail = async () => {
    setChangingEmail(true);
    setEmailMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const response = await signInWithPopup(auth, provider);
      const idToken = await response.user.getIdToken();

      const result = await axios.post(
        serverUrl + "/api/user/email/change",
        { idToken },
        { withCredentials: true }
      );

      dispatch(setUserData(result.data));
      setConfirmingEmail(false);
      setEmailMsg({
        type: "success",
        text: `Sign-in email changed to ${result.data.email}.`,
      });
    } catch (error) {
      if (
        error?.code === "auth/popup-closed-by-user" ||
        error?.code === "auth/cancelled-popup-request"
      ) {
        setEmailMsg({
          type: "error",
          text: "Google sign-in was closed. Your email wasn't changed.",
        });
      } else {
        setEmailMsg({
          type: "error",
          text:
            error.response?.data?.message ||
            "Couldn't change your email. Please try again.",
        });
      }
    } finally {
      setChangingEmail(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoMsg({ type: "error", text: "Please choose an image file." });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPhotoMsg({ type: "error", text: "Image must be under 15MB." });
      return;
    }

    setSavingPhoto(true);
    setUploadPct(0);
    setPhotoMsg(null);
    try {
      const blob = await resizeImage(file);
      const formData = new FormData();
      formData.append("avatar", blob, "avatar.jpg");

      const result = await axios.post(serverUrl + "/api/user/avatar", formData, {
        withCredentials: true,
        onUploadProgress: (ev) => {
          if (ev.total) setUploadPct(Math.round((ev.loaded * 100) / ev.total));
        },
      });

      dispatch(setUserData(result.data));
      setPhotoMsg({ type: "success", text: "Profile photo updated." });
    } catch (error) {
      setPhotoMsg({
        type: "error",
        text:
          error.response?.data?.message ||
          error.message ||
          "Failed to update photo.",
      });
    } finally {
      setSavingPhoto(false);
      setUploadPct(0);
    }
  };

  const handleRemovePhoto = async () => {
    setSavingPhoto(true);
    setPhotoMsg(null);
    try {
      const result = await axios.delete(serverUrl + "/api/user/avatar", {
        withCredentials: true,
      });
      dispatch(setUserData(result.data));
      setPhotoMsg({
        type: "success",
        text: userData?.photo
          ? "Custom photo removed. Using your Google photo."
          : "Photo removed.",
      });
    } catch (error) {
      setPhotoMsg({
        type: "error",
        text: error.response?.data?.message || "Failed to remove photo.",
      });
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(serverUrl + "/api/auth/logout", {}, { withCredentials: true });
      await signOut(auth);
      dispatch(setUserData(null));
      navigate("/");
    } catch (error) {
      console.log(error);
    }
  };

  const nameChanged = name.trim() !== (userData?.name || "");

  return (
    <div className="min-h-screen bg-[#f3f3f3] pb-16">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 pt-10">
        <h1 className="text-3xl font-bold text-gray-900">Your Profile</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your details, credits and activity.
        </p>

        <div className="grid gap-6 lg:grid-cols-3 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${card} lg:col-span-1 h-fit text-center`}
          >
            <div className="relative w-28 mx-auto">
              <Avatar user={userData} size={112} />
              {savingPhoto && (
                <div className="absolute inset-0 rounded-full bg-white/75 flex flex-col items-center justify-center">
                  <FaSpinner className="animate-spin text-emerald-600" size={20} />
                  {uploadPct > 0 && uploadPct < 100 && (
                    <span className="text-xs font-semibold text-emerald-700 mt-1">
                      {uploadPct}%
                    </span>
                  )}
                </div>
              )}
            </div>

            <p className="text-xl font-semibold text-gray-900 mt-4">{userData?.name}</p>
            <p className="text-sm text-gray-500 truncate">{userData?.email}</p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={savingPhoto}
                className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <FaCamera size={13} /> Change photo
              </button>
              {userData?.avatar && (
                <button
                  onClick={handleRemovePhoto}
                  disabled={savingPhoto}
                  className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FaTrash size={12} /> Remove
                </button>
              )}
            </div>
            <Msg m={photoMsg} />

            <div className="grid grid-cols-3 gap-2 mt-6">
              {[
                { label: "Credits", value: userData?.credits ?? 0, icon: <FaCoins /> },
                {
                  label: "Done",
                  value: interviews ? completed.length : "—",
                  icon: <FaCheckCircle />,
                },
                {
                  label: "Avg score",
                  value: avgScore != null ? avgScore.toFixed(1) : "—",
                  icon: <FaTrophy />,
                },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-2xl py-3 border border-gray-100">
                  <div className="text-emerald-600 flex justify-center mb-1 text-sm">{s.icon}</div>
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 border border-red-200 text-red-500 px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-red-50 transition"
            >
              <HiOutlineLogout size={16} /> Logout
            </button>
          </motion.div>

          <div className="lg:col-span-2 space-y-6">
            {/* Account details: update name + change email */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={card}
            >
              <h2 className="text-lg font-bold text-gray-900 mb-5">Account details</h2>

              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                Display name
              </label>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="flex-1 min-w-0 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !nameChanged}
                  className="bg-emerald-600 text-white px-5 rounded-xl text-sm font-semibold hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
              </div>
              <Msg m={nameMsg} />

              <div className="h-px bg-gray-100 my-6" />

              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                Sign-in email
              </label>
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <FaGoogle className="text-gray-500 shrink-0" />
                <span className="text-sm text-gray-700 truncate">{userData?.email}</span>
                <button
                  onClick={() => {
                    setConfirmingEmail(true);
                    setEmailMsg(null);
                  }}
                  disabled={confirmingEmail || changingEmail}
                  className="ml-auto bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  Change
                </button>
              </div>

              {confirmingEmail && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4"
                >
                  <p className="text-sm font-semibold text-emerald-900">
                    Switch to a different Google account
                  </p>
                  <ul className="text-sm text-emerald-800 mt-2 space-y-1 list-disc pl-5">
                    <li>You'll choose the Google account you want to sign in with from now on.</li>
                    <li>Your credits, interviews and payments stay with this profile.</li>
                    <li>Your current Google account is removed from this profile. Signing in with it later would start a brand-new profile.</li>
                  </ul>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleChangeEmail}
                      disabled={changingEmail}
                      className="inline-flex items-center gap-2 bg-black text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {changingEmail ? (
                        <>
                          <FaSpinner className="animate-spin" size={12} /> Waiting for Google...
                        </>
                      ) : (
                        <>
                          <FaGoogle size={13} /> Continue with Google
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmingEmail(false)}
                      disabled={changingEmail}
                      className="bg-white border border-emerald-300 text-emerald-800 px-5 py-2 rounded-full text-sm font-semibold hover:bg-emerald-100 transition disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
              <Msg m={emailMsg} />
            </motion.div>

            {/* Billing */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={card}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Billing</h2>
                  <p className="text-sm text-gray-500">
                    {userData?.credits ?? 0} credits available
                  </p>
                </div>
                <button
                  onClick={() => navigate("/pricing")}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-md hover:opacity-90 transition"
                >
                  <FaCoins size={13} /> Buy credits
                </button>
              </div>

              {payments === null ? (
                <p className="text-sm text-gray-400">Loading payments...</p>
              ) : payments.length === 0 ? (
                <p className="text-sm text-gray-400">No payments yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <div key={p._id} className="flex items-center gap-3 py-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <FaReceipt size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {p.packName} pack · +{p.credits} credits
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {fmtDate(p.paidAt)}
                          {p.paymentId ? ` · ${p.paymentId}` : ""}
                        </p>
                      </div>
                      <p className="ml-auto text-sm font-semibold text-gray-900 shrink-0">
                        ₹{(p.amount / 100).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent interviews */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={card}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <h2 className="text-lg font-bold text-gray-900">Recent interviews</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate("/interview")}
                    className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-xs font-semibold hover:opacity-90 transition"
                  >
                    <FaPlusCircle size={12} /> New
                  </button>
                  <button
                    onClick={() => navigate("/history")}
                    className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-xs font-semibold hover:bg-gray-200 transition"
                  >
                    <FaHistory size={12} /> View all
                  </button>
                </div>
              </div>

              {interviews === null ? (
                <p className="text-sm text-gray-400">Loading interviews...</p>
              ) : interviews.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No interviews yet. Start your first one!
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {interviews.slice(0, 5).map((item) => {
                    const isComplete = item.status === "Completed";
                    return (
                      <button
                        key={item._id}
                        onClick={() => navigate(`/report/${item._id}`)}
                        className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded-xl px-2 -mx-2 transition"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {item.role}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.mode} · {item.experience} · {fmtDate(item.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${isComplete
                              ? scoreClass(item.finalScore || 0)
                              : "bg-gray-100 text-gray-500"
                            }`}
                        >
                          {isComplete ? Number(item.finalScore || 0).toFixed(1) : "Incomplete"}
                        </span>
                        <FaChevronRight size={11} className="text-gray-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {loadFailed && (
                <p className="mt-3 text-xs text-red-500">
                  Some activity couldn't be loaded. Refresh to try again.
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;