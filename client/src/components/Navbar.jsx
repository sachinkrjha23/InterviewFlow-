import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import { signOut } from "firebase/auth";
import { BsCoin } from "react-icons/bs";
import { HiOutlineLogout } from "react-icons/hi";
import { FaChevronDown, FaCoins, FaHistory, FaPlusCircle, FaUserCircle } from "react-icons/fa";
import { serverUrl, INTERVIEW_COST } from "../config.js";
import { setUserData } from "../redux/userSlice";
import { auth } from "../utils/firebase.js";
import AuthModel from "./AuthModel";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { AnimatePresence, motion } from "motion/react";
import { FaFileAlt } from "react-icons/fa";
import { FaChartLine } from "react-icons/fa";

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? "bg-indigo-soft text-indigo-deep" : "text-muted hover:bg-canvas hover:text-ink"
  }`;

function Navbar() {
  const { userData } = useSelector((state) => state.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const menuRef = useRef(null);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    setLogoutError("");
    try {
      await axios.post(serverUrl + "/api/auth/logout", {}, { withCredentials: true });
      await signOut(auth);
      dispatch(setUserData(null));
      setMenuOpen(false);
      navigate("/");
    } catch {
      setLogoutError("Couldn't log out. Check your connection and try again.");
    }
  };

  const credits = userData?.credits ?? 0;
  const lowCredits = credits < INTERVIEW_COST;

  const menuItems = [
    { label: "Profile", desc: "Photo, name and stats", icon: <FaUserCircle size={16} />, to: "/profile" },
    { label: "New interview", desc: "Start a mock interview", icon: <FaPlusCircle size={16} />, to: "/interview", mobileOnly: true },
    { label: "Interview history", desc: "Past reports and scores", icon: <FaHistory size={16} />, to: "/history", mobileOnly: true },
    { label: "Resume tailor", desc: "Match your resume to a job", icon: <FaFileAlt size={16} />, to: "/resume", mobileOnly: true },
    { label: "Progress", desc: "See how your scores change", icon: <FaChartLine size={16} />, to: "/progress", mobileOnly: true },
    { label: "Credits", desc: `${credits} available`, icon: <FaCoins size={16} />, to: "/pricing" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6"
      >
        <div className="flex items-center gap-6">
          <Logo />
          <div className="hidden items-center gap-1 md:flex">
            {userData ? (
              <>
                <NavLink to="/interview" className={linkClass}>New interview</NavLink>
                <NavLink to="/history" className={linkClass}>History</NavLink>
                <NavLink to="/resume" className={linkClass}>Resume tailor</NavLink>
                <NavLink to="/progress" className={linkClass}>Progress</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/about" className={linkClass}>About</NavLink>
                <NavLink to="/faq" className={linkClass}>FAQ</NavLink>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!userData && (
            <motion.button
              type="button"
              onClick={() => setShowAuth(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in
            </motion.button>
          )}

          {userData && (
            <Link
              to="/pricing"
              aria-label={`${credits} credits`}
              title={lowCredits ? "Not enough credits for an interview" : "Your credits"}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${lowCredits ? "bg-amber-soft text-amber-deep" : "bg-teal-soft text-teal-deep"
                }`}
            >
              <BsCoin size={16} aria-hidden="true" />
              {credits}
            </Link>
          )}

          {userData && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Open profile menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-canvas"
              >
                <Avatar user={userData} size={36} />
                <FaChevronDown
                  size={10}
                  aria-hidden="true"
                  className={`text-muted transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    style={{ transformOrigin: "top right" }}
                    className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-md"
                  >
                    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                      <Avatar user={userData} size={44} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{userData.name}</p>
                        <p className="truncate text-xs text-muted">{userData.email}</p>
                      </div>
                    </div>

                    <div className="p-2">
                      {menuItems.map((item) => (
                        <Link
                          key={item.label}
                          to={item.to}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-canvas ${item.mobileOnly ? "md:hidden" : ""
                            }`}
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-soft text-indigo-deep">
                            {item.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink">{item.label}</span>
                            <span className="block text-xs text-muted">{item.desc}</span>
                          </span>
                        </Link>
                      ))}
                    </div>

                    <div className="border-t border-line p-2">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-rose-deep hover:bg-rose-soft"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-soft">
                          <HiOutlineLogout size={18} aria-hidden="true" />
                        </span>
                        <span className="text-sm font-medium">Log out</span>
                      </button>
                      {logoutError && (
                        <p role="alert" className="px-3 pb-1 pt-2 text-xs text-rose-deep">
                          {logoutError}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </nav>

      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}
    </header>
  );
}

export default Navbar;