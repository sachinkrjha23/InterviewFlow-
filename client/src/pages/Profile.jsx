import { useEffect, useRef, useState } from "react";
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
  FaStar,
  FaReceipt,
  FaChevronRight,
} from "react-icons/fa";
import { HiOutlineLogout } from "react-icons/hi";
import { signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { serverUrl } from "../config.js";
import { setUserData } from "../redux/userSlice";
import { auth } from "../utils/firebase.js";
import Avatar from "../components/Avatar";
import Navbar from "../components/Navbar";

const card = "rounded-3xl border border-line bg-surface p-6";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const scoreClass = (s) =>
  s >= 8
    ? "bg-teal-soft text-teal-deep"
    : s >= 6
      ? "bg-sky-soft text-sky-deep"
      : s >= 4
        ? "bg-amber-soft text-amber-deep"
        : "bg-rose-soft text-rose-deep";

const barColor = (s) =>
  s >= 8 ? "bg-teal" : s >= 6 ? "bg-sky" : s >= 4 ? "bg-amber" : "bg-rose";

function Msg({ m }) {
  if (!m) return null;
  return (
    <p
      role={m.type === "success" ? "status" : "alert"}
      className={`mt-3 rounded-xl border px-4 py-3 text-sm ${m.type === "success"
          ? "border-teal/30 bg-teal-soft text-teal-deep"
          : "border-rose/30 bg-rose-soft text-rose-deep"
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
        0.85,
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
  const [stats, setStats] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [h, p, s] = await Promise.allSettled([
        axios.get(serverUrl + "/api/interview/history", {
          params: { limit: 5 },
          withCredentials: true,
        }),
        axios.get(serverUrl + "/api/payment/history", { withCredentials: true }),
        axios.get(serverUrl + "/api/interview/stats", { withCredentials: true }),
      ]);
      if (h.status === "rejected" || p.status === "rejected" || s.status === "rejected") {
        setLoadFailed(true);
      }
      setInterviews(h.status === "fulfilled" ? h.value.data || [] : []);
      setPayments(p.status === "fulfilled" ? p.value.data || [] : []);
      if (s.status === "fulfilled") setStats(s.value.data);
    };
    load();
  }, []);

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
        { withCredentials: true },
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
        { withCredentials: true },
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
    } catch {
      // the user stays on the page and can simply try again
    }
  };

  const nameChanged = name.trim() !== (userData?.name || "");
  const hasStats = stats && stats.completed > 0;

  const statCards = [
    {
      label: "Credits",
      value: userData?.credits ?? 0,
      icon: <FaCoins />,
      tone: "bg-amber-soft text-amber",
    },
    {
      label: "Completed",
      value: stats ? stats.completed : "—",
      icon: <FaCheckCircle />,
      tone: "bg-teal-soft text-teal",
    },
    {
      label: "Avg score",
      value: hasStats ? stats.avgScore.toFixed(1) : "—",
      icon: <FaTrophy />,
      tone: "bg-indigo-soft text-indigo",
    },
    {
      label: "Best score",
      value: hasStats ? stats.bestScore.toFixed(1) : "—",
      icon: <FaStar />,
      tone: "bg-violet-soft text-violet",
    },
  ];

  const recentScores = stats?.recentScores || [];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-bold text-ink">Your profile</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your details, credits and activity.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`${card} h-fit text-center lg:col-span-1`}
          >
            <div className="relative mx-auto w-28">
              <Avatar user={userData} size={112} />
              {savingPhoto && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-surface/75">
                  <FaSpinner className="animate-spin text-indigo" size={20} />
                  {uploadPct > 0 && uploadPct < 100 && (
                    <span className="mt-1 text-xs font-semibold text-indigo-deep">
                      {uploadPct}%
                    </span>
                  )}
                </div>
              )}
            </div>

            <p className="mt-4 text-xl font-semibold text-ink">{userData?.name}</p>
            <p className="truncate text-sm text-muted">{userData?.email}</p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => fileRef.current?.click()}
                disabled={savingPhoto}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaCamera size={13} /> Change photo
              </motion.button>
              {userData?.avatar && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleRemovePhoto}
                  disabled={savingPhoto}
                  className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaTrash size={12} /> Remove
                </motion.button>
              )}
            </div>
            <Msg m={photoMsg} />

            <div className="mt-6 grid grid-cols-2 gap-2">
              {statCards.map((s) => (
                <div key={s.label} className="rounded-2xl border border-line bg-canvas px-2 py-3">
                  <div className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-xs ${s.tone}`}>
                    {s.icon}
                  </div>
                  <p className="text-lg font-bold text-ink">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">{s.label}</p>
                </div>
              ))}
            </div>

            {recentScores.length > 1 && (
              <div className="mt-4 rounded-2xl border border-line bg-canvas p-3">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted">
                  Last {recentScores.length} scores
                </p>
                <div className="flex h-14 items-end justify-center gap-1.5">
                  {recentScores.map((r, i) => (
                    <div
                      key={i}
                      title={`${r.finalScore.toFixed(1)} · ${fmtDate(r.createdAt)}`}
                      className={`w-4 rounded-t ${barColor(r.finalScore)}`}
                      style={{ height: `${Math.max(8, (r.finalScore / 10) * 100)}%` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose/40 px-4 py-2.5 text-sm font-medium text-rose-deep hover:bg-rose-soft"
            >
              <HiOutlineLogout size={16} /> Logout
            </button>
          </motion.div>

          <div className="space-y-6 lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className={card}
            >
              <h2 className="mb-5 text-lg font-bold text-ink">Account details</h2>

              <label
                htmlFor="display-name"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted"
              >
                Display name
              </label>
              <div className="flex gap-2">
                <input
                  id="display-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !nameChanged}
                  className="rounded-xl bg-indigo px-5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
              </div>
              <Msg m={nameMsg} />

              <div className="my-6 h-px bg-line" />

              <p className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
                Sign-in email
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
                <FaGoogle className="shrink-0 text-muted" />
                <span className="truncate text-sm text-ink">{userData?.email}</span>
                <button
                  onClick={() => {
                    setConfirmingEmail(true);
                    setEmailMsg(null);
                  }}
                  disabled={confirmingEmail || changingEmail}
                  className="ml-auto shrink-0 rounded-lg border border-line-strong bg-surface px-4 py-1.5 text-xs font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Change
                </button>
              </div>

              {confirmingEmail && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 rounded-xl border border-amber/40 bg-amber-soft p-4"
                >
                  <p className="text-sm font-semibold text-amber-deep">
                    Switch to a different Google account
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-deep">
                    <li>You'll choose the Google account you want to sign in with from now on.</li>
                    <li>Your credits, interviews and payments stay with this profile.</li>
                    <li>Your current Google account is removed from this profile. Signing in with it later would start a brand-new profile.</li>
                  </ul>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleChangeEmail}
                      disabled={changingEmail}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="rounded-lg border border-amber/50 bg-surface px-5 py-2 text-sm font-medium text-amber-deep hover:bg-canvas disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
              <Msg m={emailMsg} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={card}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">Billing</h2>
                  <p className="text-sm text-muted">
                    {userData?.credits ?? 0} credits available
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate("/pricing")}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
                >
                  <FaCoins size={13} /> Buy credits
                </motion.button>
              </div>

              {payments === null ? (
                <p className="text-sm text-muted">Loading payments...</p>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted">No payments yet.</p>
              ) : (
                <div className="divide-y divide-line">
                  {payments.map((p) => (
                    <div key={p._id} className="flex items-center gap-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-soft text-teal">
                        <FaReceipt size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {p.packName} pack · +{p.credits} credits
                        </p>
                        <p className="truncate text-xs text-muted">
                          {fmtDate(p.paidAt)}
                          {p.paymentId ? ` · ${p.paymentId}` : ""}
                        </p>
                      </div>
                      <p className="ml-auto shrink-0 text-sm font-semibold text-ink">
                        ₹{(p.amount / 100).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className={card}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-ink">Recent interviews</h2>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate("/interview")}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    <FaPlusCircle size={12} /> New
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate("/history")}
                    className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-xs font-medium text-ink hover:bg-canvas"
                  >
                    <FaHistory size={12} /> View all
                  </motion.button>
                </div>
              </div>

              {interviews === null ? (
                <p className="text-sm text-muted">Loading interviews...</p>
              ) : interviews.length === 0 ? (
                <p className="text-sm text-muted">No interviews yet. Start your first one!</p>
              ) : (
                <div className="divide-y divide-line">
                  {interviews.slice(0, 5).map((item) => {
                    const isComplete = item.status === "Completed";
                    return (
                      <button
                        key={item._id}
                        onClick={() => navigate(`/report/${item._id}`)}
                        className="-mx-2 flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-canvas"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{item.role}</p>
                          <p className="text-xs text-muted">
                            {item.mode} · {item.experience} · {fmtDate(item.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isComplete
                              ? scoreClass(item.finalScore || 0)
                              : "bg-amber-soft text-amber-deep"
                            }`}
                        >
                          {isComplete
                            ? Number(item.finalScore || 0).toFixed(1)
                            : `Incomplete · ${item.answeredCount ?? 0}/${item.totalQuestions ?? 6}`}
                        </span>
                        <FaChevronRight size={11} className="shrink-0 text-line-strong" />
                      </button>
                    );
                  })}
                </div>
              )}

              {loadFailed && (
                <p className="mt-3 text-xs text-rose-deep">
                  Some activity couldn't be loaded. Refresh to try again.
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Profile;