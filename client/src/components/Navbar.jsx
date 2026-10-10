import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "motion/react";
import { BsRobot, BsCoin } from "react-icons/bs";
import { HiOutlineLogout } from "react-icons/hi";
import {
  FaUser,
  FaUserCircle,
  FaHistory,
  FaPlusCircle,
  FaCoins,
  FaChevronDown,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { serverUrl } from "../App";
import { setUserData } from "../redux/userSlice";
import AuthModel from "./AuthModel";
import Avatar from "./Avatar";
import { signOut } from "firebase/auth";
import { auth } from "../utils/firebase.js";


function Navbar() {
  const { userData } = useSelector((state) => state.user);
  const [showCreditPopup, setShowCreditPopup] = useState(false);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const creditRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (creditRef.current && !creditRef.current.contains(e.target)) {
        setShowCreditPopup(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserPopup(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreditPopup(false);
        setShowUserPopup(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const go = (path) => {
    setShowUserPopup(false);
    setShowCreditPopup(false);
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await axios.post(serverUrl + "/api/auth/logout", {}, { withCredentials: true });
      await signOut(auth);
      dispatch(setUserData(null));
      setShowCreditPopup(false);
      setShowUserPopup(false);
      navigate("/");
    } catch (error) {
      console.log(error);
    }
  };

  const menuItems = [
    {
      label: "View profile",
      desc: "Photo, name and stats",
      icon: <FaUserCircle size={16} />,
      to: "/profile",
    },
    {
      label: "New interview",
      desc: "Start a mock interview",
      icon: <FaPlusCircle size={16} />,
      to: "/interview",
    },
    {
      label: "Interview history",
      desc: "Past reports and scores",
      icon: <FaHistory size={16} />,
      to: "/history",
    },
    {
      label: "Credits",
      desc: `${userData?.credits ?? 0} available`,
      icon: <FaCoins size={16} />,
      to: "/pricing",
    },
  ];

  return (
    <div className="bg-[#f3f3f3] flex justify-center px-4 pt-6">
      <motion.div
        initial={{ opacity: 0.3, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="w-full max-w-6xl bg-white rounded-[24px] shadow-sm border
         border-gray-200 px-8 py-4 flex justify-between items-center relative"
      >
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="bg-black text-white p-2 rounded-lg flex items-center justify-center">
            <BsRobot size={18} />
          </div>
          <h1 className="font-semibold hidden md:block text-lg">InterviewFlow</h1>
        </div>

        <div className="flex items-center gap-4 relative">
          <div className="relative" ref={creditRef}>
            <button
              onClick={() => {
                if (!userData) {
                  setShowAuth(true);
                  return;
                }
                setShowCreditPopup(!showCreditPopup);
                setShowUserPopup(false);
              }}
              className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-md font-bold hover:bg-gray-200 transition"
            >
              <BsCoin size={22} />
              {userData?.credits || 0}
            </button>

            <AnimatePresence>
              {showCreditPopup && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-[-50px] mt-3 w-64 bg-white shadow-xl border border-gray-200 rounded-2xl p-5 z-50"
                >
                  <p className="text-sm text-gray-600 mb-4">
                    Each interview uses 50 credits.
                  </p>
                  <button
                    onClick={() => go("/pricing")}
                    className="w-full bg-black text-white py-2 rounded-lg text-sm hover:opacity-90 transition"
                  >
                    View credits
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => {
                if (!userData) {
                  setShowAuth(true);
                  return;
                }
                setShowUserPopup(!showUserPopup);
                setShowCreditPopup(false);
              }}
              aria-label="Open profile menu"
              aria-expanded={showUserPopup}
              className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-gray-100 transition"
            >
              {userData ? (
                <Avatar user={userData} size={36} />
              ) : (
                <div className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center">
                  <FaUser size={16} />
                </div>
              )}
              {userData && (
                <FaChevronDown
                  size={10}
                  className={`text-gray-500 transition-transform duration-200 ${
                    showUserPopup ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            <AnimatePresence>
              {showUserPopup && userData && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl
                             border border-gray-200 overflow-hidden z-50 origin-top-right"
                >
                  <div className="px-5 py-4 bg-gradient-to-br from-emerald-50 to-teal-50
                                  border-b border-gray-100 flex items-center gap-3">
                    <Avatar user={userData} size={48} />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {userData.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {userData.email}
                      </p>
                    </div>
                  </div>

                  <div className="p-2">
                    {menuItems.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => go(item.to)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                   hover:bg-gray-50 transition text-left group"
                      >
                        <span className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600
                                         flex items-center justify-center
                                         group-hover:bg-emerald-50 group-hover:text-emerald-600
                                         transition-colors">
                          {item.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-800">
                            {item.label}
                          </span>
                          <span className="block text-xs text-gray-400">
                            {item.desc}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                 text-red-500 hover:bg-red-50 transition text-left"
                    >
                      <span className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                        <HiOutlineLogout size={18} />
                      </span>
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default Navbar;