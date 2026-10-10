import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BsRobot } from "react-icons/bs";
import { IoSparkles } from "react-icons/io5";
import { motion } from "motion/react";
import { FcGoogle } from "react-icons/fc";
import { signInWithPopup } from "firebase/auth";
import {auth, provider} from "../utils/firebase.js"
import axios from "axios"
import { serverUrl } from "../App.jsx";
import { useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice.js";


function Auth({isModel = false}) {

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const [errorMsg, setErrorMsg] = useState("")

    const handleGoogleAuth = async () =>{
        setErrorMsg("")
        try{
            const response = await signInWithPopup(auth, provider)
            const idToken = await response.user.getIdToken()
            const result = await axios.post(
              serverUrl + "/api/auth/google",
              { idToken },
              { withCredentials: true }
            )

            dispatch(setUserData(result.data))
            if (!isModel) navigate(location.state?.from || "/", { replace: true })
        }
        catch(error)
        {
            console.log(error);
            if (error?.code !== "auth/popup-closed-by-user") {
              setErrorMsg(error.response?.data?.message || "Sign-in failed. Please try again.")
            }
        }
    }
  return (
    <div
      className={`w-full ${isModel ?"py-4" : "min-h-screen bg-[#f3f3f3] flex items-center justify-center px-6 py-20"}`}
    >
      <motion.div 
        initial={{opacity:0, y:-50}}
        animate={{opacity:1, y:-0}}
        transition={{duration:2}}

        className={`w-full ${isModel? "max-w-md p-8 rounded-3xl" : "max-w-lg p-12 rounded-[32px]"}
         bg-white shadow-2xl border border-gray-200`}
      >
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="bg-black text-white p-2 rounded-lg">
            <BsRobot size={18} />
          </div>
          <h2 className="font-semibold text-lg">InterviewFlow</h2>
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold text-center leading-snug mb-4">
          Continue with{" "}
          <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full inline-flex items-center gap-2">
            <IoSparkles size={16} />
            InterviewFlow
          </span>
        </h1>

        <p className="text-gray-500 text-center text-sm md:text-base leading-relaxed mb-8">
          Sign in to start AI-powered mock interviews, track your progress, and
          unlock detailed performance insights.
        </p>

        <motion.button
            onClick={handleGoogleAuth}
            whileHover={{opacity:0.8, scale: 1.04}}
            whileTap={{opacity:1, scale: 1}}
            className="flex mx-auto w-60 items-center justify-center gap-3 py-3 bg-black text-white rounded-full shadow-md">
                <FcGoogle size={20}/>
                Continue with Google
            </motion.button>
      </motion.div>
        {errorMsg && (
          <p className="text-red-500 text-sm text-center mt-4">{errorMsg}</p>
        )}
    </div>
  );
}

export default Auth;
