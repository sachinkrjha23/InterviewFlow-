import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import SignInCard from "../components/SignInCard";
import PageLoader from "../components/PageLoader";

function Auth() {
  const { userData, authChecked } = useSelector((state) => state.user);
  const location = useLocation();

  // only go back to a page inside this app
  const requested = location.state?.from;
  const from =
    typeof requested === "string" && requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/";

  if (!authChecked) return <PageLoader />;
  if (userData) return <Navigate to={from} replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <SignInCard />
      </motion.div>
    </div>
  );
}

export default Auth;