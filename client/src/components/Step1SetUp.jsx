import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import axios from "axios";
import {
  FaUserTie,
  FaBriefcase,
  FaFileUpload,
  FaMicrophone,
  FaChartLine,
  FaCheckCircle,
  FaSpinner,
} from "react-icons/fa";
import { serverUrl } from "../App";
import { useDispatch, useSelector } from "react-redux";
import { setUserData } from "../redux/userSlice";

function Step1SetUp({ onStart }) {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();

  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [mode, setMode] = useState("Technical");
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [projects, setProjects] = useState([]);
  const [skills, setSkills] = useState([]);
  const [resumeText, setResumeText] = useState("");
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const clickLockRef = useRef(false);

  const handleUploadResume = async () => {
    if (!resumeFile || analyzing) return;
    setAnalyzing(true);

    const formdata = new FormData();
    formdata.append("resume", resumeFile);

    try {
      const result = await axios.post(
        serverUrl + "/api/interview/resume",
        formdata,
        { withCredentials: true }
      );

      console.log(result.data);

      setRole(result.data.role || "");
      setExperience(result.data.experience || "");
      setProjects(result.data.projects || []);
      setSkills(result.data.skills || []);
      setResumeText(result.data.resumeText || "");
      setAnalysisDone(true);
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Failed to analyze resume");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStart = async () => {
    if (clickLockRef.current) return;

    if (!role || !experience) return;

    clickLockRef.current = true;
    setLoading(true);
    setStarted(true);

    try {
      const result = await axios.post(
        serverUrl + "/api/interview/generateQuestions",
        {
          role,
          experience,
          mode,
          resumeText,
          projects,
          skills,
        },
        { withCredentials: true }
      );

      console.log(result.data);

      if (userData) {
        dispatch(
          setUserData({ ...userData, credits: result.data.creditsLeft })
        );
      }

      onStart(result.data);
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Failed to start interview");

      clickLockRef.current = false;
      setStarted(false);
    } finally {
      setLoading(false);
    }
  };

  const canStart = role && experience;
  const isLocked = loading || started;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen flex items-center justify-center
                 bg-gradient-to-br from-slate-50 via-gray-50 to-green-50/40
                 px-4 py-10"
    >
      <div
        className="w-full max-w-6xl bg-white rounded-3xl
                   shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)]
                   border border-gray-100
                   grid md:grid-cols-2 overflow-hidden"
      >
        <motion.div
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative bg-gradient-to-br from-green-50 via-emerald-50 to-green-100
                     p-10 md:p-12 flex flex-col justify-center overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-green-300/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-300/20 rounded-full blur-3xl" />

          <div className="relative">
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold
                         text-green-700 bg-white/70 backdrop-blur px-3 py-1
                         rounded-full ring-1 ring-green-200 shadow-sm mb-5"
            >
              <FaMicrophone size={11} />
              AI Interview Studio
            </span>

            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              Start Your <span className="text-green-600">AI Interview</span>
            </h2>

            <p className="text-gray-600 mb-10 leading-relaxed">
              Practice real interview scenarios powered by AI. Improve
              communication, technical skills, and confidence.
            </p>

            <div className="space-y-3">
              {[
                {
                  icon: <FaUserTie />,
                  text: "Choose Role & Experience",
                  bg: "bg-blue-100 text-blue-600",
                },
                {
                  icon: <FaMicrophone />,
                  text: "Smart Voice Interview",
                  bg: "bg-green-100 text-green-600",
                },
                {
                  icon: <FaChartLine />,
                  text: "Performance Analytics",
                  bg: "bg-purple-100 text-purple-600",
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + index * 0.12 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="flex items-center gap-4 bg-white/80 backdrop-blur
                             p-3.5 rounded-xl shadow-sm border border-white
                             hover:shadow-md hover:border-green-200
                             transition-all cursor-pointer"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${item.bg}`}
                  >
                    {item.icon}
                  </div>
                  <span className="text-gray-700 font-medium text-sm">
                    {item.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="p-10 md:p-12 bg-white"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Interview Setup
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Fill in your details to begin.
          </p>

          <div className="space-y-5">
            {/* Role */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Role
              </label>
              <div className="relative">
                <FaUserTie className="absolute top-1/2 -translate-y-1/2 left-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g. Frontend Developer"
                  disabled={isLocked}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200
                             rounded-xl text-sm
                             focus:bg-white focus:border-green-500 focus:ring-2
                             focus:ring-green-100 outline-none transition
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  onChange={(e) => setRole(e.target.value)}
                  value={role}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Experience
              </label>
              <div className="relative">
                <FaBriefcase className="absolute top-1/2 -translate-y-1/2 left-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g. 2 years"
                  disabled={isLocked}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200
                             rounded-xl text-sm
                             focus:bg-white focus:border-green-500 focus:ring-2
                             focus:ring-green-100 outline-none transition
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  onChange={(e) => setExperience(e.target.value)}
                  value={experience}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Interview Mode
              </label>
              <select
                value={mode}
                disabled={isLocked}
                onChange={(e) => setMode(e.target.value)}
                className="w-full py-3 px-4 bg-gray-50 border border-gray-200
                           rounded-xl text-sm cursor-pointer
                           focus:bg-white focus:border-green-500 focus:ring-2
                           focus:ring-green-100 outline-none transition
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="Technical">Technical Interview</option>
                <option value="HR">HR Interview</option>
              </select>
            </div>

            {!analysisDone && (
              <motion.div
                whileHover={{ scale: isLocked ? 1 : 1.01 }}
                onClick={() => {
                  if (isLocked) return;
                  document.getElementById("resumeUpload").click();
                }}
                className={`border-2 border-dashed border-gray-300 rounded-xl
                           p-6 text-center bg-gray-50/50
                           transition-all
                           ${
                             isLocked
                               ? "opacity-60 cursor-not-allowed"
                               : "cursor-pointer hover:border-green-500 hover:bg-green-50/50"
                           }`}
              >
                <div
                  className="w-14 h-14 mx-auto mb-3 rounded-full
                             bg-green-100 flex items-center justify-center"
                >
                  <FaFileUpload className="text-xl text-green-600" />
                </div>

                <input
                  type="file"
                  accept="application/pdf"
                  id="resumeUpload"
                  className="hidden"
                  disabled={isLocked}
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />

                <p className="text-sm font-medium text-gray-700">
                  {resumeFile ? (
                    <span className="inline-flex items-center gap-2 text-green-700">
                      <FaCheckCircle size={13} />
                      {resumeFile.name}
                    </span>
                  ) : (
                    <>
                      <span className="text-green-600 font-semibold">
                        Click to upload
                      </span>{" "}
                      resume <span className="text-gray-400">(optional)</span>
                    </>
                  )}
                </p>

                {resumeFile && (
                  <motion.button
                    whileHover={{ scale: analyzing || isLocked ? 1 : 1.03 }}
                    whileTap={{ scale: analyzing || isLocked ? 1 : 0.97 }}
                    disabled={analyzing || isLocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadResume();
                    }}
                    className="mt-4 inline-flex items-center gap-2
                               bg-gray-900 text-white text-sm px-5 py-2
                               rounded-lg hover:bg-black
                               disabled:opacity-60 transition"
                  >
                    {analyzing && (
                      <FaSpinner className="animate-spin" size={12} />
                    )}
                    {analyzing ? "Analyzing..." : "Analyze Resume"}
                  </motion.button>
                )}
              </motion.div>
            )}

            {analysisDone && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border border-green-200 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm mb-2">
                  <FaCheckCircle />
                  Resume analyzed
                </div>

                {skills.length > 0 && (
                  <p className="text-xs text-green-800 mb-1">
                    <strong>Skills:</strong> {skills.join(", ")}
                  </p>
                )}
                {projects.length > 0 && (
                  <p className="text-xs text-green-800">
                    <strong>Projects:</strong> {projects.join(", ")}
                  </p>
                )}
              </motion.div>
            )}

            <motion.button
              onClick={handleStart}
              disabled={!canStart || isLocked}
              whileHover={{ scale: canStart && !isLocked ? 1.02 : 1 }}
              whileTap={{ scale: canStart && !isLocked ? 0.97 : 1 }}
              className="relative w-full overflow-hidden
                         disabled:bg-gray-300 disabled:cursor-not-allowed
                         bg-gradient-to-r from-green-600 to-emerald-600
                         hover:from-green-700 hover:to-emerald-700
                         text-white py-3.5 rounded-full text-base font-semibold
                         transition-all duration-300
                         shadow-lg shadow-green-600/20
                         disabled:shadow-none
                         inline-flex items-center justify-center gap-2"
            >
              {isLocked && <FaSpinner className="animate-spin" size={14} />}
              {isLocked ? "Starting..." : "Start Interview"}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default Step1SetUp;