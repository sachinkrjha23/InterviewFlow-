import React, { useState } from "react";
import Navbar from "../components/Navbar";
import AuthModel from "../components/AuthModel";
import { useSelector } from "react-redux";
import { motion } from "motion/react";
import {
  BsRobot,
  BsMic,
  BsClock,
  BsBarChart,
  BsFileEarmark,
  BsFileEarmarkText,
} from "react-icons/bs";
import { HiSparkles } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import evalImg from "../assets/ai-ans.png";
import resumeImg from "../assets/resume.png";
import pdfImg from "../assets/pdf.png";
import analyticsImg from "../assets/history.png";
import hrImg from "../assets/hr.png";
import techImg from "../assets/tech.png";
import confidenceImg from "../assets/confi.png";
import creditImg from "../assets/credit.png";
import Footer from "../components/Footer";

function Home() {
  const { userData } = useSelector((state) => state.user);
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  const steps = [
    {
      icon: <BsRobot size={22} />,
      step: "STEP 1",
      title: "Role & Experience Selection",
      desc: "AI adjusts difficulty based on the role and experience you pick.",
      color: "from-blue-500 to-cyan-400",
      ring: "ring-blue-100",
    },
    {
      icon: <BsMic size={22} />,
      step: "STEP 2",
      title: "Smart Voice Interview",
      desc: "Dynamic follow-up questions that feel like a real conversation.",
      color: "from-green-500 to-emerald-400",
      ring: "ring-green-100",
    },
    {
      icon: <BsClock size={22} />,
      step: "STEP 3",
      title: "Timer Based Simulation",
      desc: "Real interview pressure with live time tracking and scoring.",
      color: "from-purple-500 to-pink-400",
      ring: "ring-purple-100",
    },
  ];

  const capabilities = [
    {
      image: evalImg,
      icon: <BsBarChart size={20} />,
      title: "AI Answer Evaluation",
      desc: "Scores communication, technical accuracy and confidence.",
    },
    {
      image: resumeImg,
      icon: <BsFileEarmark size={20} />,
      title: "Resume Based Interview",
      desc: "Project-specific questions based on your uploaded resume.",
    },
    {
      image: pdfImg,
      icon: <BsFileEarmarkText size={20} />,
      title: "Downloadable PDF Report",
      desc: "Detailed strengths, weaknesses and improvement insights.",
    },
    {
      image: analyticsImg,
      icon: <BsBarChart size={20} />,
      title: "History and Analytics",
      desc: "Track progress with performance graphs and topic analysis.",
    },
  ];

  const modes = [
    {
      image: hrImg,
      icon: <BsRobot size={20} />,
      title: "HR Interview Mode",
      desc: "Behavioural and communication based evaluation.",
    },
    {
      image: techImg,
      icon: <BsBarChart size={20} />,
      title: "Technical Interview Mode",
      desc: "Deep technical questioning based on selected role.",
    },
    {
      image: confidenceImg,
      icon: <BsMic size={20} />,
      title: "Confidence Detection",
      desc: "Basic tone and voice analysis insights.",
    },
    {
      image: creditImg,
      icon: <BsFileEarmarkText size={20} />,
      title: "Credit System",
      desc: "Unlock premium interview sessions.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f8fafc] via-[#f3f4f6] to-[#eef2f7]">
      <Navbar />

      <section className="flex-1 px-6 pt-16 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center mb-8">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2 text-sm text-gray-700
                        bg-white/70 backdrop-blur px-4 py-2 rounded-full
                        ring-1 ring-gray-200 shadow-sm"
            >
              <HiSparkles size={16} className="text-green-600" />
              AI Powered Smart Interview Platform
            </motion.div>
          </div>

          <div className="text-center mb-24">
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-4xl sm:text-5xl md:text-6xl font-semibold
                        leading-tight tracking-tight max-w-4xl mx-auto text-gray-900"
            >
              Practice Interviews with{" "}
              <span className="relative inline-block">
                <span
                  className="relative z-10 bg-gradient-to-r from-green-100 to-emerald-100
                                text-green-700 px-4 sm:px-5 py-1 rounded-full"
                >
                  AI Intelligence
                </span>
                <span className="absolute inset-0 blur-2xl bg-green-300/40 rounded-full -z-0" />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-gray-500 mt-6 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed"
            >
              Role-based mock interviews with smart follow-ups, adaptive
              difficulty, and real-time performance evaluation.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap justify-center gap-4 mt-10"
            >
              <motion.button
                onClick={() => {
                  if (!userData) return setShowAuth(true);
                  navigate("/interview");
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="relative overflow-hidden bg-black text-white px-8 py-3 rounded-full
                          shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20
                          transition-all duration-300 group"
              >
                <span className="relative z-10">Start Interview</span>
                <span
                  className="absolute inset-0 rounded-full bg-gradient-to-r
                                from-emerald-500 to-green-500 opacity-0
                                group-hover:opacity-100 transition-opacity duration-300"
                />
              </motion.button>

              <motion.button
                onClick={() => {
                  if (!userData) return setShowAuth(true);
                  navigate("/history");
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="border border-gray-300 bg-white/80 backdrop-blur
                          px-8 py-3 rounded-full hover:bg-white
                          hover:border-gray-400 transition-all duration-300"
              >
                View Interview History
              </motion.button>
            </motion.div>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-center gap-10 mb-28">
            {steps.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                whileHover={{ rotate: 0, scale: 1.06, y: -6 }}
                className={`
                  relative bg-white rounded-3xl border-2 border-green-100
                  hover:border-green-500 p-6 pt-10 w-64 max-w-[90%]
                  shadow-md hover:shadow-2xl transition-all duration-300
                  ${index === 0 ? "rotate-[-4deg]" : ""}
                  ${index === 1 ? "rotate-[3deg] md:-mt-6 shadow-xl" : ""}
                  ${index === 2 ? "rotate-[-3deg]" : ""}
                `}
              >
                <div
                  className={`absolute -top-8 left-1/2 -translate-x-1/2
                              w-14 h-14 rounded-2xl flex items-center justify-center
                              text-white shadow-lg ring-4 ${item.ring}
                              bg-gradient-to-br ${item.color}`}
                >
                  {item.icon}
                </div>

                <p className="text-[10px] font-semibold tracking-widest text-green-600 mb-2 text-center">
                  {item.step}
                </p>
                <h3 className="font-semibold text-sm mb-2 text-center text-gray-900">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="mt-32 mb-32">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl font-semibold text-center mb-16 text-gray-900"
            >
              Advanced AI <span className="text-green-600">Capabilities</span>
            </motion.h2>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {capabilities.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="bg-white border border-gray-100 rounded-2xl p-6
                   shadow-sm hover:shadow-xl hover:border-green-100
                   transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row items-center gap-5">
                    <div className="w-full md:w-1/2 flex justify-center">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-auto object-contain max-h-40"
                      />
                    </div>

                    <div className="w-full md:w-1/2">
                      <div
                        className="bg-green-50 text-green-600 w-10 h-10 rounded-lg
                         flex items-center justify-center mb-3"
                      >
                        {item.icon}
                      </div>

                      <h3 className="font-semibold text-base text-gray-900 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-32 mb-32">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl font-semibold text-center mb-16 text-gray-900"
            >
              Multiple Interview <span className="text-green-600">Modes</span>
            </motion.h2>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {modes.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="bg-white border border-gray-100 rounded-2xl p-6
                   shadow-sm hover:shadow-xl hover:border-green-100
                   transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row items-center gap-5">
                    <div className="w-full md:w-1/2 flex justify-center">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-auto object-contain max-h-40"
                      />
                    </div>

                    <div className="w-full md:w-1/2">
                      <div
                        className="bg-green-50 text-green-600 w-10 h-10 rounded-lg
                         flex items-center justify-center mb-3"
                      >
                        {item.icon}
                      </div>

                      <h3 className="font-semibold text-base text-gray-900 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </section>

      <Footer/>

      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}

    </div>
  );
}

export default Home;